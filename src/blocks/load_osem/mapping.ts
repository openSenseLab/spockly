/**
 * Pure logic for the openSenseMap loader: picking stations, phenomena,
 * paging and mapping to the DataTable contract. No network access here.
 */
import { toPythonName, uniqueNames } from '../../core/names'
import type { ColumnMeta, DataTable, DatasetMeta, LocalizedText } from '../../core/types'
import { areaPreset, PERIODS, type PeriodId } from './presets'

// ---- Response shapes (only the parts we read) ----

export interface OsemSensor {
  _id: string
  title: string
  unit?: string
  sensorType?: string
}

export interface OsemBox {
  _id: string
  name: string
  exposure?: string // indoor, outdoor, mobile, unknown
  currentLocation?: { coordinates?: number[] }
  lastMeasurementAt?: string
  sensors?: OsemSensor[]
}

export interface OsemMeasurement {
  value: string
  createdAt: string
  /** [lon, lat(, height)] — where the box was when it measured (mobile boxes move). */
  location?: number[]
}

// ---- Block parameters ----

export type OsemSource = { kind: 'area'; area: string } | { kind: 'tag'; tag: string }

export interface LoadOsemParams {
  source: OsemSource
  /** Sensor titles as the boxes name them, e.g. "Temperatur", "rel. Luftfeuchte". */
  phenomena: string[]
  period: PeriodId
  outdoorOnly: boolean
}

export const DEFAULT_PARAMS: LoadOsemParams = {
  source: { kind: 'area', area: 'muenster-mitte' },
  phenomena: ['Temperatur'],
  period: '1d',
  outdoorOnly: true,
}

/** openSenseMap returns at most this many values per sensor request. */
export const SENSOR_LIMIT = 10_000
/** Upper bound on stations per load, so a big group can't flood the API. */
export const MAX_STATIONS = 50
/** Measurements per load: each one is another request per station. */
export const MAX_PHENOMENA = 5

// ---- Time ----

export function timeWindow(period: PeriodId, now: Date): { from: Date; to: Date } {
  const to = new Date(now)
  const from = new Date(now.getTime() - PERIODS[period].days * 24 * 60 * 60 * 1000)
  return { from, to }
}

/**
 * Values come newest first and are capped at SENSOR_LIMIT. If a page is
 * full, the next request ends just before its oldest value.
 */
export function nextPageEnd(page: OsemMeasurement[], from: Date): Date | null {
  if (page.length < SENSOR_LIMIT) return null
  const oldest = Math.min(...page.map((m) => Date.parse(m.createdAt)))
  if (!Number.isFinite(oldest) || oldest <= from.getTime()) return null
  return new Date(oldest - 1)
}

// ---- Stations and phenomena ----

/**
 * The area query also returns boxes that have since moved elsewhere (seen:
 * a box in Berlin for a Münster area). Keep the ones that are in it now.
 */
export function boxesInArea(boxes: OsemBox[], bbox: [number, number, number, number]): OsemBox[] {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return boxes.filter((box) => {
    const [lon, lat] = box.currentLocation?.coordinates ?? []
    return (
      typeof lon === 'number' &&
      typeof lat === 'number' &&
      lon >= minLon &&
      lon <= maxLon &&
      lat >= minLat &&
      lat <= maxLat
    )
  })
}

const isActiveSince = (box: OsemBox, from: Date) =>
  !!box.lastMeasurementAt && Date.parse(box.lastMeasurementAt) >= from.getTime()

export interface Station {
  box: OsemBox
  /** The box's sensors for the chosen phenomena (at least one). */
  sensors: OsemSensor[]
}

/** Boxes that measured something in the window and have a sensor for at least one of the phenomena. */
export function stationsFor(boxes: OsemBox[], phenomena: string[], from: Date): Station[] {
  const stations: Station[] = []
  for (const box of boxes) {
    if (!isActiveSince(box, from)) continue
    const sensors = phenomena
      .map((title) => box.sensors?.find((s) => s.title === title))
      .filter((s): s is OsemSensor => !!s)
    if (sensors.length) stations.push({ box, sensors })
  }
  // Most recently active first, so a cap keeps the liveliest stations.
  return stations.sort(
    (a, b) => Date.parse(b.box.lastMeasurementAt ?? '') - Date.parse(a.box.lastMeasurementAt ?? ''),
  )
}

export interface PhenomenonOption {
  title: string
  unit?: string
  stations: number
}

/** What the active boxes measure, most common first. Titles are kept as the boxes name them. */
export function phenomenaIn(boxes: OsemBox[], from: Date): PhenomenonOption[] {
  const byTitle = new Map<string, PhenomenonOption>()
  for (const box of boxes) {
    if (!isActiveSince(box, from)) continue
    for (const title of new Set(box.sensors?.map((s) => s.title))) {
      const sensor = box.sensors?.find((s) => s.title === title)
      const option = byTitle.get(title) ?? { title, unit: sensor?.unit, stations: 0 }
      option.stations += 1
      byTitle.set(title, option)
    }
  }
  return [...byTitle.values()].sort(
    (a, b) => b.stations - a.stations || a.title.localeCompare(b.title, 'de'),
  )
}

// ---- Table ----

const lonLatOf = (box: OsemBox, m?: OsemMeasurement) => {
  const coords = m?.location?.length ? m.location : box.currentLocation?.coordinates
  return {
    lon: typeof coords?.[0] === 'number' ? coords[0] : null,
    lat: typeof coords?.[1] === 'number' ? coords[1] : null,
  }
}

export function sourceLabel(source: OsemSource): LocalizedText {
  if (source.kind === 'area') return areaPreset(source.area)?.label ?? { de: source.area, en: source.area }
  return { de: `Gruppe „${source.tag}“`, en: `group “${source.tag}”` }
}

const formatRange = (from: Date, to: Date) =>
  `${from.toISOString().slice(0, 16).replace('T', ' ')} – ${to.toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** Column names that are always there; a phenomenon must not take one of them. */
const FIXED_COLUMNS = new Set(['time', 'station', 'station_id', 'lat', 'lon', 'exposure'])

/** "rel. Luftfeuchte" → "rel_luftfeuchte": one stable column name per phenomenon. */
export function phenomenonColumns(phenomena: string[]): string[] {
  return uniqueNames(
    phenomena.map((title) => {
      const name = toPythonName(title, 'messwert')
      return FIXED_COLUMNS.has(name) ? `${name}_wert` : name
    }),
  )
}

const listOf = (titles: string[]) => titles.join(', ')

/**
 * One row per station and time, one column per phenomenon. The sensors of a
 * senseBox send their values together with the same timestamp, so they line
 * up; a sensor that didn't report leaves its column empty in that row.
 */
export function toDataTable(
  params: LoadOsemParams,
  results: { box: OsemBox; sensor: OsemSensor; values: OsemMeasurement[] }[],
  window: { from: Date; to: Date },
  stationsFound: number,
): DataTable {
  const names = phenomenonColumns(params.phenomena)
  const columnOf = new Map(params.phenomena.map((title, i) => [title, names[i]]))
  const unitCounts = new Map<string, Map<string, number>>()
  const rowsByKey = new Map<string, Record<string, unknown>>()

  for (const { box, sensor, values } of results) {
    const column = columnOf.get(sensor.title)
    if (!column) continue
    if (sensor.unit) {
      const counts = unitCounts.get(column) ?? new Map<string, number>()
      counts.set(sensor.unit, (counts.get(sensor.unit) ?? 0) + 1)
      unitCounts.set(column, counts)
    }
    for (const m of values) {
      const key = `${box._id}|${m.createdAt}`
      let row = rowsByKey.get(key)
      if (!row) {
        row = { time: m.createdAt }
        for (const name of names) row[name] = null
        Object.assign(row, { station: box.name, station_id: box._id, ...lonLatOf(box, m), exposure: box.exposure ?? null })
        rowsByKey.set(key, row)
      }
      const value = Number(m.value)
      row[column] = Number.isFinite(value) ? value : null
    }
  }
  const rows = [...rowsByKey.values()].sort(
    (a, b) => String(a.time).localeCompare(String(b.time)) || String(a.station).localeCompare(String(b.station)),
  )

  // The unit the stations use; if they disagree, none is shown and the description says so.
  const mixedUnits: string[] = []
  const unitFor = (column: string, title: string) => {
    const counts = unitCounts.get(column)
    if (!counts || counts.size === 0) return undefined
    if (counts.size > 1) {
      mixedUnits.push(title)
      return undefined
    }
    return [...counts.keys()][0]
  }

  const columns: ColumnMeta[] = [
    { name: 'time', label: { de: 'Zeitpunkt', en: 'Time' }, dataType: 'date', semanticType: 'timestamp' },
    ...params.phenomena.map(
      (title, i): ColumnMeta => ({
        name: names[i],
        label: { de: title, en: title },
        dataType: 'number',
        semanticType: 'measurement',
        unit: unitFor(names[i], title),
      }),
    ),
    { name: 'station', label: { de: 'Station', en: 'Station' }, dataType: 'string', semanticType: 'category' },
    { name: 'station_id', label: { de: 'Stations-ID', en: 'Station ID' }, dataType: 'string', semanticType: 'identifier' },
    { name: 'lat', label: { de: 'Breitengrad', en: 'Latitude' }, dataType: 'number', semanticType: 'latitude', unit: '°' },
    { name: 'lon', label: { de: 'Längengrad', en: 'Longitude' }, dataType: 'number', semanticType: 'longitude', unit: '°' },
    { name: 'exposure', label: { de: 'Aufstellung', en: 'Placement' }, dataType: 'string', semanticType: 'category' },
  ]

  const place = sourceLabel(params.source)
  const period = PERIODS[params.period].label
  const used = new Set(results.map((r) => r.box._id)).size
  const range = formatRange(window.from, window.to)
  const what = listOf(params.phenomena)
  const several = params.phenomena.length > 1

  const meta: DatasetMeta = {
    id: `osem:${params.source.kind}:${params.source.kind === 'area' ? params.source.area : params.source.tag}:${what}`,
    title: {
      de: `openSenseMap: ${what} – ${place.de}`,
      en: `openSenseMap: ${what} – ${place.en}`,
    },
    description: {
      de:
        `Messwerte von ${used} openSenseMap-Stationen (${place.de}), ${period.de}: ${range}.` +
        (stationsFound > used ? ` Es gibt ${stationsFound} passende Stationen; geladen wurden die ${used} zuletzt aktiven.` : '') +
        (params.outdoorOnly ? ' Nur Stationen im Freien.' : '') +
        (several ? ' Nicht jede Station misst alles; fehlende Werte bleiben leer.' : '') +
        (mixedUnits.length ? ` Die Stationen nutzen unterschiedliche Einheiten für: ${listOf(mixedUnits)}.` : ''),
      en:
        `Measurements from ${used} openSenseMap stations (${place.en}), ${period.en}: ${range}.` +
        (stationsFound > used ? ` ${stationsFound} stations match; the ${used} most recently active were loaded.` : '') +
        (params.outdoorOnly ? ' Outdoor stations only.' : '') +
        (several ? ' Not every station measures everything; missing values stay empty.' : '') +
        (mixedUnits.length ? ` Stations use different units for: ${listOf(mixedUnits)}.` : ''),
    },
    source: { name: 'openSenseMap', url: 'https://opensensemap.org' },
    keywords: ['openSenseMap', 'senseBox', ...params.phenomena],
    spatialExtent: extentOf(params, rows),
    placeKind: 'sensor-station',
    temporalExtent: [window.from.toISOString(), window.to.toISOString()],
    totalRecords: rows.length,
  }

  return { meta, columns, rows }
}

function extentOf(params: LoadOsemParams, rows: Record<string, unknown>[]): DatasetMeta['spatialExtent'] {
  if (params.source.kind === 'area') return areaPreset(params.source.area)?.bbox
  const lons = rows.map((r) => r.lon).filter((v): v is number => typeof v === 'number')
  const lats = rows.map((r) => r.lat).filter((v): v is number => typeof v === 'number')
  if (lons.length === 0) return undefined
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

/** Checks params coming from a saved block; anything odd falls back to the defaults. */
export function normalizeParams(raw: unknown): LoadOsemParams {
  const r = (raw ?? {}) as Partial<LoadOsemParams> & { phenomenon?: unknown }
  const source: OsemSource =
    r.source?.kind === 'tag' && typeof r.source.tag === 'string'
      ? { kind: 'tag', tag: r.source.tag }
      : r.source?.kind === 'area' && typeof r.source.area === 'string' && areaPreset(r.source.area)
        ? { kind: 'area', area: r.source.area }
        : DEFAULT_PARAMS.source
  return {
    source,
    phenomena: normalizePhenomena(r.phenomena, r.phenomenon),
    period: r.period && r.period in PERIODS ? r.period : DEFAULT_PARAMS.period,
    outdoorOnly: typeof r.outdoorOnly === 'boolean' ? r.outdoorOnly : DEFAULT_PARAMS.outdoorOnly,
  }
}

/** Blocks saved before several phenomena were possible have a single `phenomenon`. */
function normalizePhenomena(list: unknown, single: unknown): string[] {
  const titles: unknown[] = Array.isArray(list) ? list : typeof single === 'string' ? [single] : []
  const clean = [...new Set(titles.filter((t): t is string => typeof t === 'string' && t.trim() !== ''))]
  return clean.length ? clean.slice(0, MAX_PHENOMENA) : [...DEFAULT_PARAMS.phenomena]
}
