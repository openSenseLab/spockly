/**
 * Pure logic for the openSenseMap loader: picking stations, phenomena,
 * paging and mapping to the DataTable contract. No network access here.
 */
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
  phenomenon: string
  period: PeriodId
  outdoorOnly: boolean
}

export const DEFAULT_PARAMS: LoadOsemParams = {
  source: { kind: 'area', area: 'muenster-mitte' },
  phenomenon: 'Temperatur',
  period: '1d',
  outdoorOnly: true,
}

/** openSenseMap returns at most this many values per sensor request. */
export const SENSOR_LIMIT = 10_000
/** Upper bound on stations per load, so a big group can't flood the API. */
export const MAX_STATIONS = 50

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
  sensor: OsemSensor
}

/** Boxes that measured something in the window and have a sensor for `phenomenon`. */
export function stationsFor(boxes: OsemBox[], phenomenon: string, from: Date): Station[] {
  const stations: Station[] = []
  for (const box of boxes) {
    if (!isActiveSince(box, from)) continue
    const sensor = box.sensors?.find((s) => s.title === phenomenon)
    if (sensor) stations.push({ box, sensor })
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

export function toDataTable(
  params: LoadOsemParams,
  results: { station: Station; values: OsemMeasurement[] }[],
  window: { from: Date; to: Date },
  stationsFound: number,
): DataTable {
  const rows: Record<string, unknown>[] = []
  const units = new Set<string>()

  for (const { station, values } of results) {
    const { box, sensor } = station
    if (sensor.unit) units.add(sensor.unit)
    for (const m of values) {
      const value = Number(m.value)
      rows.push({
        time: m.createdAt,
        value: Number.isFinite(value) ? value : null,
        unit: sensor.unit ?? null,
        station: box.name,
        station_id: box._id,
        ...lonLatOf(box, m),
        exposure: box.exposure ?? null,
        sensor_type: sensor.sensorType ?? null,
      })
    }
  }
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)))

  // A unit column only helps when stations disagree on the unit.
  const unit = units.size === 1 ? [...units][0] : undefined
  const columns: ColumnMeta[] = [
    { name: 'time', label: { de: 'Zeitpunkt', en: 'Time' }, dataType: 'date', semanticType: 'timestamp' },
    {
      name: 'value',
      label: { de: params.phenomenon, en: params.phenomenon },
      dataType: 'number',
      semanticType: 'measurement',
      unit,
    },
    ...(units.size > 1
      ? [{ name: 'unit', label: { de: 'Einheit', en: 'Unit' }, dataType: 'string', semanticType: 'category' } as const]
      : []),
    { name: 'station', label: { de: 'Station', en: 'Station' }, dataType: 'string', semanticType: 'category' },
    { name: 'station_id', label: { de: 'Stations-ID', en: 'Station ID' }, dataType: 'string', semanticType: 'identifier' },
    { name: 'lat', label: { de: 'Breitengrad', en: 'Latitude' }, dataType: 'number', semanticType: 'latitude', unit: '°' },
    { name: 'lon', label: { de: 'Längengrad', en: 'Longitude' }, dataType: 'number', semanticType: 'longitude', unit: '°' },
    { name: 'exposure', label: { de: 'Aufstellung', en: 'Placement' }, dataType: 'string', semanticType: 'category' },
    { name: 'sensor_type', label: { de: 'Sensortyp', en: 'Sensor type' }, dataType: 'string', semanticType: 'category' },
  ]
  if (units.size <= 1) for (const row of rows) delete row.unit

  const place = sourceLabel(params.source)
  const period = PERIODS[params.period].label
  const used = results.length
  const range = formatRange(window.from, window.to)

  const meta: DatasetMeta = {
    id: `osem:${params.source.kind}:${params.source.kind === 'area' ? params.source.area : params.source.tag}:${params.phenomenon}`,
    title: {
      de: `openSenseMap: ${params.phenomenon} – ${place.de}`,
      en: `openSenseMap: ${params.phenomenon} – ${place.en}`,
    },
    description: {
      de:
        `Messwerte von ${used} openSenseMap-Stationen (${place.de}), ${period.de}: ${range}.` +
        (stationsFound > used ? ` Es gibt ${stationsFound} passende Stationen; geladen wurden die ${used} zuletzt aktiven.` : '') +
        (params.outdoorOnly ? ' Nur Stationen im Freien.' : ''),
      en:
        `Measurements from ${used} openSenseMap stations (${place.en}), ${period.en}: ${range}.` +
        (stationsFound > used ? ` ${stationsFound} stations match; the ${used} most recently active were loaded.` : '') +
        (params.outdoorOnly ? ' Outdoor stations only.' : ''),
    },
    source: { name: 'openSenseMap', url: 'https://opensensemap.org' },
    keywords: ['openSenseMap', 'senseBox', params.phenomenon],
    spatialExtent: extentOf(params, rows),
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
  const r = (raw ?? {}) as Partial<LoadOsemParams>
  const source: OsemSource =
    r.source?.kind === 'tag' && typeof r.source.tag === 'string'
      ? { kind: 'tag', tag: r.source.tag }
      : r.source?.kind === 'area' && typeof r.source.area === 'string' && areaPreset(r.source.area)
        ? { kind: 'area', area: r.source.area }
        : DEFAULT_PARAMS.source
  return {
    source,
    phenomenon: typeof r.phenomenon === 'string' && r.phenomenon ? r.phenomenon : DEFAULT_PARAMS.phenomenon,
    period: r.period && r.period in PERIODS ? r.period : DEFAULT_PARAMS.period,
    outdoorOnly: typeof r.outdoorOnly === 'boolean' ? r.outdoorOnly : DEFAULT_PARAMS.outdoorOnly,
  }
}
