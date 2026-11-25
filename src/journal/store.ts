import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getMessages, useLanguageStore } from '../i18n'
import { idbStorage } from './idbStorage'
import type { BlockCell, Cell, CellType, Journal, RunState, TextCell } from './types'
import { loadExample, loadWorkspace } from './workspaces'

export { newId } from '../utils/id'
import { newId } from '../utils/id'

export const createCell = (type: CellType): Cell => {
  const t = getMessages()
  if (type === 'text') return { id: newId(), type, markdown: '' }
  return {
    id: newId(),
    type,
    title: type === 'data' ? t.cells.data.defaultTitle : t.cells.analysis.defaultTitle,
    // A data cell starts with a ready-to-run block, so the first step is a single click.
    workspace: type === 'data' ? loadWorkspace([loadExample('stations')]) : null,
    code: '',
    outputs: [],
    note: '',
    solved: {},
  }
}

export const createJournal = (): Journal => {
  const t = getMessages()
  return {
    id: newId(),
    title: t.journal.untitled,
    subtitle: '',
    author: '',
    language: useLanguageStore.getState().language,
    cells: [{ id: newId(), type: 'text', markdown: t.journal.starterText }, createCell('data')],
    files: {},
    updatedAt: new Date().toISOString(),
  }
}

export const isBlockCell = (cell: Cell): cell is BlockCell => cell.type !== 'text'

type CellPatch = Partial<Omit<TextCell, 'id' | 'type'>> & Partial<Omit<BlockCell, 'id' | 'type'>>

type JournalState = {
  journal: Journal
  /** Execution state lives only for this browser session (the Python kernel is not persisted). */
  runStates: Record<string, RunState>
  hydrated: boolean
  setMeta: (patch: Partial<Pick<Journal, 'title' | 'subtitle' | 'author'>>) => void
  addCell: (type: CellType, index: number) => string
  /** Change what a cell computes: marks it and every later cell as outdated. */
  editCell: (id: string, patch: CellPatch) => void
  /** Store results or presentation-only changes without invalidating anything. */
  setResult: (id: string, patch: CellPatch) => void
  removeCell: (id: string) => void
  /** Copy a cell (with its blocks, without results) directly below it. */
  duplicateCell: (id: string) => string | null
  moveCell: (id: string, direction: -1 | 1) => void
  addFile: (name: string, content: string) => void
  setShare: (share: Journal['share']) => void
  setRunState: (id: string, state: RunState) => void
  invalidateFrom: (index: number) => void
  replaceJournal: (journal: Journal) => void
}

const touch = (journal: Journal, cells: Cell[]): Journal => ({
  ...journal,
  cells,
  updatedAt: new Date().toISOString(),
})

const patchCell = (cells: Cell[], id: string, patch: CellPatch) =>
  cells.map((cell) => (cell.id === id ? ({ ...cell, ...patch } as Cell) : cell))

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => ({
      journal: createJournal(),
      runStates: {},
      hydrated: false,

      setMeta: (patch) =>
        set(({ journal }) => ({ journal: { ...journal, ...patch, updatedAt: new Date().toISOString() } })),

      addCell: (type, index) => {
        const cell = createCell(type)
        set(({ journal }) => {
          const cells = [...journal.cells]
          cells.splice(index, 0, cell)
          return { journal: touch(journal, cells) }
        })
        return cell.id
      },

      editCell: (id, patch) => {
        set(({ journal }) => ({ journal: touch(journal, patchCell(journal.cells, id, patch)) }))
        get().invalidateFrom(get().journal.cells.findIndex((cell) => cell.id === id))
      },

      setResult: (id, patch) =>
        set(({ journal }) => ({ journal: touch(journal, patchCell(journal.cells, id, patch)) })),

      removeCell: (id) => {
        const index = get().journal.cells.findIndex((cell) => cell.id === id)
        set(({ journal }) => ({ journal: touch(journal, journal.cells.filter((cell) => cell.id !== id)) }))
        get().invalidateFrom(index)
      },

      duplicateCell: (id) => {
        const cells = [...get().journal.cells]
        const index = cells.findIndex((cell) => cell.id === id)
        if (index < 0) return null
        const original = cells[index]
        const copy: Cell =
          original.type === 'text'
            ? { ...original, id: newId() }
            : {
                ...original,
                id: newId(),
                title: `${original.title} ${getMessages().cells.copySuffix}`,
                outputs: [],
                solved: {},
                workspace: original.workspace ? structuredClone(original.workspace) : null,
              }
        cells.splice(index + 1, 0, copy)
        set(({ journal }) => ({ journal: touch(journal, cells) }))
        return copy.id
      },

      moveCell: (id, direction) => {
        const cells = [...get().journal.cells]
        const index = cells.findIndex((cell) => cell.id === id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= cells.length) return
        ;[cells[index], cells[target]] = [cells[target], cells[index]]
        set(({ journal }) => ({ journal: touch(journal, cells) }))
        get().invalidateFrom(Math.min(index, target))
      },

      addFile: (name, content) =>
        set(({ journal }) => ({ journal: { ...journal, files: { ...journal.files, [name]: content } } })),

      setShare: (share) => set(({ journal }) => ({ journal: { ...journal, share } })),

      setRunState: (id, state) => set(({ runStates }) => ({ runStates: { ...runStates, [id]: state } })),

      invalidateFrom: (index) => {
        if (index < 0) return
        const runStates = { ...get().runStates }
        for (const cell of get().journal.cells.slice(index)) {
          const state = runStates[cell.id]
          if (state && state.status !== 'idle') runStates[cell.id] = { status: 'stale' }
        }
        set({ runStates })
      },

      replaceJournal: (journal) => set({ journal: { ...journal, files: journal.files ?? {} }, runStates: {} }),
    }),
    {
      name: 'spockly-journal',
      // v2: data cells became Blockly workspaces; older journals are replaced by a fresh one.
      version: 2,
      migrate: () => ({ journal: createJournal() }),
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ journal: state.journal }),
      onRehydrateStorage: () => () => useJournalStore.setState({ hydrated: true }),
    },
  ),
)
