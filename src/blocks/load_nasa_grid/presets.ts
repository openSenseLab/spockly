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
  /** Where the outline comes from, for the dataset's credit line. */
  outlineCredit: string
  /** Places drawn on the map for orientation. */
  landmarks: Landmark[]
}

/**
 * Outlines of Germany and its states: Huwise "georef-germany-land" (© GeoBasis-DE / BKG, Datenlizenz
 * Deutschland – Namensnennung – Version 2.0), downloaded 2026-10-26, Germany
 * dissolved from the 16 states, simplified with mapshaper to 4 % of the points
 * and rounded to 0.001°. The data was changed, which the credit says.
 */
export const OUTLINE_CREDIT =
  '© GeoBasis-DE / BKG (2025), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), ' +
  'Datensatz https://hub.huwise.com/explore/dataset/georef-germany-land/; Umrisse vereinfacht (Daten geändert).'

/**
 * Outlines of the neighbouring countries: Natural Earth 5.1.2,
 * ne_50m_admin_0_countries (public domain), European parts only (the
 * Netherlands' Caribbean islands are left out), rounded to 0.001°. France is
 * missing: wider than the 10° NASA answers for in one request.
 */
export const NE_OUTLINE_CREDIT = 'Natural Earth 5.1.2 (ne_50m_admin_0_countries, gemeinfrei); auf 0,001° gerundet.'

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
// Neighbouring countries: capital and a few large cities (ne_10m_populated_places_simple, v5.1.2).
const AMSTERDAM = city('Amsterdam', 'Amsterdam', 52.35, 4.91)
const ROTTERDAM = city('Rotterdam', 'Rotterdam', 51.92, 4.48)
const GRONINGEN = city('Groningen', 'Groningen', 53.22, 6.58)
const BRUESSEL = city('Brüssel', 'Brussels', 50.84, 4.33)
const ANTWERPEN = city('Antwerpen', 'Antwerp', 51.22, 4.41)
const LUETTICH = city('Lüttich', 'Liège', 50.63, 5.58)
const LUXEMBURG = city('Luxemburg', 'Luxembourg', 49.61, 6.13)
const BERN = city('Bern', 'Bern', 46.92, 7.47)
const ZUERICH = city('Zürich', 'Zurich', 47.38, 8.55)
const GENF = city('Genf', 'Geneva', 46.21, 6.14)
const BASEL = city('Basel', 'Basel', 47.58, 7.59)
const WIEN = city('Wien', 'Vienna', 48.2, 16.36)
const GRAZ = city('Graz', 'Graz', 47.08, 15.41)
const INNSBRUCK = city('Innsbruck', 'Innsbruck', 47.28, 11.41)
const SALZBURG = city('Salzburg', 'Salzburg', 47.81, 13.04)
const KOPENHAGEN = city('Kopenhagen', 'Copenhagen', 55.68, 12.56)
const AARHUS = city('Aarhus', 'Aarhus', 56.16, 10.21)
const ODENSE = city('Odense', 'Odense', 55.4, 10.38)
const PRAG = city('Prag', 'Prague', 50.09, 14.46)
const BRUENN = city('Brünn', 'Brno', 49.2, 16.61)
const OSTRAVA = city('Ostrava', 'Ostrava', 49.83, 18.25)
const WARSCHAU = city('Warschau', 'Warsaw', 52.25, 21.0)
const KRAKAU = city('Krakau', 'Kraków', 50.06, 19.96)
const DANZIG = city('Danzig', 'Gdańsk', 54.36, 18.64)
const BRESLAU = city('Breslau', 'Wrocław', 51.11, 17.03)
const POSEN = city('Posen', 'Poznań', 52.41, 16.9)

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
    outlineCredit: OUTLINE_CREDIT,
    landmarks: [BERLIN, HAMBURG, MUENCHEN, KOELN, FRANKFURT, STUTTGART, DRESDEN, place('muenster'), place('sylt'), place('zugspitze')],
  },
  {
    id: 'nrw',
    label: { de: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia' },
    bbox: [5.87, 50.32, 9.46, 52.53],
    outline: outlines.nrw as Geometry,
    outlineCredit: OUTLINE_CREDIT,
    // Münster and the big cities; the small towns of the point block would cover each other's names.
    landmarks: [KOELN, DUESSELDORF, DORTMUND, BIELEFELD, place('muenster')],
  },
  {
    id: 'bayern',
    label: { de: 'Bayern', en: 'Bavaria' },
    bbox: [8.98, 47.27, 13.84, 50.56],
    outline: outlines.bayern as Geometry,
    outlineCredit: OUTLINE_CREDIT,
    landmarks: [MUENCHEN, NUERNBERG, AUGSBURG, REGENSBURG, WUERZBURG, place('zugspitze')],
  },
  // Neighbouring countries (German alphabetical order). Rectangles under 2° from north to south
  // (NASA's minimum) are widened around the country; the outline filter keeps only its cells.
  {
    id: 'belgien',
    label: { de: 'Belgien', en: 'Belgium' },
    bbox: [2.52, 49.5, 6.37, 51.51],
    outline: outlines.belgien as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [BRUESSEL, ANTWERPEN, LUETTICH],
  },
  {
    id: 'daenemark',
    label: { de: 'Dänemark', en: 'Denmark' },
    bbox: [8.12, 54.62, 15.14, 57.74],
    outline: outlines.daenemark as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [KOPENHAGEN, AARHUS, ODENSE],
  },
  {
    id: 'luxemburg',
    label: { de: 'Luxemburg', en: 'Luxembourg' },
    // Smaller than one grid cell is wide: only 4 cells touch it.
    bbox: [5.1, 48.8, 7.11, 50.81],
    outline: outlines.luxemburg as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [LUXEMBURG],
  },
  {
    id: 'niederlande',
    label: { de: 'Niederlande', en: 'Netherlands' },
    bbox: [3.35, 50.75, 7.2, 53.63],
    outline: outlines.niederlande as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [AMSTERDAM, ROTTERDAM, GRONINGEN],
  },
  {
    id: 'oesterreich',
    label: { de: 'Österreich', en: 'Austria' },
    bbox: [9.52, 46.4, 17.15, 49.01],
    outline: outlines.oesterreich as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [WIEN, GRAZ, INNSBRUCK, SALZBURG],
  },
  {
    id: 'polen',
    label: { de: 'Polen', en: 'Poland' },
    // 9.99° wide: just within the 10° of one request.
    bbox: [14.12, 49.02, 24.11, 54.84],
    outline: outlines.polen as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [WARSCHAU, KRAKAU, DANZIG, BRESLAU, POSEN],
  },
  {
    id: 'schweiz',
    label: { de: 'Schweiz', en: 'Switzerland' },
    bbox: [5.97, 45.8, 10.46, 47.81],
    outline: outlines.schweiz as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [BERN, ZUERICH, GENF, BASEL],
  },
  {
    id: 'tschechien',
    label: { de: 'Tschechien', en: 'Czechia' },
    bbox: [12.09, 48.57, 18.84, 51.04],
    outline: outlines.tschechien as Geometry,
    outlineCredit: NE_OUTLINE_CREDIT,
    landmarks: [PRAG, BRUENN, OSTRAVA],
  },
]

export const areaPreset = (id: string) => AREA_PRESETS.find((a) => a.id === id)

/** NASA POWER's limits for a grid request, in degrees per direction. */
export const MIN_SPAN = 2
export const MAX_SPAN = 10
