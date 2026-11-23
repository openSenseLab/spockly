import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { idbStorage } from '../journal/idbStorage'
import { createCell, useJournalStore } from '../journal/store'
import type { BlockCell, CellOutput, RunState } from '../journal/types'
import { loadExample, pipelineWorkspace } from '../journal/workspaces'

type LabState = {
  workspace: object | null
  code: string
  outputs: CellOutput[]
  /** Uploaded files (name → text) used by "load file" blocks in the lab. */
  files: Record<string, string>
  run: RunState
  /** Bumped on reset so the editor re-mounts with the fresh workspace. */
  version: number
  hydrated: boolean
  setWorkspace: (workspace: object, code: string) => void
  setOutputs: (outputs: CellOutput[]) => void
  setRun: (run: RunState) => void
  addFile: (name: string, content: string) => void
  reset: () => void
}

/** Starter: load the stations and show them as a table, ready to run. */
const starterWorkspace = () => {
  const pipeline = pipelineWorkspace('stations', [{ type: 'spk_show_table', fields: { TITLE: '' } }])
  const [pipelineBlock] = pipeline.blocks.blocks
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { ...loadExample('stations'), x: 24, y: 24 },
        { ...pipelineBlock, y: 110 },
      ],
    },
  }
}

export const useLabStore = create<LabState>()(
  persist(
    (set) => ({
      workspace: starterWorkspace(),
      code: '',
      outputs: [],
      files: {},
      run: { status: 'idle' },
      version: 0,
      hydrated: false,
      setWorkspace: (workspace, code) =>
        set((state) => ({
          workspace,
          code,
          run: code !== state.code && state.run.status === 'done' ? { status: 'stale' } : state.run,
        })),
      setOutputs: (outputs) => set({ outputs }),
      setRun: (run) => set({ run }),
      addFile: (name, content) => set((state) => ({ files: { ...state.files, [name]: content } })),
      reset: () =>
        set((state) => ({
          workspace: starterWorkspace(),
          code: '',
          outputs: [],
          run: { status: 'idle' },
          version: state.version + 1,
        })),
    }),
    {
      name: 'spockly-lab',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ workspace, code, outputs, files }) => ({ workspace, code, outputs, files }),
      onRehydrateStorage: () => () => useLabStore.setState({ hydrated: true }),
    },
  ),
)

type SerializedBlock = {
  type: string
  x?: number
  y?: number
  fields?: Record<string, unknown>
  next?: { block: SerializedBlock }
}

export type LabTransferOptions = {
  /** Position in the journal's cell list where the new cells go. */
  index: number
  title: string
  /** Load blocks go into their own data cell (otherwise they stay at the top of the analysis). */
  separateData: boolean
  /** Each "use dataset" pipeline becomes its own analysis cell. */
  perPipeline: boolean
}

const isLoad = (block: SerializedBlock) => block.type.startsWith('spk_load_')

/** The lab's top-level blocks in execution order (top to bottom, like the code generator). */
const topBlocks = (): SerializedBlock[] => {
  const workspace = useLabStore.getState().workspace as { blocks?: { blocks?: SerializedBlock[] } } | null
  return [...(workspace?.blocks?.blocks ?? [])].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
}

/** A chain of statement blocks (block → next → next) as a list, and back. */
const unchain = (block: SerializedBlock): SerializedBlock[] => {
  const list: SerializedBlock[] = []
  for (let current: SerializedBlock | undefined = block; current; current = current.next?.block) {
    const { next: _next, ...rest } = current
    void _next
    list.push(rest)
  }
  return list
}

const chain = (blocks: SerializedBlock[]): SerializedBlock | null =>
  blocks.reduceRight<SerializedBlock | null>((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), null)

/** Keep the blocks' arrangement but move the group to the top-left corner. */
const layout = (blocks: SerializedBlock[]) => {
  const minX = Math.min(...blocks.map((b) => b.x ?? 0))
  const minY = Math.min(...blocks.map((b) => b.y ?? 0))
  return {
    blocks: {
      languageVersion: 0,
      blocks: blocks.map((b) => ({ ...b, x: (b.x ?? 0) - minX + 24, y: (b.y ?? 0) - minY + 24 })),
    },
  }
}

/** Load blocks the journal already has with exactly the same settings. */
const journalLoads = () => {
  const known = new Set<string>()
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      const record = node as SerializedBlock
      if (typeof record.type === 'string' && isLoad(record)) known.add(JSON.stringify([record.type, record.fields]))
      Object.values(node).forEach(visit)
    }
  }
  for (const cell of useJournalStore.getState().journal.cells) if (cell.type !== 'text') visit(cell.workspace)
  return known
}

/** What the lab contains, for the dialog's summary. */
export const describeLab = () => {
  const blocks = topBlocks()
  const loads = blocks.filter(isLoad).flatMap(unchain)
  const known = journalLoads()
  return {
    pipelines: blocks.filter((b) => b.type === 'spk_pipeline').length,
    loads: loads.length,
    alreadyInJournal: loads.filter((b) => known.has(JSON.stringify([b.type, b.fields]))).map((b) => String(b.fields?.NAME ?? '')),
    empty: blocks.length === 0,
  }
}

/** Cells (not yet inserted) built from the lab workspace. */
const cellsFromLab = ({ title, separateData, perPipeline }: LabTransferOptions): BlockCell[] => {
  const blocks = topBlocks()
  const known = journalLoads()
  const loadChains = blocks.filter(isLoad)
  const rest = blocks.filter((b) => !isLoad(b))

  // Groups of analysis blocks: one per pipeline, other blocks stay with the pipeline above them.
  const groups: SerializedBlock[][] = []
  for (const block of rest) {
    if (!groups.length || (perPipeline && block.type === 'spk_pipeline' && groups.at(-1)!.some((b) => b.type === 'spk_pipeline'))) {
      groups.push([])
    }
    groups.at(-1)!.push(block)
  }

  const cells: BlockCell[] = []
  const freshLoads = loadChains
    .map((block) => ({ ...chain(unchain(block).filter((b) => !known.has(JSON.stringify([b.type, b.fields])))), x: block.x, y: block.y }))
    .filter((block) => block.type)
  if (separateData && freshLoads.length) {
    cells.push({ ...(createCell('data') as BlockCell), workspace: layout(freshLoads as SerializedBlock[]) })
  } else if (!separateData && loadChains.length) {
    if (!groups.length) groups.push([])
    // Loading stays first, above the analysis, so it runs before it.
    const top = Math.min(...groups[0].map((b) => b.y ?? 0), 0)
    groups[0].unshift(...loadChains.map((b, i) => ({ ...b, y: top - 200 + i * 60 })))
  }

  const used = new Map<string, number>()
  groups.forEach((group) => {
    const pipeline = group.find((b) => b.type === 'spk_pipeline')
    const dataset = String(pipeline?.fields?.DATASET ?? '')
    const base = groups.length > 1 && dataset ? `${title} – ${dataset}` : title
    // Number repeated titles, e.g. two pipelines on the same dataset.
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    const name = count > 1 ? `${base} (${count})` : base
    cells.push({ ...(createCell('analysis') as BlockCell), title: name, workspace: layout(group) })
  })
  return cells
}

/** Insert the lab's workflow into the journal. Returns the ids of the new cells. */
export const insertLabIntoJournal = (options: LabTransferOptions) => {
  const cells = cellsFromLab(options)
  const store = useJournalStore.getState()
  for (const [name, content] of Object.entries(useLabStore.getState().files)) store.addFile(name, content)
  return cells.map((cell, offset) => {
    const id = store.addCell(cell.type, options.index + offset)
    store.setResult(id, { title: cell.title, workspace: cell.workspace })
    return id
  })
}
