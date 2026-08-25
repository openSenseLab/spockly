import { create } from 'zustand'

type WorkspaceMetrics = {
  totalBlocks: number
  topLevelBlocks: number
}

type AppState = WorkspaceMetrics & {
  activeLessonId: string
  generatedCode: string
  workspaceVersion: number
  setActiveLesson: (lessonId: string) => void
  resetWorkspace: () => void
  setGeneratedCode: (code: string) => void
  setWorkspaceMetrics: (metrics: WorkspaceMetrics) => void
}

const defaultCode = `import geopandas as gpd\n\n# Assemble a spatial workflow with blocks to generate Python.`

export const useAppStore = create<AppState>((set) => ({
  activeLessonId: 'neighbourhood-basics',
  generatedCode: defaultCode,
  totalBlocks: 0,
  topLevelBlocks: 0,
  workspaceVersion: 0,
  setActiveLesson: (lessonId) =>
    set((state) => ({
      activeLessonId: lessonId,
      workspaceVersion:
        state.activeLessonId === lessonId
          ? state.workspaceVersion
          : state.workspaceVersion + 1,
    })),
  resetWorkspace: () =>
    set((state) => ({
      workspaceVersion: state.workspaceVersion + 1,
    })),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
  setWorkspaceMetrics: ({ totalBlocks, topLevelBlocks }) =>
    set({ totalBlocks, topLevelBlocks }),
}))
