import { codeFromWorkspace } from '../blockly/headless'
import { KernelError, runCode } from '../kernel/kernel'
import { isBlockCell, useJournalStore } from './store'
import type { BlockCell } from './types'
import { inspectRequests } from './workspaces'

let queue: Promise<unknown> = Promise.resolve()

/** Serialize all kernel work so cells always execute in journal order. */
const enqueue = <T>(task: () => Promise<T>) => {
  const result = queue.then(task, task)
  queue = result.catch(() => undefined)
  return result
}

/** Only send the uploaded files this code actually reads. */
const filesFor = (code: string) =>
  Object.fromEntries(
    Object.entries(useJournalStore.getState().journal.files).filter(([name]) => code.includes(JSON.stringify(name))),
  )

const execute = async (cell: BlockCell) => {
  const store = useJournalStore.getState()
  store.setRunState(cell.id, { status: 'running' })
  try {
    const code = cell.code || codeFromWorkspace(cell.workspace)
    if (!code.trim()) throw new KernelError(cell.type === 'data' ? 'SPK|no_data|' : 'SPK|no_blocks|')
    const inspect = cell.type === 'data' ? inspectRequests(cell.workspace) : []
    const outputs = await runCode(code, filesFor(code), inspect)
    store.setResult(cell.id, { outputs })
    useJournalStore.getState().setRunState(cell.id, { status: 'done' })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    useJournalStore.getState().setRunState(cell.id, { status: 'error', error: message })
    return false
  }
}

/**
 * Run one cell. Earlier cells that have not run in this session are run first,
 * so datasets a cell depends on are always available (like "run all above").
 */
export const runCell = (cellId: string) =>
  enqueue(async () => {
    const { journal, runStates } = useJournalStore.getState()
    const index = journal.cells.findIndex((cell) => cell.id === cellId)
    for (const cell of journal.cells.slice(0, index + 1)) {
      if (!isBlockCell(cell)) continue
      const needsRun = cell.id === cellId || runStates[cell.id]?.status !== 'done'
      if (needsRun && !(await execute(cell))) return false
    }
    return true
  })

export const runAll = () =>
  enqueue(async () => {
    for (const cell of useJournalStore.getState().journal.cells) {
      if (isBlockCell(cell) && !(await execute(cell))) return false
    }
    return true
  })
