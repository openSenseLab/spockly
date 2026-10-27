import { create } from 'zustand'
import { DEFAULT_PYTHON_CODE } from '../constants'
import type { DataTable, PlanStep } from '../core/types'

type WorkspaceMetrics = {
  totalBlocks: number
  topLevelBlocks: number
}

export type LoadState =
  | { key: string; status: 'loading'; progress?: { done: number; total: number; unit: 'rows' | 'stations' | 'servers' } }
  | { key: string; status: 'ready'; table: DataTable }
  | { key: string; status: 'error'; errorCode: string }

type AppState = WorkspaceMetrics & {
  /** Python for the whole workspace (dev view; includes blocks outside strands). */
  generatedCode: string
  /** Python per strand, by hat block id. */
  strandCode: Record<string, string>
  /** Python variable name of each strand's data, by hat block id. */
  strandNames: Record<string, string>
  workspaceVersion: number
  /** Load steps currently on the workspace (one per hat block). */
  loadSteps: PlanStep[]
  /** Result per load block id. */
  loads: Record<string, LoadState>
  selectedBlockId: string | null
  /** Columns kept hidden in the Daten tab until a prediction is revealed, by strand id. */
  hiddenColumns: Record<string, string[]>
  /** Block whose setup window is open (API loaders). */
  setupBlockId: string | null
  /** Load block whose fields changed most recently; shown when nothing is selected. */
  lastEditedLoadId: string | null
  resetWorkspace: () => void
  setGeneratedCode: (code: string) => void
  setStrandCode: (code: Record<string, string>, names: Record<string, string>) => void
  setWorkspaceMetrics: (metrics: WorkspaceMetrics) => void
  setLoadSteps: (steps: PlanStep[]) => void
  setLoadState: (blockId: string, state: LoadState | null) => void
  setSelectedBlockId: (blockId: string | null) => void
  setSetupBlockId: (blockId: string | null) => void
  setHiddenColumns: (hidden: Record<string, string[]>) => void
}

export const useAppStore = create<AppState>((set) => ({
  generatedCode: DEFAULT_PYTHON_CODE,
  strandCode: {},
  strandNames: {},
  totalBlocks: 0,
  topLevelBlocks: 0,
  workspaceVersion: 0,
  loadSteps: [],
  loads: {},
  selectedBlockId: null,
  setupBlockId: null,
  hiddenColumns: {},
  lastEditedLoadId: null,
  resetWorkspace: () =>
    set((state) => ({
      workspaceVersion: state.workspaceVersion + 1,
    })),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
  setStrandCode: (strandCode, strandNames) => set({ strandCode, strandNames }),
  setWorkspaceMetrics: ({ totalBlocks, topLevelBlocks }) =>
    set({ totalBlocks, topLevelBlocks }),
  setLoadSteps: (steps) =>
    set((state) => {
      const before = new Map(state.loadSteps.map((s) => [s.id, JSON.stringify(s.params)]))
      const edited = steps.find((s) => before.get(s.id) !== JSON.stringify(s.params))
      const ids = new Set(steps.map((s) => s.id))
      return {
        loadSteps: steps,
        lastEditedLoadId:
          edited?.id ??
          (state.lastEditedLoadId && ids.has(state.lastEditedLoadId)
            ? state.lastEditedLoadId
            : (steps.at(-1)?.id ?? null)),
      }
    }),
  setLoadState: (blockId, loadState) =>
    set((state) => {
      const loads = { ...state.loads }
      if (loadState) loads[blockId] = loadState
      else delete loads[blockId]
      return { loads }
    }),
  setSelectedBlockId: (selectedBlockId) => set({ selectedBlockId }),
  setSetupBlockId: (setupBlockId) => set({ setupBlockId }),
  setHiddenColumns: (hiddenColumns) => set({ hiddenColumns }),
}))

/**
 * The strand the side panel shows: the selected one, otherwise the one edited
 * last. Data and code tabs both use this, so they always agree.
 */
export const selectShownStrandId = (state: AppState): string | null =>
  state.selectedBlockId && state.loadSteps.some((step) => step.id === state.selectedBlockId)
    ? state.selectedBlockId
    : state.lastEditedLoadId
