/**
 * Files students picked, kept in memory only: they never leave the browser.
 * A block saves just the file's id and name; after closing the tab the file
 * has to be picked again. To survive the reload of a language switch, small
 * files are kept in sessionStorage (gone with the tab).
 */

export interface StoredFile {
  /** Name as picked, e.g. "Messung Klasse 9b.csv". */
  name: string
  /** Name in the Python code and in Pyodide's file system, e.g. "Messung_Klasse_9b.csv". */
  file: string
  text: string
}

const CARRY_KEY = 'spockly.carryFiles'
/** Larger sets of files aren't carried across a language switch. */
const MAX_CARRY_CHARS = 4_000_000

const files = new Map<string, StoredFile>()

// Files carried across the reload of a language switch; read once per page load.
try {
  const json = window.sessionStorage.getItem(CARRY_KEY)
  window.sessionStorage.removeItem(CARRY_KEY)
  for (const [id, file] of Object.entries(json ? (JSON.parse(json) as Record<string, StoredFile>) : {})) files.set(id, file)
} catch {
  // Nothing carried, or storage blocked: files are picked again.
}

/** A name Python can open without quoting trouble, unique among the picked files. */
function safeName(name: string): string {
  const cleaned = name.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '') || 'datei'
  const taken = new Set([...files.values()].map((f) => f.file))
  if (!taken.has(cleaned)) return cleaned
  const dot = cleaned.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [cleaned.slice(0, dot), cleaned.slice(dot)] : [cleaned, '']
  let n = 2
  while (taken.has(`${stem}_${n}${ext}`)) n++
  return `${stem}_${n}${ext}`
}

/** Keeps a picked file; returns its id and its name for Python. */
export function addFile(name: string, text: string): { id: string; file: string } {
  // The same file picked again (same name and content) keeps its id, so the load is cached.
  for (const [id, stored] of files) if (stored.name === name && stored.text === text) return { id, file: stored.file }
  const id = crypto.randomUUID()
  const file = safeName(name)
  files.set(id, { name, file, text })
  return { id, file }
}

export const getFile = (id: string) => files.get(id)

/** All picked files by their Python name, for writing into Pyodide before a run. */
export const pythonFiles = (): Record<string, string> => Object.fromEntries([...files.values()].map((f) => [f.file, f.text]))

/** Called before the language switch reloads the page. */
export function saveFilesForReload() {
  const all = Object.fromEntries(files)
  const size = [...files.values()].reduce((sum, f) => sum + f.text.length, 0)
  if (size === 0 || size > MAX_CARRY_CHARS) return
  try {
    window.sessionStorage.setItem(CARRY_KEY, JSON.stringify(all))
  } catch {
    // Storage full or blocked: the files have to be picked again.
  }
}

/** For tests. */
export const clearFiles = () => files.clear()
