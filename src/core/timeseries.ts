/**
 * Rows with a time column → values per time step (hour, day, month, year),
 * for the time chart. Pure, no DOM: a later "chart" block can use it too.
 *
 * Times are grouped in the browser's local time (Münster: CET/CEST), so "a
 * day" is a day as students live it, not a UTC day.
 */
import { labelColumn } from './geo'
import type { DataTable } from './types'

/** "raw" keeps every distinct time; the others group by calendar unit. */
export type TimeStep = 'raw' | 'hour' | 'day' | 'month' | 'year'
export const TIME_STEPS: TimeStep[] = ['raw', 'hour', 'day', 'month', 'year']

/** What one point of the chart is: a statistic of the values in its step, or the number of rows. */
export type SeriesStat = 'mean' | 'max' | 'min' | 'count'

/** More steps than this can't be drawn sensibly in a panel; such a step is not offered. */
export const MAX_STEPS = 5000
/** The automatic step is the finest with at most this many steps. */
const AUTO_STEPS = 200
/** Up to this many places, one line each; more are drawn as one line with their range. */
export const MAX_PLACE_LINES = 3

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Lowest and highest of many numbers (spreading 50 000 values into Math.min can overflow the stack). */
function extent(values: Iterable<number>): [number, number] {
  let [lo, hi] = [Infinity, -Infinity]
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

/**
 * ISO value at any precision → time in ms. Values without a zone ("2024",
 * "2024-05-12", "2024-05-12T14:00") are local times; with Z or an offset,
 * that instant.
 */
export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?)?)?$/)
  if (m) {
    const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00'] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime()
  }
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** The step a time falls into, as an ISO value at the step's precision (local time). */
export function stepKey(ms: number, step: Exclude<TimeStep, 'raw'>): string {
  const d = new Date(ms)
  const [y, mo, day, h] = [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate()), pad(d.getHours())]
  if (step === 'year') return String(y)
  if (step === 'month') return `${y}-${mo}`
  if (step === 'day') return `${y}-${mo}-${day}`
  return `${y}-${mo}-${day}T${h}:00`
}

/** Start of the step after the one `ms` is in. */
function nextStep(ms: number, step: Exclude<TimeStep, 'raw'>): number {
  const d = new Date(ms)
  if (step === 'year') return new Date(d.getFullYear() + 1, 0, 1).getTime()
  if (step === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  if (step === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
}

/** Start of the step `ms` is in. */
function stepStart(ms: number, step: Exclude<TimeStep, 'raw'>): number {
  const d = new Date(ms)
  if (step === 'year') return new Date(d.getFullYear(), 0, 1).getTime()
  if (step === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  if (step === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime()
}

/** Every step from the first to the last time, including empty ones (they become gaps). */
function allSteps(first: number, last: number, step: Exclude<TimeStep, 'raw'>, limit: number): number[] | null {
  const steps: number[] = []
  for (let t = stepStart(first, step); t <= last; t = nextStep(t, step)) {
    steps.push(t)
    if (steps.length > limit) return null
  }
  return steps
}

/** Names of times when something happened or was measured … */
const EVENT_TIME = /event|^time$|timestamp|^date$|datum|zeit|measured|observed|messung|beobacht/i
/** … and of times about the record itself (GBIF: lastCrawled, modified, dateIdentified). */
const RECORD_TIME = /crawl|parsed|interpreted|modified|updated|identified|created|first_record|last_record/i

/**
 * The time columns (dates or times), best first: event or measurement times
 * before the others, times about the record itself (when it was last
 * crawled or changed) last.
 */
export function timeColumnsOf(table: DataTable) {
  const rank = (name: string) => (RECORD_TIME.test(name) ? 2 : EVENT_TIME.test(name) ? 0 : 1)
  return table.columns
    .filter((c) => c.semanticType === 'timestamp' && c.dataType === 'date')
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.name) - rank(b.c.name) || a.i - b.i)
    .map(({ c }) => c)
}

/** The time column the chart uses by default. */
export const timeColumnOf = (table: DataTable) => timeColumnsOf(table)[0]

export interface StepChoice {
  step: TimeStep
  /** Number of points the chart would have. */
  count: number
}

/**
 * The steps that make sense for these times (at least 2 and at most
 * MAX_STEPS points, each coarser than the last), and the automatic choice.
 */
export function stepsFor(times: number[]): { steps: StepChoice[]; auto: TimeStep } | null {
  if (times.length === 0) return null
  const [first, last] = extent(times)
  const steps: StepChoice[] = []
  const distinct = new Set(times).size
  if (distinct >= 2 && distinct <= MAX_STEPS) steps.push({ step: 'raw', count: distinct })
  for (const step of ['hour', 'day', 'month', 'year'] as const) {
    const all = allSteps(first, last, step, MAX_STEPS)
    if (all && all.length >= 2 && !steps.some((s) => s.count === all.length && s.step !== 'raw')) steps.push({ step, count: all.length })
  }
  if (steps.length === 0) return null
  // The finest calendar step with a readable number of points; raw only if nothing else fits.
  const calendar = steps.filter((s) => s.step !== 'raw')
  const auto = calendar.find((s) => s.count <= AUTO_STEPS) ?? calendar.at(-1) ?? steps[0]
  return { steps, auto: auto.step }
}

/** True if the table has a time column with at least two different times: worth a chart. */
export function hasTimeSeries(table: DataTable): boolean {
  const time = timeColumnOf(table)?.name
  if (!time) return false
  let first: number | null = null
  for (const row of table.rows) {
    const ms = parseTime(row[time])
    if (ms === null) continue
    if (first === null) first = ms
    else if (ms !== first) return true
  }
  return false
}

export interface Series {
  /** Name of the place, for several lines; undefined for "all places". */
  label?: string
  /** One value per point; null = no data in that step (a gap). */
  values: (number | null)[]
  /** Lowest and highest single value in each step (for the range band of "all places"). */
  low?: (number | null)[]
  high?: (number | null)[]
}

export interface TimeSeries {
  step: TimeStep
  /** Start of each point (ms) and its ISO value at the step's precision. */
  points: { at: number; key: string }[]
  series: Series[]
  /** Places in the data; with more than MAX_PLACE_LINES they are drawn together. */
  places: number
  /** Rows without a usable time. */
  withoutTime: number
}

interface Acc {
  n: number
  sum: number
  min: number
  max: number
  rows: number
}

const statOf = (acc: Acc | undefined, stat: SeriesStat): number | null => {
  if (!acc) return stat === 'count' ? 0 : null
  if (stat === 'count') return acc.rows
  if (acc.n === 0) return null
  return stat === 'mean' ? acc.sum / acc.n : stat === 'max' ? acc.max : acc.min
}

/**
 * The values of `measure` (or, for "count", the rows) per time step, one
 * series per place when there are few places, else one for all with the
 * range of values in each step.
 */
export function timeSeriesOf(
  table: DataTable,
  { measure, stat, step, time = timeColumnOf(table)?.name }: { measure?: string; stat: SeriesStat; step: TimeStep; time?: string },
): TimeSeries | null {
  if (!time) return null
  const lat = table.columns.find((c) => c.semanticType === 'latitude')?.name
  const lon = table.columns.find((c) => c.semanticType === 'longitude')?.name
  const name = labelColumn(table)

  // Place of each row (by coordinates, as on the map), and its time.
  const rows: { ms: number; place: string; value: number | null }[] = []
  const placeNames = new Map<string, string>()
  let withoutTime = 0
  for (const row of table.rows) {
    const ms = parseTime(row[time])
    if (ms === null) {
      withoutTime++
      continue
    }
    const place = lat && lon && typeof row[lat] === 'number' && typeof row[lon] === 'number' ? `${row[lat]},${row[lon]}` : ''
    if (place && !placeNames.has(place)) placeNames.set(place, name && row[name] != null ? String(row[name]) : place)
    const v = measure ? row[measure] : null
    rows.push({ ms, place, value: typeof v === 'number' && Number.isFinite(v) ? v : null })
  }
  if (rows.length === 0) return null

  // The points of the chart.
  let points: { at: number; key: string }[]
  let keyOf: (ms: number) => string
  if (step === 'raw') {
    const distinct = [...new Set(rows.map((r) => r.ms))].sort((a, b) => a - b)
    if (distinct.length > MAX_STEPS) return null
    points = distinct.map((at) => ({ at, key: String(at) }))
    keyOf = (ms) => String(ms)
  } else {
    const [first, last] = extent(rows.map((r) => r.ms))
    const all = allSteps(first, last, step, MAX_STEPS)
    if (!all) return null
    points = all.map((at) => ({ at, key: stepKey(at, step) }))
    keyOf = (ms) => stepKey(ms, step)
  }
  const index = new Map(points.map((p, i) => [p.key, i]))

  const places = placeNames.size
  const perPlace = places >= 2 && places <= MAX_PLACE_LINES
  const groups = perPlace ? [...placeNames.keys()] : ['']
  const accs = new Map(groups.map((g) => [g, new Map<number, Acc>()]))
  for (const r of rows) {
    const i = index.get(keyOf(r.ms))
    if (i === undefined) continue
    const byStep = accs.get(perPlace ? r.place : '')
    if (!byStep) continue
    const acc = byStep.get(i) ?? { n: 0, sum: 0, min: Infinity, max: -Infinity, rows: 0 }
    acc.rows++
    if (r.value !== null) {
      acc.n++
      acc.sum += r.value
      acc.min = Math.min(acc.min, r.value)
      acc.max = Math.max(acc.max, r.value)
    }
    byStep.set(i, acc)
  }

  const series = groups.map((g): Series => {
    const byStep = accs.get(g)!
    const values = points.map((_, i) => statOf(byStep.get(i), stat))
    if (perPlace || stat !== 'mean') return { label: perPlace ? placeNames.get(g) : undefined, values }
    // Mean of all places: the band shows the lowest and highest single value in each step.
    return {
      values,
      low: points.map((_, i) => statOf(byStep.get(i), 'min')),
      high: points.map((_, i) => statOf(byStep.get(i), 'max')),
    }
  })
  return { step, points, series, places, withoutTime }
}

/** Clean axis ticks between lo and hi: 1, 2 or 5 times a power of ten. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return []
  if (lo === hi) return [lo]
  const raw = (hi - lo) / target
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((f) => f * power).find((s) => raw <= s) ?? 10 * power
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step)
  return ticks
}
