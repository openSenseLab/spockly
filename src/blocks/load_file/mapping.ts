/** A picked file → DataTable, and the block's settings. No network access here. */
import { LoadError } from '../../core/http'
import { DELIMITERS, guessTable, readData, toTable, type ReadSettings } from '../../core/tabular'
import type { DataTable } from '../../core/types'
import type { StoredFile } from './store'

export interface LoadFileParams {
  /** Id in the file store; empty until a file is picked. */
  fileId: string
  /** Name as picked, and the name in Python. */
  name: string
  file: string
  read?: ReadSettings
}

export const NO_FILE: LoadFileParams = { fileId: '', name: '', file: '' }

/** Larger files are refused: reading them would freeze the page. */
export const MAX_FILE_BYTES = 30_000_000

/** File types the picker offers. */
export const FILE_TYPES = '.csv,.tsv,.txt,.json,.geojson'

const isReadSettings = (v: unknown): v is ReadSettings => {
  const r = v as ReadSettings | undefined
  return (
    !!r &&
    (r.format === 'csv' || r.format === 'json' || r.format === 'geojson') &&
    (r.delimiter === undefined || DELIMITERS.includes(r.delimiter)) &&
    (r.path === undefined || (Array.isArray(r.path) && r.path.every((k) => typeof k === 'string')))
  )
}

/** Checks params coming from a saved block; anything odd means "no file". */
export function normalizeFileParams(raw: unknown): LoadFileParams {
  const r = (raw ?? {}) as Partial<LoadFileParams>
  if (typeof r.fileId !== 'string' || typeof r.name !== 'string' || typeof r.file !== 'string') return { ...NO_FILE }
  return { fileId: r.fileId, name: r.name, file: r.file, read: isReadSettings(r.read) ? r.read : undefined }
}

/** The file as a table, read with the settings from the setup window, column types guessed. */
export function toFileTable(params: LoadFileParams, stored: StoredFile): DataTable {
  let read
  try {
    read = readData(stored.text, { settings: params.read, name: stored.name })
  } catch (error) {
    throw new LoadError('load.file.badJson', String(error))
  }
  if (read.records.length === 0 || read.fields.length === 0) throw new LoadError('load.file.empty', stored.name)
  return toTable(guessTable(read.fields, read.records), {
    id: `file:${params.fileId}`,
    title: { de: stored.name, en: stored.name },
    description: {
      de:
        'Deine eigene Datei. Sie bleibt in deinem Browser und wird nirgendwohin hochgeladen. ' +
        'Welche Spalte Zahlen, Zeiten oder Orte enthält, hat SPOCKLY aus den Werten erraten – prüf es in der Tabelle.',
      en:
        'Your own file. It stays in your browser and is not uploaded anywhere. ' +
        'Which columns hold numbers, times or places was guessed from the values – check it in the table.',
    },
    source: { name: stored.name },
  })
}
