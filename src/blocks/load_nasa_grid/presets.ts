import type { Geometry, LocalizedText } from '../../core/types'
import { placePreset } from '../load_nasa_power/presets'
import outlines from './outlines.json'

export interface Landmark {
  label: LocalizedText
  lat: number
  lon: number
}

export interface AreaPreset {
  id: string
  label: LocalizedText
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number]
  /** Simplified outline; only grid cells touching it are kept. */
  outline: Geometry
  /** Places drawn on the map for orientation. */
  landmarks: Landmark[]
}

/**
 * Outlines: Huwise "georef-germany-land" (© GeoBasis-DE / BKG, Datenlizenz
 * Deutschland – Namensnennung – Version 2.0), downloaded 2026-10-26, Germany
 * dissolved from the 16 states, simplified with mapshaper to 4 % of the points
 * and rounded to 0.001°. The data was changed, which the credit says.
 */
export const OUTLINE_CREDIT =
  '© GeoBasis-DE / BKG (2025), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), ' +
  'Datensatz https://hub.huwise.com/explore/dataset/georef-germany-land/; Umrisse vereinfacht (Daten geändert).'

/** City centres from Natural Earth (ne_10m_populated_places_simple, v5.1.2), rounded to 0.01°. */
const city = (de: string, en: string, lat: number, lon: number): Landmark => ({ label: { de, en }, lat, lon })
const BERLIN = city('Berlin', 'Berlin', 52.52, 13.4)
const HAMBURG = city('Hamburg', 'Hamburg', 53.55, 10.0)
const MUENCHEN = city('München', 'Munich', 48.13, 11.57)
const KOELN = city('Köln', 'Cologne', 50.93, 6.95)
const FRANKFURT = city('Frankfurt', 'Frankfurt', 50.1, 8.68)
const STUTTGART = city('Stuttgart', 'Stuttgart', 48.78, 9.2)
const DRESDEN = city('Dresden', 'Dresden', 51.05, 13.75)
const DUESSELDORF = city('Düsseldorf', 'Düsseldorf', 51.22, 6.78)
const DORTMUND = city('Dortmund', 'Dortmund', 51.53, 7.45)
const BIELEFELD = city('Bielefeld', 'Bielefeld', 52.03, 8.53)
const NUERNBERG = city('Nürnberg', 'Nuremberg', 49.45, 11.08)
const AUGSBURG = city('Augsburg', 'Augsburg', 48.35, 10.9)
const REGENSBURG = city('Regensburg', 'Regensburg', 49.02, 12.12)
const WUERZBURG = city('Würzburg', 'Würzburg', 49.8, 9.95)

/** The places of the NASA point block (Münster, Sylt, …), so both blocks can be compared. */
const place = (id: string): Landmark => {
  const p = placePreset(id)!
  return { label: p.label, lat: p.lat, lon: p.lon }
}

export const AREA_PRESETS: AreaPreset[] = [
  {
    id: 'deutschland',
    label: { de: 'Deutschland', en: 'Germany' },
    bbox: [5.87, 47.27, 15.04, 55.06],
    outline: outlines.deutschland as Geometry,
    landmarks: [BERLIN, HAMBURG, MUENCHEN, KOELN, FRANKFURT, STUTTGART, DRESDEN, place('muenster'), place('sylt'), place('zugspitze')],
  },
  {
    id: 'nrw',
    label: { de: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia' },
    bbox: [5.87, 50.32, 9.46, 52.53],
    outline: outlines.nrw as Geometry,
    // Münster and the big cities; the small towns of the point block would cover each other's names.
    landmarks: [KOELN, DUESSELDORF, DORTMUND, BIELEFELD, place('muenster')],
  },
  {
    id: 'bayern',
    label: { de: 'Bayern', en: 'Bavaria' },
    bbox: [8.98, 47.27, 13.84, 50.56],
    outline: outlines.bayern as Geometry,
    landmarks: [MUENCHEN, NUERNBERG, AUGSBURG, REGENSBURG, WUERZBURG, place('zugspitze')],
  },
]

export const areaPreset = (id: string) => AREA_PRESETS.find((a) => a.id === id)

/** NASA POWER's limits for a grid request, in degrees per direction. */
export const MIN_SPAN = 2
export const MAX_SPAN = 10
