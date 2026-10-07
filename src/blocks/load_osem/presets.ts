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

export const PERIODS = {
  '1d': { days: 1, label: { de: 'letzte 24 Stunden', en: 'last 24 hours' } },
  '3d': { days: 3, label: { de: 'letzte 3 Tage', en: 'last 3 days' } },
  '7d': { days: 7, label: { de: 'letzte 7 Tage', en: 'last 7 days' } },
} as const satisfies Record<string, { days: number; label: LocalizedText }>

export type PeriodId = keyof typeof PERIODS
export const isPeriodId = (value: unknown): value is PeriodId =>
  typeof value === 'string' && value in PERIODS
