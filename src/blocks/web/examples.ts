import type { LocalizedText } from '../../core/types'

/** What a web address sends; decides which blocks fit next (CSV, JSON, GeoJSON). */
export type WebKind = 'csv' | 'json' | 'geojson'

export interface WebExample {
  id: string
  label: LocalizedText
  /** What students find in it. */
  about: LocalizedText
  url: string
  kind: WebKind
  /** Who provides the data. */
  source: string
}

/**
 * Web addresses known to work from the browser: they answer with
 * Access-Control-Allow-Origin: * (from the data-loaders spike, checked again on
 * 2026-11-25). Every example is spatio-temporal: each row has a place and a
 * time, at local and global scale. Fixed periods where the source allows it,
 * so lessons can be repeated.
 */
export const WEB_EXAMPLES: WebExample[] = [
  {
    id: 'erdbeben',
    label: { de: 'Erdbeben weltweit, letzte 7 Tage', en: 'Earthquakes worldwide, last 7 days' },
    about: {
      de: 'Jedes Beben ab Stärke 2,5 mit Ort, Zeit, Stärke und Tiefe. GeoJSON, wird laufend aktualisiert.',
      en: 'Every quake from magnitude 2.5 with place, time, magnitude and depth. GeoJSON, updated continuously.',
    },
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    kind: 'geojson',
    source: 'U.S. Geological Survey (USGS)',
  },
  {
    // The box reaches into neighbouring countries; fewer quakes than the limit of 1000, so the year is complete.
    id: 'erdbeben_deutschland',
    label: { de: 'Erdbeben in und um Deutschland, 2025', en: 'Earthquakes in and around Germany, 2025' },
    about: {
      de: 'Jedes Beben ab Stärke 2 mit Ort, Zeit, Stärke, Tiefe und Region. Wo bebt es in Deutschland? GeoJSON.',
      en: 'Every quake from magnitude 2 with place, time, magnitude, depth and region. Where does the earth shake in Germany? GeoJSON.',
    },
    url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=47&maxlat=55.1&minlon=5.8&maxlon=15.1&start=2025-01-01&end=2025-12-31&minmag=2&limit=1000',
    kind: 'geojson',
    source: 'EMSC – Euro-Mediterranean Seismological Centre',
  },
  {
    id: 'wirbelstuerme_2025',
    label: { de: 'Wirbelstürme weltweit, 2025', en: 'Tropical storms worldwide, 2025' },
    about: {
      de: 'Die Zugbahn jedes Sturms: Position alle 6 Stunden mit Name, Zeit und Windgeschwindigkeit in Knoten. GeoJSON.',
      en: 'The track of every storm: its position every 6 hours with name, time and wind speed in knots. GeoJSON.',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=severeStorms&status=all&start=2025-01-01&end=2025-12-31',
    kind: 'geojson',
    source: 'NASA EONET – Earth Observatory Natural Event Tracker',
  },
  {
    id: 'waldbraende_europa_2025',
    label: { de: 'Große Waldbrände in Europa, 2025', en: 'Large wildfires in Europe, 2025' },
    about: {
      de: 'Jeder gemeldete große Brand mit Ort, Datum und verbrannter Fläche in Hektar. In welchen Monaten und Ländern brennt es? GeoJSON.',
      en: 'Every reported large fire with place, date and burnt area in hectares. In which months and countries does it burn? GeoJSON.',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=wildfires&status=all&start=2025-01-01&end=2025-12-31&bbox=-11,72,32,34',
    kind: 'geojson',
    source: 'NASA EONET – Earth Observatory Natural Event Tracker',
  },
  {
    // A few eruptions are areas (polygons) instead of points.
    id: 'vulkane_2016_2025',
    label: { de: 'Vulkanausbrüche weltweit, 2016–2025', en: 'Volcanic eruptions worldwide, 2016–2025' },
    about: {
      de: 'Jeder gemeldete Ausbruch mit Vulkan, Ort und Datum. Welche Vulkane brechen immer wieder aus? GeoJSON.',
      en: 'Every reported eruption with volcano, place and date. Which volcanoes erupt again and again? GeoJSON.',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=volcanoes&status=all&start=2016-01-01&end=2025-12-31',
    kind: 'geojson',
    source: 'NASA EONET – Earth Observatory Natural Event Tracker',
  },
  {
    // GBIF's species key for Grus grus is 2474950. One request returns at most 300 records; Münster in 2024 has fewer.
    id: 'kraniche_muenster',
    label: { de: 'Kraniche in Münster, 2024', en: 'Common cranes in Münster, 2024' },
    about: {
      de: 'Jede gemeldete Beobachtung mit Ort, Datum und oft der Zahl der Vögel. Wann im Jahr werden sie gesehen? JSON.',
      en: 'Every reported sighting with place, date and often the number of birds. When in the year are they seen? JSON.',
    },
    url: 'https://api.gbif.org/v1/occurrence/search?taxonKey=2474950&decimalLatitude=51.8401448,52.0600251&decimalLongitude=7.4737853,7.7743634&year=2024&hasCoordinate=true&limit=300',
    kind: 'json',
    source: 'GBIF – Global Biodiversity Information Facility',
  },
]

export const webExample = (id: string) => WEB_EXAMPLES.find((example) => example.id === id)
export const exampleForUrl = (url: string) => WEB_EXAMPLES.find((example) => example.url === url.trim())

/** What an own address probably sends, from its ending or a "format=" in it; null if unknown. */
export function guessKind(url: string): WebKind | null {
  const example = exampleForUrl(url)
  if (example) return example.kind
  const text = url.toLowerCase()
  const path = text.split(/[?#]/)[0]
  if (/\.(csv|tsv)$/.test(path) || /[?&]format=csv\b/.test(text)) return 'csv'
  if (path.endsWith('.geojson') || /[?&]format=geojson\b/.test(text)) return 'geojson'
  if (path.endsWith('.json') || /[?&]format=json\b/.test(text)) return 'json'
  return null
}

/** Whether a text is a web address the browser can ask: http or https. */
export const isWebAddress = (text: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(text.trim())
