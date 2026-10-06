import { create } from 'zustand'
import { DEFAULT_PYTHON_CODE } from '../constants'
import type { DsMode } from '../components/blockly/modes/types'

type WorkspaceMetrics = {
  totalBlocks: number
  topLevelBlocks: number
}

type OutputImage = {
  name: string
  dataUrl: string
}

type AppState = WorkspaceMetrics & {
  generatedCode: string
  uploadedCsv: string | null
  outputImages: OutputImage[]
  workspaceVersion: number
  dsMode: DsMode
  /** True when the workspace has been edited since the last run. */
  resultsStale: boolean
  resetWorkspace: () => void
  setGeneratedCode: (code: string) => void
  setUploadedCsv: (csv: string | null) => void
  setOutputImages: (images: OutputImage[]) => void
  setWorkspaceMetrics: (metrics: WorkspaceMetrics) => void
  setDsMode: (mode: DsMode) => void
  setResultsStale: (stale: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  generatedCode: DEFAULT_PYTHON_CODE,
  uploadedCsv: null,
  outputImages: [],
  totalBlocks: 0,
  topLevelBlocks: 0,
  workspaceVersion: 0,
  dsMode: 'steps',
  resultsStale: false,
  resetWorkspace: () =>
    set((state) => ({
      workspaceVersion: state.workspaceVersion + 1,
    })),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
  setUploadedCsv: (uploadedCsv) => set({ uploadedCsv }),
  setOutputImages: (outputImages) => set({ outputImages }),
  setWorkspaceMetrics: ({ totalBlocks, topLevelBlocks }) =>
    set({ totalBlocks, topLevelBlocks }),
  setDsMode: (dsMode) => set({ dsMode }),
  setResultsStale: (resultsStale) => set({ resultsStale }),
}))
