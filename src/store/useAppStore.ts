import { create } from 'zustand'
import { DEFAULT_PYTHON_CODE } from '../constants'

type WorkspaceMetrics = {
  totalBlocks: number
  topLevelBlocks: number
}

type AppState = WorkspaceMetrics & {
  generatedCode: string
  workspaceVersion: number
  resetWorkspace: () => void
  setGeneratedCode: (code: string) => void
  setWorkspaceMetrics: (metrics: WorkspaceMetrics) => void
}

export const useAppStore = create<AppState>((set) => ({
  generatedCode: DEFAULT_PYTHON_CODE,
  totalBlocks: 0,
  topLevelBlocks: 0,
  workspaceVersion: 0,
  resetWorkspace: () =>
    set((state) => ({
      workspaceVersion: state.workspaceVersion + 1,
    })),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
  setWorkspaceMetrics: ({ totalBlocks, topLevelBlocks }) =>
    set({ totalBlocks, topLevelBlocks }),
}))
