import { useJournalStore } from '../journal/store'
import type { Schemas } from '../kernel/kernel'
import { loadedNames } from '../journal/workspaces'

/**
 * Where blocks get their surroundings from. The journal and the lab both use the
 * same blocks; only one of them is on screen at a time and installs its context.
 */
export type EditorContext = {
  /** Dataset names offered by "use dataset" / "join" / "count within" dropdowns. */
  datasetNames: (schemas: Schemas) => string[]
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
