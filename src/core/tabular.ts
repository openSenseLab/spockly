/**
 * Data of unknown shape (a CSV file, a JSON or GeoJSON answer) → DataTable:
 * reading CSV, finding the records in JSON, and guessing what each column
 * is. Used by the file and the web address blocks. No network access here.
 */
import { isGeometry } from './geometry'
import type { ColumnMeta, DataTable, DatasetMeta, SemanticType } from './types'

// ---- CSV ----

export type Delimiter = ',' | ';' | '\t'
export const DELIMITERS: Delimiter[] = [';', ',', '\t']

/** Splits CSV text into lines of fields; quotes ("a;b", "say ""hi""") and line breaks inside quotes allowed. */
function splitCsv(text: string, delimiter: string): string[][] {
  const lines: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) {
      fields.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      fields.push(field)
      lines.push(fields)
      fields = []
      field = ''
    } else field += c
  }
  if (field !== '' || fields.length) {
    fields.push(field)
    lines.push(fields)
  }
  // Empty lines (e.g. at the end of the file) are no records.
  return lines.filter((l) => l.length > 1 || l[0] !== '')
}

/**
 * The delimiter that splits the first lines into the same number of fields,
 * most fields winning. German spreadsheets write ";" (the comma is their
 * decimal sign), most other sources ",".
 */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.slice(0, 20_000)
  let best: { delimiter: Delimiter; fields: number } = { delimiter: ',', fields: 1 }
  for (const delimiter of DELIMITERS) {
    const lines = splitCsv(sample, delimiter).slice(0, 10)
    if (lines.length === 0) continue
    // The last sampled line may be cut off in the middle.
    const counts = (lines.length > 2 ? lines.slice(0, -1) : lines).map((l) => l.length)
    if (counts.every((n) => n === counts[0]) && counts[0] > best.fields) best = { delimiter, fields: counts[0] }
  }
  return best.delimiter
}

export interface CsvText {
  fields: string[]
  records: Record<string, string>[]
  delimiter: Delimiter
}

/** Column names that can be used: empty ones get "spalte_3", repeated ones "name_2". */
function uniqueFields(header: string[]): string[] {
  const seen = new Map<string, number>()
  return header.map((raw, i) => {
    const base = raw.trim() || `spalte_${i + 1}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}_${n}`
  })
}

/** Reads CSV text with a header line. */
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): CsvText {
  const lines = splitCsv(text.replace(/^﻿/, ''), delimiter)
  const fields = uniqueFields(lines[0] ?? [])
  const records = lines.slice(1).map((line) => Object.fromEntries(fields.map((f, i) => [f, line[i] ?? ''])))
  return { fields, records, delimiter }
}

// ---- JSON ----

export interface JsonRecords {
  fields: string[]
  records: Record<string, unknown>[]
  /** Where the records were found, e.g. ["weather"]; empty for a top-level list. */
  path: string[]
  kind: 'geojson' | 'json'
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Nested objects become columns joined with "_" ({"water": {"longname": …}}
 * → water_longname), like pandas' json_normalize(sep="_"). Lists of plain
 * values become text ("a, b"); anything deeper is kept as JSON text.
 * Geometries stay whole.
 */
function flatten(value: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [key, v] of Object.entries(value)) {
    const name = prefix ? `${prefix}_${key}` : key
    if (isPlainObject(v) && !isGeometry(v)) flatten(v, name, out)
    else if (Array.isArray(v)) out[name] = v.every((x) => x === null || typeof x !== 'object') ? v.join(', ') : JSON.stringify(v)
    else out[name] = v
  }
  return out
}

const fieldsOf = (records: Record<string, unknown>[]) => [...new Set(records.flatMap((r) => Object.keys(r)))]

const isFeatureCollection = (v: unknown): v is { features: unknown[] } =>
  isPlainObject(v) && v.type === 'FeatureCollection' && Array.isArray(v.features)

/** The longest list of objects within a few levels, e.g. {"weather": [...]} or {"data": {"items": [...]}}. */
function findList(value: unknown, path: string[] = [], depth = 0): { list: Record<string, unknown>[]; path: string[] } | null {
  if (Array.isArray(value)) return value.some(isPlainObject) ? { list: value.filter(isPlainObject), path } : null
  if (!isPlainObject(value) || depth > 3) return null
  let best: { list: Record<string, unknown>[]; path: string[] } | null = null
  for (const [key, v] of Object.entries(value)) {
    const found = findList(v, [...path, key], depth + 1)
    if (found && found.list.length > (best?.list.length ?? 0)) best = found
  }
  return best
}

/**
 * The records in a JSON document: the features of GeoJSON (properties plus
 * a "geometry" column), a list of objects, or the longest such list inside
 * an object. A single object is one record; a list of plain values one
 * column "wert".
 */
export function recordsFromJson(json: unknown): JsonRecords {
  if (isFeatureCollection(json)) {
    const records = json.features.filter(isPlainObject).map((f) => ({
      ...flatten(isPlainObject(f.properties) ? f.properties : {}),
      geometry: isGeometry(f.geometry) ? f.geometry : null,
    }))
    return { fields: fieldsOf(records), records, path: ['features'], kind: 'geojson' }
  }
  if (Array.isArray(json) && json.length && json.every((v) => v === null || typeof v !== 'object')) {
    const records = json.map((wert) => ({ wert }))
    return { fields: ['wert'], records, path: [], kind: 'json' }
  }
  const found = findList(json)
  const records = (found ? found.list : isPlainObject(json) ? [json] : []).map((r) => flatten(r))
  return { fields: fieldsOf(records), records, path: found?.path ?? [], kind: 'json' }
}

// ---- What each column is ----

/** Words for "no value" in text files; only read as missing in number and date columns ("NA" is also Namibia). */
const MISSING_WORDS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '-'])
const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && MISSING_WORDS.has(v.trim().toLowerCase()))

const NUMBER_EN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
/** German: decimal comma, optional dots between thousands ("1.234,5"). */
const NUMBER_DE = /^[+-]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/

/** Reads a number column: decimal comma if any value has a comma, decimal point otherwise. Null if not a number column. */
function readNumbers(values: unknown[]): (number | null)[] | null {
  const texts = values.filter((v) => !isBlank(v))
  if (texts.length === 0) return null
  const strings = texts.filter((v): v is string => typeof v === 'string').map((s) => s.trim())
  if (texts.some((v) => typeof v !== 'number' && typeof v !== 'string')) return null
  // Leading zeros (postcodes, ids like 0049) are text, not numbers.
  if (strings.some((s) => /^[+-]?0\d/.test(s))) return null
  const german = strings.some((s) => s.includes(','))
  if (!strings.every((s) => (german ? NUMBER_DE : NUMBER_EN).test(s))) return null
  return values.map((v) => {
    if (isBlank(v)) return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const s = (v as string).trim()
    return Number(german ? s.replace(/\./g, '').replace(',', '.') : s)
  })
}

const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/
const DE_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

/** "2025-01-31 14:00" → "2025-01-31T14:00", "31.01.2025" → "2025-01-31"; null if not a date. */
function toIsoDate(text: string): string | null {
  const s = text.trim()
  if (ISO_DATE.test(s)) return s.replace(' ', 'T')
  const m = s.match(DE_DATE)
  if (!m) return null
  const [, d, mo, y, h, mi, sec] = m
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  return h ? `${date}T${h.padStart(2, '0')}:${mi}${sec ? `:${sec}` : ''}` : date
}

function readDates(values: unknown[]): (string | null)[] | null {
  const filled = values.filter((v) => !isBlank(v))
  if (filled.length === 0 || !filled.every((v) => typeof v === 'string' && toIsoDate(v))) return null
  return values.map((v) => (isBlank(v) ? null : toIsoDate(v as string)))
}

const TIME_NAME = /(time|date|zeit|datum|updated|timestamp)/i
const YEAR_NAME = /^(year|jahr)$/i
const LAT_NAME = /^(lat|latitude|breite|breitengrad)$|_(lat|latitude)$/i
const LON_NAME = /^(lon|lng|long|longitude|länge|laenge|längengrad)$|_(lon|lng|longitude)$/i
const IDENTIFIER_NAME = /(^|_)(id|uid|uuid|code|key|nr|nummer|number|plz)(_|$)/i
/** A text column with at most this many distinct values counts as a category. */
const MAX_CATEGORY_VALUES = 20

/** Milliseconds since 1970 (USGS "time"): between 1973 and 2286. */
const looksLikeEpochMs = (name: string, numbers: (number | null)[]) =>
  TIME_NAME.test(name) && numbers.every((n) => n === null || (Number.isInteger(n) && n > 1e11 && n < 1e13))

interface Guess {
  column: ColumnMeta
  values: unknown[]
}

function guessColumn(name: string, values: unknown[]): Guess {
  const base = { name, label: { de: name, en: name } }
  if (values.some((v) => !isBlank(v)) && values.every((v) => isBlank(v) || isGeometry(v))) {
    return { column: { ...base, dataType: 'geometry', semanticType: 'geometry' }, values: values.map((v) => (isBlank(v) ? null : v)) }
  }
  if (values.every((v) => isBlank(v) || typeof v === 'boolean' || (typeof v === 'string' && /^(true|false)$/i.test(v)))) {
    if (values.some((v) => !isBlank(v))) {
      const bools = values.map((v) => (isBlank(v) ? null : typeof v === 'boolean' ? v : v === 'true' || v === 'TRUE' || v === 'True'))
      return { column: { ...base, dataType: 'boolean', semanticType: 'category' }, values: bools }
    }
  }
  const numbers = readNumbers(values)
  if (numbers) {
    if (looksLikeEpochMs(name, numbers)) {
      const dates = numbers.map((n) => (n === null ? null : new Date(n).toISOString()))
      return { column: { ...base, dataType: 'date', semanticType: 'timestamp' }, values: dates }
    }
    if (YEAR_NAME.test(name) && numbers.every((n) => n === null || (Number.isInteger(n) && n >= 1000 && n <= 2999))) {
      return { column: { ...base, dataType: 'date', semanticType: 'timestamp' }, values: numbers.map((n) => (n === null ? null : String(n))) }
    }
    // Ids written as text in JSON ("number": "27800040") stay text: they are names, not quantities.
    if (IDENTIFIER_NAME.test(name) && values.some((v) => typeof v === 'string') && !values.some((v) => typeof v === 'number')) {
      return { column: { ...base, dataType: 'string', semanticType: 'identifier' }, values: values.map((v) => (isBlank(v) ? null : String(v))) }
    }
    const within = (limit: number) => numbers.every((n) => n === null || Math.abs(n) <= limit)
    const semanticType: SemanticType =
      LAT_NAME.test(name) && within(90) ? 'latitude'
      : LON_NAME.test(name) && within(180) ? 'longitude'
      : IDENTIFIER_NAME.test(name) ? 'identifier'
      : 'measurement'
    const unit = semanticType === 'latitude' || semanticType === 'longitude' ? '°' : undefined
    return { column: { ...base, dataType: 'number', semanticType, unit }, values: numbers }
  }
  const dates = readDates(values)
  if (dates) return { column: { ...base, dataType: 'date', semanticType: 'timestamp' }, values: dates }

  // Text: kept as written; objects that are left over become JSON text.
  const texts = values.map((v) => (v === null || v === undefined || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : String(v)))
  const filled = texts.filter((v): v is string => v !== null)
  const distinct = new Set(filled).size
  // Values must repeat on average, otherwise it's free text (or too sparse to tell).
  const semanticType: SemanticType = IDENTIFIER_NAME.test(name)
    ? 'identifier'
    : distinct > 0 && distinct <= MAX_CATEGORY_VALUES && distinct <= filled.length / 2
      ? 'category'
      : 'text'
  return { column: { ...base, dataType: 'string', semanticType }, values: texts }
}

/** Most rows a file or web address may bring; more are left out (with a note). */
export const MAX_ROWS = 50_000

export interface GuessedTable {
  columns: ColumnMeta[]
  rows: Record<string, unknown>[]
  /** Rows in the source, before MAX_ROWS. */
  total: number
}

/** Works out each column's type from its values and converts them (numbers, ISO dates, geometries). */
export function guessTable(fields: string[], records: Record<string, unknown>[], maxRows = MAX_ROWS): GuessedTable {
  const kept = records.slice(0, maxRows)
  const guesses = fields.map((name) => guessColumn(name, kept.map((r) => r[name])))
  const rows = kept.map((_, i) => Object.fromEntries(guesses.map((g) => [g.column.name, g.values[i]])))
  return { columns: guesses.map((g) => g.column), rows, total: records.length }
}

/** The DataTable, with notes on rows left out and the unknown licence. */
export function toTable(guessed: GuessedTable, meta: DatasetMeta): DataTable {
  const issues = [...(meta.knownIssues ?? [])]
  if (guessed.total > guessed.rows.length) {
    const [shown, total] = [guessed.rows.length, guessed.total]
    issues.unshift({
      de: `Nur die ersten ${shown.toLocaleString('de-DE')} von ${total.toLocaleString('de-DE')} Zeilen wurden geladen.`,
      en: `Only the first ${shown.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} rows were loaded.`,
    })
  }
  return {
    meta: { ...meta, totalRecords: guessed.total, knownIssues: issues.length ? issues : undefined },
    columns: guessed.columns,
    rows: guessed.rows,
  }
}

/** Python code that reaches the records at `path`, e.g. daten["data"]["items"]. */
export const pythonPath = (variable: string, path: string[]) => variable + path.map((key) => `[${JSON.stringify(key)}]`).join('')

// ---- Text of unknown format ----

export type DataFormat = 'csv' | 'json' | 'geojson'

/** How a text was read; kept with the block so the app and the Python code read it the same way. */
export interface ReadSettings {
  format: DataFormat
  /** CSV only. */
  delimiter?: Delimiter
  /** JSON only: where the records are, e.g. ["weather"]. */
  path?: string[]
}

export interface ReadResult extends ReadSettings {
  fields: string[]
  records: Record<string, unknown>[]
}

const looksLikeJson = (text: string, contentType = '', name = '') =>
  /json/i.test(contentType) || /\.(geo)?json$/i.test(name) || /^\s*[[{]/.test(text.slice(0, 1000))

/** Follows `path` into the JSON; null if it doesn't lead to a list or object any more. */
function atPath(json: unknown, path: string[]): unknown {
  let value = json
  for (const key of path) {
    if (!isPlainObject(value)) return null
    value = value[key]
  }
  return value
}

/**
 * Reads CSV, JSON or GeoJSON. Without settings the format, delimiter and
 * place of the records are worked out; with settings (from an earlier read)
 * they are used as long as they still fit the text. Throws SyntaxError for
 * broken JSON.
 */
export function readData(text: string, hint: { settings?: ReadSettings; contentType?: string; name?: string } = {}): ReadResult {
  const settings = hint.settings
  const json = settings ? settings.format !== 'csv' : looksLikeJson(text, hint.contentType, hint.name)
  if (!json) {
    const csv = parseCsv(text, settings?.delimiter ?? detectDelimiter(text))
    return { format: 'csv', delimiter: csv.delimiter, fields: csv.fields, records: csv.records }
  }
  const parsed: unknown = JSON.parse(text)
  // The records where they were found before (a list of objects there), else search again.
  if (settings?.format === 'json' && settings.path?.length) {
    const list = atPath(parsed, settings.path)
    if (Array.isArray(list) && list.some(isPlainObject)) {
      const records = list.filter(isPlainObject).map((r) => flatten(r))
      return { format: 'json', path: settings.path, fields: fieldsOf(records), records }
    }
  }
  const found = recordsFromJson(parsed)
  return { format: found.kind, path: found.path, fields: found.fields, records: found.records }
}

/** Short description for the block and the setup window, e.g. "CSV (;)" or "JSON: weather". */
export function formatText({ format, delimiter, path }: ReadSettings): string {
  if (format === 'csv') return `CSV (${delimiter === '\t' ? 'Tab' : (delimiter ?? ',')})`
  if (format === 'geojson') return 'GeoJSON'
  return path?.length ? `JSON: ${path.join('.')}` : 'JSON'
}

// ---- Python ----

/**
 * Python lines that turn `source` (a file name or an expression giving the
 * text) into the DataFrame `output`, read like the app reads it.
 */
export function pythonReader(settings: ReadSettings, source: { file: string } | { text: string }, output: string): string {
  const { format, delimiter, path = [] } = settings
  if (format === 'csv') {
    const from = 'file' in source ? JSON.stringify(source.file) : `io.StringIO(${source.text})`
    // A ";" file is a German spreadsheet: decimal comma.
    const decimal = delimiter === ';' ? ', decimal=","' : ''
    return `${output} = pd.read_csv(${from}, sep=${JSON.stringify(delimiter ?? ',')}${decimal})`
  }
  const load = 'file' in source ? `json.load(open(${JSON.stringify(source.file)}, encoding="utf-8"))` : `json.loads(${source.text})`
  if (format === 'geojson') {
    return (
      `daten = ${load}\n` +
      `merkmale = daten["features"]  # GeoJSON: ein Merkmal je Zeile\n` +
      `${output} = pd.json_normalize([m["properties"] or {} for m in merkmale], sep="_")\n` +
      `${output}["geometry"] = [m["geometry"] for m in merkmale]`
    )
  }
  return `daten = ${load}\n${output} = pd.json_normalize(${pythonPath('daten', path)}, sep="_")`
}
