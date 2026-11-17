/**
 * What a "zeige …" block sends from Python (spockly.py) → a DataTable the
 * map, time chart and table can draw. Column types come from pandas' dtypes;
 * the block's choices (which column is the latitude, the colour, the time …)
 * decide each column's role.
 */
import { isGeometry } from './geometry'
import type { ColumnMeta, DataTable, DataType, SemanticType } from './types'

/** The JSON spockly.py's _paket() writes. */
export interface PythonTable {
  spalten: string[]
  typen: Record<string, string>
  zeilen: unknown[][]
  /** Rows of the whole table; `zeilen` may be cut to the first HOECHSTENS. */
  anzahl: number
}

export type ViewKind = 'tabelle' | 'karte' | 'zeitverlauf'

/** The block's choices, as spockly.py sends them. */
export interface ViewOptions {
  breite?: string | null
  /** A column of whole shapes (GeoJSON geometries), in place of breite and laenge. */
  form?: string | null
  laenge?: string | null
  farbe?: string | null
  /** The columns the map's tooltip shows, as chosen in the block. */
  info?: string[] | null
  zeit?: string | null
  wert?: string | null
  je?: string | null
}

export interface View {
  kind: ViewKind
  /** The dataset's name, e.g. "messwerte". */
  title: string
  table: DataTable
  /** As Python sent it, with pandas' column types (for the table view). */
  raw: PythonTable
  options: ViewOptions
}

/** A text column with at most this many distinct values counts as a category. */
const MAX_CATEGORY_VALUES = 20

function dataTypeOf(dtype: string, values: unknown[]): DataType {
  if (/^datetime64/.test(dtype)) return 'date'
  if (/^(u?int|float|Int|UInt|Float)/.test(dtype)) return 'number'
  if (/^bool/.test(dtype)) return 'boolean'
  const filled = values.filter((v) => v !== null && v !== undefined)
  if (filled.length && filled.every(isGeometry)) return 'geometry'
  return 'string'
}

function semanticTypeOf(dataType: DataType, values: unknown[]): SemanticType {
  if (dataType === 'date') return 'timestamp'
  if (dataType === 'number') return 'measurement'
  if (dataType === 'boolean') return 'category'
  if (dataType === 'geometry') return 'geometry'
  const filled = values.filter((v): v is string => typeof v === 'string' && v !== '')
  const distinct = new Set(filled).size
  // Values must repeat on average, otherwise it's free text.
  return distinct > 0 && distinct <= MAX_CATEGORY_VALUES && distinct <= filled.length / 2 ? 'category' : 'text'
}

/** Objects and lists that aren't shapes are shown as JSON text. */
const cell = (value: unknown, dataType: DataType) =>
  dataType !== 'geometry' && value !== null && typeof value === 'object' ? JSON.stringify(value) : value

/**
 * The table, with each column's role set by the view: a map needs its
 * latitude and longitude and colours by one column; a time chart needs its
 * time and value columns. The other number columns aren't offered as
 * measurements there, so the map and chart show what the block asked for.
 */
export function tableFromPython(data: PythonTable, kind: ViewKind, options: ViewOptions, title: string): DataTable {
  const { spalten, typen, zeilen } = data
  const columns: ColumnMeta[] = spalten.map((name, i) => {
    const values = zeilen.map((row) => row[i])
    let dataType = dataTypeOf(typen[name] ?? 'object', values)
    let semanticType = semanticTypeOf(dataType, values)
    // The map draws the shapes of the chosen column only; a point map draws none.
    if (dataType === 'geometry' && kind === 'karte' && name !== options.form) {
      dataType = 'string'
      semanticType = 'text'
    }
    if (kind === 'karte') {
      if (name === options.breite) semanticType = 'latitude'
      else if (name === options.laenge) semanticType = 'longitude'
      else if (semanticType === 'measurement' && name !== options.farbe) semanticType = 'text'
    }
    if (kind === 'zeitverlauf') {
      if (name === options.zeit) semanticType = 'timestamp'
      else if (semanticType === 'timestamp') semanticType = 'text'
      if (semanticType === 'measurement' && name !== options.wert) semanticType = 'text'
      if (name === options.je) semanticType = 'category'
    }
    const unit = semanticType === 'latitude' || semanticType === 'longitude' ? '°' : undefined
    return { name, label: { de: name, en: name }, dataType, semanticType, unit }
  })
  const rows = zeilen.map((row) => Object.fromEntries(columns.map((c, i) => [c.name, cell(row[i], c.dataType) ?? null])))
  return {
    meta: {
      id: `python:${title}`,
      title: { de: title, en: title },
      source: { name: 'Python' },
      totalRecords: data.anzahl,
      ...(kind === 'karte' && options.info?.length ? { tooltipColumns: options.info } : {}),
    },
    columns,
    rows,
  }
}

export function viewFrom(message: { kind: string; title: string; data: string; options: string }): View {
  const kind = (['tabelle', 'karte', 'zeitverlauf'].includes(message.kind) ? message.kind : 'tabelle') as ViewKind
  const options = JSON.parse(message.options) as ViewOptions
  const raw = JSON.parse(message.data) as PythonTable
  return { kind, title: message.title, options, raw, table: tableFromPython(raw, kind, options, message.title) }
}

/** How the data looked after one block (spockly.py's _zwischenstand). */
export type Snapshot =
  | {
      art: 'tabelle'
      spalten: string[]
      typen: Record<string, string>
      zeilen: unknown[][]
      anzahl: number
      /** Distinct values per column, in all rows (`zeilen` are only the first); not for columns of lists. */
      verschieden?: Record<string, number>
    }
  | { art: 'text' | 'json' | 'anderes'; text: string; anzahl: number | null }

export const snapshotFrom = (data: string) => JSON.parse(data) as Snapshot

/** The columns after a block, if its data was a table. */
export const columnsOf = (snapshot: Snapshot | undefined) => (snapshot?.art === 'tabelle' ? snapshot.spalten : null)
