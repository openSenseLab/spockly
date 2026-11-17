import { isGeometry } from './geometry'
import type { DataTable, Geometry } from './types'

/** More distinct places than this are not drawn (the map would be unreadable and slow). */
export const MAX_MAP_POINTS = 5000

/** How the values of one place become the one value its dot is coloured by. */
export type PlaceStat = 'mean' | 'max' | 'min' | 'latest'

export interface PlaceValues {
  /** Rows at this place that have a value. */
  count: number
  mean: number
  min: number
  max: number
  /** Value of the newest row (by the time column; without one, the last row). */
  latest: number
  /** Time of the newest row, if the table has a time column. */
  latestAt?: string
}

export interface MapPoint {
  lat: number
  lon: number
  /** Name of the place, from the first category or text column (e.g. the station name). */
  label?: string
  /** Rows at this place, e.g. all measurements of one station. */
  rows: number
  /** Per measurement column; a column without any value at this place is missing. */
  values: Record<string, PlaceValues>
  /** More of the place's text, e.g. its address: [column, value], for the tooltip. */
  details?: Detail[]
}

/** A column's text in one row, for the tooltip: [column, value]. */
export type Detail = [column: string, value: string]

/** So many details at most, each so long at most: a tooltip, not the whole row. */
const MAX_DETAILS = 5
const MAX_DETAIL_LENGTH = 80

export interface MapPoints {
  points: MapPoint[]
  /** Rows without usable coordinates. */
  withoutPlace: number
  /** Places left out because of MAX_MAP_POINTS. */
  leftOut: number
}

const isLat = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90
const isLon = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180
const isValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

interface Running {
  count: number
  sum: number
  min: number
  max: number
  latest: number
  latestAt?: string
}

/** Columns of words: text or categories that really hold text (not numbers only shown as text, like X and Y). */
const wordColumns = (table: DataTable) =>
  table.columns.filter((c) => (c.semanticType === 'text' || c.semanticType === 'category') && c.dataType === 'string')

/**
 * The column that names a place or shape: one called "…name…", else one
 * called "…title…", else the first column of words with a different value in
 * each row (like "Premises"), else the first column of words. A name before a
 * title: in openSenseMap's sensor rows, station_name names the place, while
 * sensor_title (coming first) is only one of its sensors.
 */
export function labelColumn(table: DataTable): string | undefined {
  const words = wordColumns(table)
  const named =
    words.find((c) => /(^|_)(name|bezeichnung)/i.test(c.name)) ?? words.find((c) => /(^|_)(titel|title)/i.test(c.name))
  const distinct = words.find((c) => {
    const filled = table.rows.map((row) => row[c.name]).filter((v) => typeof v === 'string' && v.trim() !== '')
    return filled.length > 0 && new Set(filled).size === filled.length
  })
  return (named ?? distinct ?? words[0])?.name
}

/** The other columns of words a tooltip shows, e.g. address and town: not the name, it is the title already. */
const detailColumns = (table: DataTable, label: string | undefined) => wordColumns(table).filter((c) => c.name !== label).map((c) => c.name)

/** So many different values of a chosen column at most, for a place of many rows (a station's sensors). */
const MAX_VALUES = 8

/** A value as the tooltip shows it, or null for nothing to show (empty, or an object like a shape). */
function shownValue(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === 'object') return null
  const text = String(value).trim().replace(/\s+/g, ' ')
  if (!text) return null
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH - 1)}…` : text
}

/** The different values of each chosen column, collected over the rows of one place. */
class ChosenValues {
  private readonly values = new Map<string, string[]>()
  private readonly columns: readonly string[]

  constructor(columns: readonly string[]) {
    this.columns = columns
  }

  add(row: Record<string, unknown>) {
    for (const column of this.columns) {
      const text = shownValue(row[column])
      if (text === null) continue
      const seen = this.values.get(column) ?? []
      if (!seen.includes(text)) seen.push(text)
      this.values.set(column, seen)
    }
  }

  /** One line per column, its values in the order they came; past MAX_VALUES, how many more. */
  details(): Detail[] {
    return this.columns.flatMap((column): Detail[] => {
      const seen = this.values.get(column)
      if (!seen?.length) return []
      const more = seen.length > MAX_VALUES ? ` … (+${seen.length - MAX_VALUES})` : ''
      return [[column, seen.slice(0, MAX_VALUES).join(', ') + more]]
    })
  }
}

/** A row's details for the tooltip: its filled columns of words, shortened. */
function detailsOf(row: Record<string, unknown>, columns: string[]): Detail[] {
  const details: Detail[] = []
  for (const column of columns) {
    const value = row[column]
    if (typeof value !== 'string' || !value.trim()) continue
    const text = value.trim().replace(/\s+/g, ' ')
    details.push([column, text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH - 1)}…` : text])
    if (details.length === MAX_DETAILS) break
  }
  return details
}

/**
 * One point per place: rows with the same coordinates (a station measuring
 * every few minutes) become one point. Null when the table has no
 * latitude/longitude columns. Values are only read from `measures`, so the
 * caller decides what may appear on the map (not a column hidden for a guess).
 */
export function mapPointsOf(table: DataTable, measures: readonly string[] = []): MapPoints | null {
  const lat = table.columns.find((c) => c.semanticType === 'latitude')?.name
  const lon = table.columns.find((c) => c.semanticType === 'longitude')?.name
  if (!lat || !lon) return null
  const name = labelColumn(table)
  const others = detailColumns(table, name)
  const time = table.columns.find((c) => c.semanticType === 'timestamp')?.name
  // Columns students chose for the tooltip: their values from all rows of a place.
  const chosen = table.meta.tooltipColumns?.length ? table.meta.tooltipColumns : null
  const chosenValues = new Map<MapPoint, ChosenValues>()

  const byPlace = new Map<string, MapPoint>()
  const running = new Map<MapPoint, Map<string, Running>>()
  const leftOut = new Set<string>()
  let withoutPlace = 0
  for (const row of table.rows) {
    const y = row[lat]
    const x = row[lon]
    if (!isLat(y) || !isLon(x)) {
      withoutPlace++
      continue
    }
    const key = `${y},${x}`
    let point = byPlace.get(key)
    if (point) {
      point.rows++
    } else if (byPlace.size >= MAX_MAP_POINTS) {
      leftOut.add(key)
      continue
    } else {
      const label = name && row[name] !== null && row[name] !== undefined ? String(row[name]) : undefined
      // Not chosen: the details of the place's first row, for a place of one row (a defibrillator, a school).
      point = { lat: y, lon: x, label, rows: 1, values: {}, details: chosen ? [] : detailsOf(row, others) }
      byPlace.set(key, point)
    }
    if (chosen) {
      let collected = chosenValues.get(point)
      if (!collected) chosenValues.set(point, (collected = new ChosenValues(chosen)))
      collected.add(row)
    }

    // ISO timestamps compare correctly as text.
    const at = time && typeof row[time] === 'string' ? (row[time] as string) : undefined
    let byMeasure = running.get(point)
    if (!byMeasure) running.set(point, (byMeasure = new Map()))
    for (const measure of measures) {
      const value = row[measure]
      if (!isValue(value)) continue
      const r = byMeasure.get(measure)
      if (!r) {
        byMeasure.set(measure, { count: 1, sum: value, min: value, max: value, latest: value, latestAt: at })
        continue
      }
      r.count++
      r.sum += value
      r.min = Math.min(r.min, value)
      r.max = Math.max(r.max, value)
      if (!time || (at !== undefined && (r.latestAt === undefined || at >= r.latestAt))) {
        r.latest = value
        r.latestAt = at
      }
    }
  }

  for (const [point, byMeasure] of running) {
    for (const [measure, r] of byMeasure) {
      point.values[measure] = { count: r.count, mean: r.sum / r.count, min: r.min, max: r.max, latest: r.latest, latestAt: r.latestAt }
    }
  }
  for (const point of byPlace.values()) {
    if (chosen) point.details = chosenValues.get(point)?.details() ?? []
    // Picked by the map: the rows of a place (a station's sensors) may differ, so no first row's details.
    else if (point.rows > 1) point.details = []
  }
  return { points: [...byPlace.values()], withoutPlace, leftOut: leftOut.size }
}

export interface MapShape {
  geometry: Geometry
  label?: string
  /** Always 1: every row is its own shape. */
  rows: number
  values: Record<string, PlaceValues>
  /** The row's value in the category column the map colours by, if any. */
  category?: string
  /** More of the row's text, e.g. its description: [column, value], for the tooltip. */
  details?: Detail[]
}

export interface MapShapes {
  shapes: MapShape[]
  /** Rows without a usable geometry. */
  withoutShape: number
}

/**
 * One shape per row, for tables with a geometry column (outlines of
 * countries, rivers, …). Each measurement's value is the row's own value, so
 * mean, lowest, highest and newest are all the same. Null without a geometry
 * column. Like mapPointsOf, only `measures` are read.
 */
export function mapShapesOf(table: DataTable, measures: readonly string[] = [], categoryColumn?: string): MapShapes | null {
  const shape = table.columns.find((c) => c.semanticType === 'geometry')?.name
  if (!shape) return null
  const name = labelColumn(table)
  const others = detailColumns(table, name)
  const chosen = table.meta.tooltipColumns?.length ? table.meta.tooltipColumns : null
  const shapes: MapShape[] = []
  let withoutShape = 0
  for (const row of table.rows) {
    const geometry = row[shape]
    if (!isGeometry(geometry)) {
      withoutShape++
      continue
    }
    const values: Record<string, PlaceValues> = {}
    for (const measure of measures) {
      const v = row[measure]
      if (isValue(v)) values[measure] = { count: 1, mean: v, min: v, max: v, latest: v }
    }
    const label = name && row[name] !== null && row[name] !== undefined ? String(row[name]) : undefined
    const category = categoryColumn && row[categoryColumn] != null ? String(row[categoryColumn]) : undefined
    let details = detailsOf(row, others)
    if (chosen) {
      const collected = new ChosenValues(chosen)
      collected.add(row)
      details = collected.details()
    }
    shapes.push({ geometry, label, rows: 1, values, category, details })
  }
  return { shapes, withoutShape }
}

/** The value a place's dot shows for the chosen statistic. */
export const placeValue = (values: PlaceValues, stat: PlaceStat): number => values[stat]

/** Number of colour classes on the map. */
export const MAP_CLASSES = 5

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo)
}

/**
 * Class limits for colouring the places: equal steps from the lowest to the
 * highest value that isn't an outlier by the boxplot rule (more than 1.5 ×
 * the interquartile range beyond the quartiles). So a single faulty station
 * (−144 °C on openSenseMap) doesn't squeeze all others into one colour; it
 * goes into the first or last class. Returns MAP_CLASSES − 1 limits, or none
 * if all values are (nearly) the same.
 */
export function classLimits(values: number[]): number[] {
  const sorted = values.filter(isValue).sort((a, b) => a - b)
  if (sorted.length < 2) return []
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const fence = 1.5 * (q3 - q1)
  const low = sorted.find((v) => v >= q1 - fence) ?? sorted[0]
  const high = [...sorted].reverse().find((v) => v <= q3 + fence) ?? sorted[sorted.length - 1]
  if (!(high - low > 1e-9 * Math.max(1, Math.abs(high)))) return []
  const step = (high - low) / MAP_CLASSES
  return Array.from({ length: MAP_CLASSES - 1 }, (_, i) => low + step * (i + 1))
}

/** 0 … limits.length: the class a value falls in. */
export function classOf(value: number, limits: number[]): number {
  let i = 0
  while (i < limits.length && value >= limits[i]) i++
  return i
}
