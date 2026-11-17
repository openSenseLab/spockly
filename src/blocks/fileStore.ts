/**
 * The files students picked for "lade die Datei …", kept in memory only: they
 * never leave the browser. A block saves just the file's name; after closing
 * the tab the file has to be picked again. Across the reload of a language
 * switch, files are kept in sessionStorage (gone with the tab) if they fit.
 */

interface StoredFile {
  /** The name as picked, e.g. "Messung Klasse 9b.csv". */
  original: string
  text: string
}

const CARRY_KEY = 'spockly.carryFiles'
/** Larger sets of files aren't carried across a language switch (sessionStorage holds about 5 MB). */
const MAX_CARRY_CHARS = 4_000_000

/** By the name in Python and in Pyodide's file system, e.g. "Messung_Klasse_9b.csv". */
const files = new Map<string, StoredFile>()

// Files carried across the reload of a language switch; read once per page load.
try {
  const json = window.sessionStorage.getItem(CARRY_KEY)
  window.sessionStorage.removeItem(CARRY_KEY)
  for (const [name, file] of Object.entries(json ? (JSON.parse(json) as Record<string, StoredFile>) : {})) files.set(name, file)
} catch {
  // Nothing carried, or storage blocked: files are picked again.
}

/** Names the app itself uses in Pyodide's file system. */
const RESERVED = new Set(['spockly.py'])

/** A name Python can open without quoting trouble: letters, digits, dot, dash and underscore. */
export function safeName(name: string): string {
  const cleaned = name.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[_.]+|_+$/g, '') || 'datei'
  return RESERVED.has(cleaned) ? `daten_${cleaned}` : cleaned
}

/**
 * Keeps a picked file under its safe name and returns that name. A file with
 * the same name replaces the one before: picking it again after changing it
 * in a spreadsheet updates the data.
 */
export function addFile(original: string, text: string): string {
  const name = safeName(original)
  files.set(name, { original, text })
  return name
}

export const hasFile = (name: string) => files.has(name)

/** All picked files by their name in Python, for writing into Pyodide before a run. */
export const pythonFiles = (): Record<string, string> =>
  Object.fromEntries([...files].map(([name, file]) => [name, file.text]))

/**
 * A file's text. Files from a German Excel are often not UTF-8 but
 * Windows-1252; read as UTF-8, their umlauts would turn into "�".
 */
export function decodeFile(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Called before the language switch reloads the page. */
export function saveFilesForReload() {
  const all = Object.fromEntries(files)
  const json = JSON.stringify(all)
  if (json.length > MAX_CARRY_CHARS) return
  try {
    window.sessionStorage.setItem(CARRY_KEY, json)
  } catch {
    // Too big for this browser: the files are picked again after the switch.
  }
}
