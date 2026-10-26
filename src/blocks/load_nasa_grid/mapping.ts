/**
 * NASA POWER grid ("regional") requests: one value for every cell of a grid
 * over an area. Pure logic, no network access here.
 */
import { containsPoint, rectTouches } from '../../core/geometry'
import type { ColumnMeta, DataTable } from '../../core/types'
import { dateKey, powerAttribution } from '../load_nasa_power/mapping'
import { prettyUnit, VARIABLES, variable } from '../load_nasa_power/presets'
import { areaPreset, AREA_PRESETS, MAX_SPAN, MIN_SPAN, OUTLINE_CREDIT } from './presets'

export const POWER_REGIONAL = 'https://power.larc.nasa.gov/api/temporal/monthly/regional'
export const FIRST_YEAR = 1981

export interface LoadNasaGridParams {
  area: string
  /** One value: the grid request takes a single parameter. */
  parameter: string
  year: number
}

/** Monthly values exist only for completed years. */
export const lastCompleteYear = (today: string) => Number(today.slice(0, 4)) - 1

export const defaultGridParams = (today: string): LoadNasaGridParams => ({
  area: AREA_PRESETS[0].id,
  parameter: VARIABLES[0].code,
  year: lastCompleteYear(today),
})

export interface PowerGridResponse {
  features?: { geometry?: { coordinates?: number[] }; properties?: { parameter?: Record<string, Record<string, number>> } }[]
  header?: { fill_value?: number; sources?: string[]; api?: { version?: string } }
  parameters?: Record<string, { units?: string; longname?: string }>
  messages?: string[]
}

/** An i18n error code if the settings can't work, else null. */
export function checkGridParams(params: LoadNasaGridParams, today: string): string | null {
  const area = areaPreset(params.area)
  if (!area) return 'load.nasaUnknownPlace'
  const [minLon, minLat, maxLon, maxLat] = area.bbox
  if ([maxLon - minLon, maxLat - minLat].some((span) => span < MIN_SPAN || span > MAX_SPAN)) return 'load.failed'
  if (!variable(params.parameter)) return 'load.nasaNoVariables'
  if (!Number.isInteger(params.year) || params.year < FIRST_YEAR) return 'load.nasaTooEarly'
  if (params.year > lastCompleteYear(today)) return 'load.nasaYearNotComplete'
  return null
}

export function gridRequestUrl(params: LoadNasaGridParams): string {
  const [minLon, minLat, maxLon, maxLat] = areaPreset(params.area)!.bbox
  const query = new URLSearchParams({
    parameters: params.parameter,
    community: 'RE',
    'latitude-min': String(minLat),
    'latitude-max': String(maxLat),
    'longitude-min': String(minLon),
    'longitude-max': String(maxLon),
    start: String(params.year),
    end: String(params.year),
    format: 'JSON',
  })
  return `${POWER_REGIONAL}?${query}`
}

/** The grid spacing in one direction: the smallest step between neighbouring cell centres. */
function step(values: number[]): number | undefined {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  let best: number | undefined
  for (let i = 1; i < sorted.length; i++) {
    const d = Number((sorted[i] - sorted[i - 1]).toFixed(6))
    if (d > 0 && (best === undefined || d < best)) best = d
  }
  return best
}

/**
 * One row per grid cell and month: month, the value, the cell centre and
 * the cell's elevation in the model. The grid size comes from the data
 * (temperature: 0.5° × 0.625°, solar radiation: 1° × 1°). Only cells that
 * touch the area's outline are kept: the request is a rectangle, the
 * question is about Germany (or a state), not the sea and the neighbours.
 */
export function toGridTable(params: LoadNasaGridParams, response: PowerGridResponse, accessed: string): DataTable {
  const fill = response.header?.fill_value ?? -999
  const code = params.parameter
  const area = areaPreset(params.area)!

  const all = (response.features ?? []).flatMap((feature) => {
    const [lon, lat, elevation] = feature.geometry?.coordinates ?? []
    const series = feature.properties?.parameter?.[code]
    return typeof lon === 'number' && typeof lat === 'number' && series ? [{ lon, lat, elevation, series }] : []
  })
  const dLon = step(all.map((c) => c.lon))
  const dLat = step(all.map((c) => c.lat))
  const cells = all.filter(({ lon, lat }) =>
    dLon && dLat
      ? rectTouches([lon - dLon / 2, lat - dLat / 2, lon + dLon / 2, lat + dLat / 2], area.outline)
      : containsPoint(area.outline, lon, lat),
  )

  const rows: Record<string, unknown>[] = []
  for (const { lon, lat, elevation, series } of cells) {
    for (const [key, value] of Object.entries(series)) {
      const month = dateKey(key, 'monthly') // drops month 13, the annual value
      if (!month) continue
      rows.push({
        date: month,
        [code]: typeof value === 'number' && value !== fill ? value : null,
        lat,
        lon,
        hoehe: typeof elevation === 'number' ? elevation : null,
      })
    }
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (b.lat as number) - (a.lat as number) || (a.lon as number) - (b.lon as number))

  const label = variable(code)?.label ?? { de: code, en: code }
  const unit = prettyUnit(response.parameters?.[code]?.units ?? variable(code)?.unit ?? '')
  const columns: ColumnMeta[] = [
    { name: 'date', label: { de: 'Monat', en: 'Month' }, dataType: 'date', semanticType: 'timestamp' },
    {
      name: code,
      label,
      dataType: 'number',
      semanticType: 'measurement',
      unit,
      description: response.parameters?.[code]?.longname ? { en: response.parameters[code].longname } : undefined,
    },
    { name: 'lat', label: { de: 'Breitengrad (Zellmitte)', en: 'Latitude (cell centre)' }, dataType: 'number', semanticType: 'latitude', unit: '°' },
    { name: 'lon', label: { de: 'Längengrad (Zellmitte)', en: 'Longitude (cell centre)' }, dataType: 'number', semanticType: 'longitude', unit: '°' },
    { name: 'hoehe', label: { de: 'Höhe der Zelle (Modell)', en: 'Cell elevation (model)' }, dataType: 'number', semanticType: 'measurement', unit: 'm' },
  ]

  const sources = response.header?.sources?.join(', ') ?? ''
  const size = (sep: string) => (dLon && dLat ? `${dLat}° × ${dLon}°`.replaceAll('.', sep) : '?')

  return {
    meta: {
      id: `nasa-power-grid:${params.area}:${code}:${params.year}`,
      title: {
        de: `NASA POWER: ${label.de} – ${area.label.de} ${params.year}`,
        en: `NASA POWER: ${label.en} – ${area.label.en} ${params.year}`,
      },
      description: {
        de:
          `Monatswerte ${params.year} für die ${cells.length} Rasterzellen von je ${size(',')} (Breite × Länge), die ${area.label.de} berühren ` +
          `(von ${all.length} im Rechteck um das Gebiet). ` +
          `Jede Zeile ist ein Monat in einer Zelle. Die Werte stammen aus Modell- und Satellitendaten (${sources}), ` +
          'nicht von Messstationen; die Höhe ist die mittlere Höhe der Zelle im Modell.',
        en:
          `Monthly values ${params.year} for the ${cells.length} grid cells of ${size('.')} (latitude × longitude) each that touch ${area.label.en} ` +
          `(of ${all.length} in the rectangle around the area). ` +
          `Each row is one month in one cell. The values come from model and satellite data (${sources}), ` +
          "not from measuring stations; the elevation is the cell's mean elevation in the model.",
      },
      source: { name: 'NASA POWER', url: 'https://power.larc.nasa.gov' },
      attribution: `${powerAttribution(response.header?.api?.version ?? '', accessed)} Umriss: ${OUTLINE_CREDIT}`,
      collectedBy: 'NASA Langley Research Center',
      keywords: ['NASA POWER', label.de ?? code, area.label.de ?? area.id],
      spatialExtent: area.bbox,
      placeKind: 'grid-cell',
      grid: dLon && dLat ? { cellSize: [dLon, dLat] } : undefined,
      outline: { geometry: area.outline, label: area.label },
      landmarks: area.landmarks,
      temporalExtent: rows.length ? [String(rows[0].date), String(rows.at(-1)!.date)] : undefined,
      totalRecords: rows.length,
    },
    columns,
    rows,
  }
}

/** Checks params coming from a saved block; anything odd falls back to the defaults. */
export function normalizeGridParams(raw: unknown, today: string): LoadNasaGridParams {
  const r = (raw ?? {}) as Partial<LoadNasaGridParams>
  const fallback = defaultGridParams(today)
  return {
    area: typeof r.area === 'string' && areaPreset(r.area) ? r.area : fallback.area,
    parameter: typeof r.parameter === 'string' && variable(r.parameter) ? r.parameter : fallback.parameter,
    year: Number.isInteger(Number(r.year)) ? Number(r.year) : fallback.year,
  }
}
