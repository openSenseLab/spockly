import { useJournalStore } from '../journal/store'
import type { Schemas } from '../kernel/kernel'
import { loadedNames } from '../journal/workspaces'
import type { Selection } from '../journal/types'
import { selectionsInState } from './reference'
import { valuesInState, type ValueInfo } from './values'

/**
 * Where blocks get their surroundings from. The journal and the lab both use the
 * same blocks; only one of them is on screen at a time and installs its context.
 */
export type EditorContext = {
  /** Dataset names offered by "use dataset" / "join" / "count within" dropdowns. */
  datasetNames: (schemas: Schemas) => string[]
  /** Values taken in data blocks ("take value … as …"), with their type, for the "value" block. */
  values: () => ValueInfo[]
  /** Selections made in the Select tab ("select … as …" blocks in data blocks). */
  selections: () => Selection[]
  /** Keep an uploaded file so "load file" blocks can read it when they run. */
  addFile: (name: string, content: string) => void
  /** Content of an uploaded file (to pick read_csv options in the generated code). */
  fileContent: (name: string) => string | undefined
}

export const journalContext: EditorContext = {
  datasetNames: (schemas) => {
    const names = new Set<string>()
    for (const cell of useJournalStore.getState().journal.cells) {
      if (cell.type === 'data') loadedNames(cell.workspace).forEach((name) => names.add(name))
    }
    Object.keys(schemas).forEach((name) => names.add(name))
    return [...names]
  },
  values: () => useJournalStore.getState().journal.cells.flatMap((cell) => (cell.type === 'data' ? valuesInState(cell.workspace) : [])),
  selections: () => useJournalStore.getState().journal.cells.flatMap((cell) => (cell.type === 'data' ? selectionsInState(cell.workspace) : [])),
  addFile: (name, content) => useJournalStore.getState().addFile(name, content),
  fileContent: (name) => useJournalStore.getState().journal.files[name],
}

let current: EditorContext = journalContext

export const getEditorContext = () => current

/** Install a context; returns a function that restores the journal context. */
export const installEditorContext = (context: EditorContext) => {
  current = context
  return () => {
    current = journalContext
  }
}
