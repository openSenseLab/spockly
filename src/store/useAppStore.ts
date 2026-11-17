import { create } from 'zustand'

import { DEFAULT_PYTHON_CODE } from '../constants'
import type { RanSignatures } from '../blocks/runState'
import type { Snapshot } from '../core/fromPython'

type WorkspaceMetrics = {
  totalBlocks: number
  topLevelBlocks: number
}

type AppState = WorkspaceMetrics & {
  /** The Python code students see. */
  generatedCode: string
  /** The same code with the app's merke(…) lines after each step; this is what runs. */
  runCode: string
  workspaceVersion: number
  selectedBlockId: string | null
  /** How the data looked after each block in the last run, by block id. */
  snapshots: Record<string, Snapshot>
  resetWorkspace: () => void
  setGeneratedCode: (code: string, runCode: string) => void
  setWorkspaceMetrics: (metrics: WorkspaceMetrics) => void
  setSelectedBlockId: (id: string | null) => void
  /** Counts the files picked for "lade die Datei …": a new one means new data, even under the same name. */
  filesVersion: number
  filesChanged: () => void
  /** All of a run's snapshots at once, when the run ends (see usePythonRunner). */
  setSnapshots: (snapshots: Record<string, Snapshot>) => void
  /**
   * What the last "Ausführen" ran: its code, the picked files' version, and each
   * block as it was then (see blocks/runState). Null before the first run.
   */
  lastRun: { code: string; files: number; signatures: RanSignatures } | null
  setLastRun: (lastRun: AppState['lastRun']) => void
}

export const useAppStore = create<AppState>((set) => ({
  generatedCode: DEFAULT_PYTHON_CODE,
  runCode: DEFAULT_PYTHON_CODE,
  totalBlocks: 0,
  topLevelBlocks: 0,
  workspaceVersion: 0,
  selectedBlockId: null,
  snapshots: {},
  resetWorkspace: () =>
    set((state) => ({
      workspaceVersion: state.workspaceVersion + 1,
      snapshots: {},
      lastRun: null,
    })),
  setGeneratedCode: (generatedCode, runCode) => set({ generatedCode, runCode }),
  setWorkspaceMetrics: ({ totalBlocks, topLevelBlocks }) => set({ totalBlocks, topLevelBlocks }),
  setSelectedBlockId: (selectedBlockId) => set({ selectedBlockId }),
  setSnapshots: (snapshots) => set({ snapshots }),
  filesVersion: 0,
  filesChanged: () => set((state) => ({ filesVersion: state.filesVersion + 1 })),
  lastRun: null,
  setLastRun: (lastRun) => set({ lastRun }),
}))
