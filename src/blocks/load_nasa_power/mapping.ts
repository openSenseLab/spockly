/**
 * Pure logic for the NASA POWER loader: checking settings, building the
 * request and mapping the response to the DataTable contract.
 */
import type { ColumnMeta, DataTable, LocalizedText } from '../../core/types'
import { FIRST_DATE, placePreset, prettyUnit, VARIABLES, variable } from './presets'

// ---- Response shape (only the parts we read) ----

export interface PowerResponse {
  geometry?: { coordinates?: number[] }
  properties: { parameter: Record<string, Record<string, number>> }
  header?: { fill_value?: number; sources?: string[]; api?: { version?: string } }
  parameters?: Record<string, { units?: string; longname?: string }>
}

// ---- Block parameters ----

export type NasaPlace = { kind: 'preset'; id: string } | { kind: 'coords'; lat: number; lon: number }
export type Resolution = 'daily' | 'monthly'

export interface LoadNasaParams {
  place: NasaPlace
  /** POWER parameter codes. */
  variables: string[]
  resolution: Resolution
  /** daily: YYYY-MM-DD; monthly: YYYY */
  from: string
  to: string
}

export const DEFAULT_PARAMS: LoadNasaParams = {
  place: { kind: 'preset', id: 'muenster' },
  variables: ['T2M', 'PRECTOTCORR', 'WS50M'],
  resolution: 'daily',
  from: '2025-01-01',
  to: '2025-12-31',
}

/** POWER allows 20 parameters per request; our list is shorter anyway. */
export const MAX_VARIABLES = 20

export function placeCoords(place: NasaPlace): { lat: number; lon: number } | null {
  if (place.kind === 'coords') return { lat: place.lat, lon: place.lon }
  const preset = placePreset(place.id)
  return preset ? { lat: preset.lat, lon: preset.lon } : null
}

export function placeLabel(place: NasaPlace): LocalizedText {
  if (place.kind === 'preset') return placePreset(place.id)?.label ?? { de: place.id, en: place.id }
  const text = `${place.lat.toFixed(3)}° N, ${place.lon.toFixed(3)}° E`
  return { de: text, en: text }
}

// ---- Checking settings (before any request) ----

const DAY = /^\d{4}-\d{2}-\d{2}$/
const YEAR = /^\d{4}$/

const isValidDay = (s: string) => DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** Returns an i18n error code, or null if the settings can be requested. */
export function checkParams(params: LoadNasaParams, today: string): string | null {
  const coords = placeCoords(params.place)
  if (!coords) return 'load.nasaUnknownPlace'
  if (!(Math.abs(coords.lat) <= 90 && Math.abs(coords.lon) <= 180)) return 'load.nasaBadCoords'
  if (params.variables.length === 0) return 'load.nasaNoVariables'
  if (params.variables.length > MAX_VARIABLES) return 'load.nasaTooManyVariables'

  const firstYear = FIRST_DATE.slice(0, 4)
  if (params.resolution === 'daily') {
    if (!isValidDay(params.from) || !isValidDay(params.to)) return 'load.nasaBadDates'
    if (params.from < FIRST_DATE) return 'load.nasaTooEarly'
    if (params.to > today) return 'load.nasaFuture'
  } else {
    if (!YEAR.test(params.from) || !YEAR.test(params.to)) return 'load.nasaBadDates'
    if (params.from < firstYear) return 'load.nasaTooEarly'
    // Monthly values exist for completed years only.
    if (params.to >= today.slice(0, 4)) return 'load.nasaYearNotComplete'
  }
  if (params.from > params.to) return 'load.nasaFromAfterTo'
  return null
}

export function requestUrl(params: LoadNasaParams): string {
  const coords = placeCoords(params.place)!
  const compact = (s: string) => s.replaceAll('-', '')
  const query = new URLSearchParams({
    parameters: params.variables.join(','),
    community: 'RE',
    longitude: String(coords.lon),
    latitude: String(coords.lat),
    start: compact(params.from),
    end: compact(params.to),
    format: 'JSON',
  })
  return `https://power.larc.nasa.gov/api/temporal/${params.resolution}/point?${query}`
}

// ---- Response → table ----

/** "20250101" → "2025-01-01"; "202501" → "2025-01"; month "13" (the annual value) → null. */
export function dateKey(key: string, resolution: Resolution): string | null {
  if (resolution === 'daily') return /^\d{8}$/.test(key) ? `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6)}` : null
  if (!/^\d{6}$/.test(key)) return null
  const month = Number(key.slice(4))
  return month >= 1 && month <= 12 ? `${key.slice(0, 4)}-${key.slice(4)}` : null
}

const RESOLUTION_LABEL: Record<Resolution, LocalizedText> = {
  daily: { de: 'täglich', en: 'daily' },
  monthly: { de: 'monatlich', en: 'monthly' },
}

export function toDataTable(params: LoadNasaParams, response: PowerResponse, accessed: string): DataTable {
  const fill = response.header?.fill_value ?? -999
  const values = response.properties.parameter
  const coords = placeCoords(params.place)!
  // The API reports the grid point it used; fall back to what we asked for.
  const [lon, lat] = response.geometry?.coordinates ?? [coords.lon, coords.lat]

  // Keep the order of our variable list, whatever order the API answers in.
  const codes = VARIABLES.map((v) => v.code).filter((code) => code in values)
  const dates = new Set<string>()
  for (const code of codes) for (const key of Object.keys(values[code])) {
    const date = dateKey(key, params.resolution)
    if (date) dates.add(date)
  }

  const rows = [...dates].sort().map((date) => {
    const row: Record<string, unknown> = { date }
    const key = date.replaceAll('-', '')
    for (const code of codes) {
      const value = values[code][key]
      row[code] = typeof value === 'number' && value !== fill ? value : null
    }
    row.lat = lat
    row.lon = lon
    return row
  })

  const columns: ColumnMeta[] = [
    { name: 'date', label: { de: 'Datum', en: 'Date' }, dataType: 'date', semanticType: 'timestamp' },
    ...codes.map(
      (code): ColumnMeta => ({
        name: code,
        label: variable(code)?.label ?? { de: code, en: code },
        dataType: 'number',
        semanticType: 'measurement',
        unit: prettyUnit(response.parameters?.[code]?.units ?? variable(code)?.unit ?? ''),
        description: response.parameters?.[code]?.longname
          ? { en: response.parameters[code].longname }
          : undefined,
      }),
    ),
    { name: 'lat', label: { de: 'Breitengrad', en: 'Latitude' }, dataType: 'number', semanticType: 'latitude', unit: '°' },
    { name: 'lon', label: { de: 'Längengrad', en: 'Longitude' }, dataType: 'number', semanticType: 'longitude', unit: '°' },
  ]

  const place = placeLabel(params.place)
  const res = RESOLUTION_LABEL[params.resolution]
  const sources = response.header?.sources?.join(', ') ?? ''
  const version = response.header?.api?.version ?? ''

  return {
    meta: {
      id: `nasa-power:${params.resolution}:${coords.lat},${coords.lon}:${params.from}:${params.to}`,
      title: {
        de: `NASA POWER: Wetterdaten ${place.de} (${res.de})`,
        en: `NASA POWER: weather data ${place.en} (${res.en})`,
      },
      description: {
        de:
          `${res.de === 'täglich' ? 'Tageswerte' : 'Monatswerte'} von ${params.from} bis ${params.to}. ` +
          `Die Werte stammen aus Modell- und Satellitendaten (${sources}) für eine Gitterzelle von etwa ½° × ⅝° ` +
          '(Sonneneinstrahlung: 1° × 1°), nicht von einer Messstation. ' +
          'Die letzten Tage fehlen oft noch, weil die Daten erst nach einigen Tagen bereitstehen.',
        en:
          `${res.en === 'daily' ? 'Daily' : 'Monthly'} values from ${params.from} to ${params.to}. ` +
          `The values come from model and satellite data (${sources}) for a grid cell of about ½° × ⅝° ` +
          '(solar radiation: 1° × 1°), not from a weather station. ' +
          'The most recent days are often still missing because the data only becomes available after a few days.',
      },
      source: { name: 'NASA POWER', url: 'https://power.larc.nasa.gov' },
      // Wording as requested on power.larc.nasa.gov/docs/referencing (checked 2026-10-13),
      // plus service name, version and date accessed as asked there.
      attribution:
        "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's " +
        'Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division' +
        ` (POWER API ${version}, accessed ${accessed}).`,
      collectedBy: 'NASA Langley Research Center',
      keywords: ['NASA POWER', ...codes.map((code) => variable(code)?.label.de ?? code)],
      spatialExtent: [lon, lat, lon, lat],
      placeKind: 'grid-cell',
      temporalExtent: rows.length ? [String(rows[0].date), String(rows.at(-1)!.date)] : undefined,
      totalRecords: rows.length,
    },
    columns,
    rows,
  }
}

/** Checks params coming from a saved block; anything odd falls back to the defaults. */
export function normalizeParams(raw: unknown): LoadNasaParams {
  const r = (raw ?? {}) as Partial<LoadNasaParams>
  const place: NasaPlace =
    r.place?.kind === 'coords' && Number.isFinite(r.place.lat) && Number.isFinite(r.place.lon)
      ? { kind: 'coords', lat: r.place.lat, lon: r.place.lon }
      : r.place?.kind === 'preset' && placePreset(r.place.id)
        ? { kind: 'preset', id: r.place.id }
        : DEFAULT_PARAMS.place
  const variables = Array.isArray(r.variables)
    ? r.variables.filter((code): code is string => typeof code === 'string' && !!variable(code))
    : DEFAULT_PARAMS.variables
  const resolution: Resolution = r.resolution === 'monthly' ? 'monthly' : 'daily'
  const from = typeof r.from === 'string' ? r.from : DEFAULT_PARAMS.from
  const to = typeof r.to === 'string' ? r.to : DEFAULT_PARAMS.to
  return { place, variables, resolution, from, to }
}
