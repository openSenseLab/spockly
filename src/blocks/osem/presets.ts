import type { LocalizedText } from '../../core/types'

export interface AreaPreset {
  id: string
  label: LocalizedText
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number]
}

/**
 * Bounding rectangles of the administrative boundaries, looked up in
 * OpenStreetMap (Nominatim) on 2026-10-07. A rectangle also covers bits of
 * the neighbouring areas.
 */
export const AREA_PRESETS: AreaPreset[] = [
  {
    id: 'muenster-mitte',
    label: { de: 'Münster – Stadtbezirk Mitte', en: 'Münster – Mitte district' },
    bbox: [7.5897085, 51.9205942, 7.6647924, 51.989764],
  },
  {
    id: 'muenster',
    label: { de: 'Münster – ganze Stadt', en: 'Münster – whole city' },
    bbox: [7.4737853, 51.8401448, 7.7743634, 52.0600251],
  },
  {
    id: 'kreis-steinfurt',
    label: { de: 'Kreis Steinfurt', en: 'Steinfurt district' },
    bbox: [7.09468, 51.9946493, 8.0251795, 52.4750082],
  },
  {
    id: 'kreis-coesfeld',
    label: { de: 'Kreis Coesfeld', en: 'Coesfeld district' },
    bbox: [7.0515499, 51.6647032, 7.7372746, 52.0622302],
  },
  {
    id: 'kreis-warendorf',
    label: { de: 'Kreis Warendorf', en: 'Warendorf district' },
    bbox: [7.6113671, 51.658104, 8.3200888, 52.1040337],
  },
]

export const areaPreset = (id: string) => AREA_PRESETS.find((a) => a.id === id)

/**
 * The periods for fetching measurements. `rows`: for how many rows (sensors)
 * at most. A sensor sends about one value a minute, so the longer the period,
 * the fewer sensors, or students wait over a minute for some 300,000 rows.
 */
export const PERIODS = {
  '1d': { days: 1, rows: 50, label: { de: 'letzte 24 Stunden', en: 'last 24 hours' } },
  '3d': { days: 3, rows: 20, label: { de: 'letzte 3 Tage', en: 'last 3 days' } },
  '7d': { days: 7, rows: 10, label: { de: 'letzte 7 Tage', en: 'last 7 days' } },
} as const satisfies Record<string, { days: number; rows: number; label: LocalizedText }>

export type PeriodId = keyof typeof PERIODS
export const isPeriodId = (value: unknown): value is PeriodId =>
  typeof value === 'string' && value in PERIODS

/** The dropdown value for a period students type themselves: "vom … bis …". */
export const CUSTOM_PERIOD = 'custom'

/** At most so many rows (sensors) for a period of so many days: as many as the preset that fits. */
export const rowsFor = (days: number) => (days <= PERIODS['1d'].days ? PERIODS['1d'].rows : days <= PERIODS['3d'].days ? PERIODS['3d'].rows : PERIODS['7d'].rows)

/**
 * A day as "YYYY-MM-DD", from what students type: 15.11.2026 (also 5.1.2026)
 * or 2026-11-15. Null if it is no day of the calendar.
 */
export function parseDay(text: string): string | null {
  const trimmed = text.trim()
  const german = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const [year, month, day] = german ? [german[3], german[2], german[1]].map(Number) : iso ? [iso[1], iso[2], iso[3]].map(Number) : []
  if (year === undefined) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // 31.2. would become 3.3.: not a day.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

/** The day so many days before today, as "YYYY-MM-DD". */
export const daysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10)

/** How many days from one day to another, both included: 2026-11-15 to 2026-11-15 is 1. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
