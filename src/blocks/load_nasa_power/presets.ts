import type { LocalizedText } from '../../core/types'

export interface PlacePreset {
  id: string
  label: LocalizedText
  lat: number
  lon: number
}

/**
 * Points looked up in OpenStreetMap (Nominatim) on 2026-10-13. NASA POWER
 * returns the grid cell around the point, so a town centre is precise enough.
 * Sylt and the Zugspitze are there to compare coast, inland and mountains.
 */
export const PLACE_PRESETS: PlacePreset[] = [
  { id: 'muenster', label: { de: 'Münster', en: 'Münster' }, lat: 51.9625, lon: 7.6252 },
  { id: 'steinfurt', label: { de: 'Steinfurt', en: 'Steinfurt' }, lat: 52.1378, lon: 7.3581 },
  { id: 'coesfeld', label: { de: 'Coesfeld', en: 'Coesfeld' }, lat: 51.9459, lon: 7.1691 },
  { id: 'warendorf', label: { de: 'Warendorf', en: 'Warendorf' }, lat: 51.9532, lon: 7.9912 },
  { id: 'sylt', label: { de: 'Sylt (Westerland)', en: 'Sylt (Westerland)' }, lat: 54.9065, lon: 8.3072 },
  { id: 'zugspitze', label: { de: 'Zugspitze', en: 'Zugspitze' }, lat: 47.4212, lon: 10.9863 },
]

export const placePreset = (id: string) => PLACE_PRESETS.find((p) => p.id === id)

export interface Variable {
  /** POWER parameter code. */
  code: string
  label: LocalizedText
  /** Shown until the API reports its own unit. */
  unit: string
}

/** A small, student-friendly selection of POWER parameters (all checked against the API). */
export const VARIABLES: Variable[] = [
  { code: 'T2M', label: { de: 'Temperatur (Mittel)', en: 'Temperature (mean)' }, unit: '°C' },
  { code: 'T2M_MAX', label: { de: 'Höchsttemperatur', en: 'Maximum temperature' }, unit: '°C' },
  { code: 'T2M_MIN', label: { de: 'Tiefsttemperatur', en: 'Minimum temperature' }, unit: '°C' },
  { code: 'PRECTOTCORR', label: { de: 'Niederschlag', en: 'Precipitation' }, unit: 'mm/d' },
  { code: 'RH2M', label: { de: 'Relative Luftfeuchte', en: 'Relative humidity' }, unit: '%' },
  { code: 'WS10M', label: { de: 'Wind in 10 m Höhe', en: 'Wind at 10 m' }, unit: 'm/s' },
  { code: 'WS50M', label: { de: 'Wind in 50 m Höhe', en: 'Wind at 50 m' }, unit: 'm/s' },
  { code: 'ALLSKY_SFC_SW_DWN', label: { de: 'Sonneneinstrahlung', en: 'Solar radiation' }, unit: 'kWh/m²/d' },
  { code: 'PS', label: { de: 'Luftdruck', en: 'Air pressure' }, unit: 'kPa' },
]

export const variable = (code: string) => VARIABLES.find((v) => v.code === code)

/** POWER writes units in ASCII ("C", "kW-hr/m^2/day"); show them the usual way. */
const UNIT_NAMES: Record<string, string> = {
  C: '°C',
  'mm/day': 'mm/d',
  'kW-hr/m^2/day': 'kWh/m²/d',
}
export const prettyUnit = (unit: string) => UNIT_NAMES[unit] ?? unit

/** First day POWER has daily and monthly data for. */
export const FIRST_DATE = '1981-01-01'
