import type { LocalizedText } from '../../core/types'

export interface UrlExample {
  id: string
  label: LocalizedText
  /** What students find in it. */
  about: LocalizedText
  url: string
  /** Who provides it, and the page that describes the data. */
  source: { name: string; page: string }
}

/**
 * Web addresses that are known to work from the browser (checked on
 * 2026-11-02: answers with Access-Control-Allow-Origin: *). Every example is
 * spatio-temporal: each row has a place and a time, at local and global
 * scale. Fixed periods where the source allows it, so lessons can be
 * repeated. Licences are not checked yet, so the block shows its general
 * licence note for these too.
 */
export const URL_EXAMPLES: UrlExample[] = [
  {
    id: 'erdbeben',
    label: { de: 'Erdbeben weltweit, letzte 7 Tage', en: 'Earthquakes worldwide, last 7 days' },
    about: {
      de: 'Jedes Beben ab Stärke 2,5 mit Ort, Zeit, Stärke und Tiefe (GeoJSON, wird laufend aktualisiert).',
      en: 'Every quake from magnitude 2.5 with place, time, magnitude and depth (GeoJSON, updated continuously).',
    },
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    source: { name: 'U.S. Geological Survey (USGS)', page: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php' },
  },
  {
    // The box reaches into neighbouring countries; 193 quakes, fewer than the limit of 1000, so the year is complete.
    id: 'erdbeben_deutschland',
    label: { de: 'Erdbeben in und um Deutschland, 2025', en: 'Earthquakes in and around Germany, 2025' },
    about: {
      de: 'Jedes Beben ab Stärke 2 mit Ort, Zeit, Stärke, Tiefe und Region. Wo bebt es in Deutschland? (GeoJSON)',
      en: 'Every quake from magnitude 2 with place, time, magnitude, depth and region. Where does the earth shake in Germany? (GeoJSON)',
    },
    url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=47&maxlat=55.1&minlon=5.8&maxlon=15.1&start=2025-01-01&end=2025-12-31&minmag=2&limit=1000',
    source: { name: 'EMSC – Euro-Mediterranean Seismological Centre', page: 'https://www.seismicportal.eu' },
  },
  {
    // 97 storms with 1935 positions; tracks of storms that began in 2025 run into January 2026.
    id: 'wirbelstuerme_2025',
    label: { de: 'Wirbelstürme weltweit, 2025', en: 'Tropical storms worldwide, 2025' },
    about: {
      de: 'Die Zugbahn jedes Sturms: Position alle 6 Stunden mit Name, Zeit und Windgeschwindigkeit in Knoten. (GeoJSON)',
      en: 'The track of every storm: its position every 6 hours with name, time and wind speed in knots. (GeoJSON)',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=severeStorms&status=all&start=2025-01-01&end=2025-12-31',
    source: { name: 'NASA EONET – Earth Observatory Natural Event Tracker', page: 'https://eonet.gsfc.nasa.gov' },
  },
  {
    // 48 fires, June to August 2025.
    id: 'waldbraende_europa_2025',
    label: { de: 'Große Waldbrände in Europa, 2025', en: 'Large wildfires in Europe, 2025' },
    about: {
      de: 'Jeder gemeldete große Brand mit Ort, Datum und verbrannter Fläche in Hektar. In welchen Monaten und Ländern brennt es? (GeoJSON)',
      en: 'Every reported large fire with place, date and burnt area in hectares. In which months and countries does it burn? (GeoJSON)',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=wildfires&status=all&start=2025-01-01&end=2025-12-31&bbox=-11,72,32,34',
    source: { name: 'NASA EONET – Earth Observatory Natural Event Tracker', page: 'https://eonet.gsfc.nasa.gov' },
  },
  {
    // 521 eruptions; a few are areas (polygons) instead of points.
    id: 'vulkane_2016_2025',
    label: { de: 'Vulkanausbrüche weltweit, 2016–2025', en: 'Volcanic eruptions worldwide, 2016–2025' },
    about: {
      de: 'Jeder gemeldete Ausbruch mit Vulkan, Ort und Datum. Welche Vulkane brechen immer wieder aus? (GeoJSON)',
      en: 'Every reported eruption with volcano, place and date. Which volcanoes erupt again and again? (GeoJSON)',
    },
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=volcanoes&status=all&start=2016-01-01&end=2025-12-31',
    source: { name: 'NASA EONET – Earth Observatory Natural Event Tracker', page: 'https://eonet.gsfc.nasa.gov' },
  },
  {
    // GBIF's species key for Grus grus is 2474950 (species/match, 2026-11-02). One request
    // returns at most 300 records; Münster in 2024 has 126, so the year is complete.
    id: 'kraniche_muenster',
    label: { de: 'Kraniche in Münster, 2024', en: 'Common cranes in Münster, 2024' },
    about: {
      de: 'Jede gemeldete Beobachtung mit Ort, Datum und oft der Zahl der Vögel. Wann im Jahr werden sie gesehen? (JSON, meist über iNaturalist und eBird gemeldet)',
      en: 'Every reported sighting with place, date and often the number of birds. When in the year are they seen? (JSON, mostly reported via iNaturalist and eBird)',
    },
    url: 'https://api.gbif.org/v1/occurrence/search?taxonKey=2474950&decimalLatitude=51.8401448,52.0600251&decimalLongitude=7.4737853,7.7743634&year=2024&hasCoordinate=true&limit=300',
    source: { name: 'GBIF – Global Biodiversity Information Facility', page: 'https://www.gbif.org' },
  },
]

export const exampleFor = (url: string) => URL_EXAMPLES.find((e) => e.url === url)

/** Larger answers are refused before downloading. */
export const MAX_URL_BYTES = 30_000_000
