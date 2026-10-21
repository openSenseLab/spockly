import type { DataTable } from './types'

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
}

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
  const name = table.columns.find((c) => c.semanticType === 'category' || c.semanticType === 'text')?.name
  const time = table.columns.find((c) => c.semanticType === 'timestamp')?.name

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
      point = { lat: y, lon: x, label, rows: 1, values: {} }
      byPlace.set(key, point)
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
  return { points: [...byPlace.values()], withoutPlace, leftOut: leftOut.size }
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
