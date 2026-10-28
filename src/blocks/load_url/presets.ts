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
 * 2026-10-28: answers with Access-Control-Allow-Origin: *). Points, lines of
 * time and places, at local and global scale. Licences are not checked yet,
 * so the block shows its general licence note for these too.
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
    id: 'pegel_muenster',
    label: { de: 'Wasserstand in Münster, letzte 3 Tage', en: 'Water level in Münster, last 3 days' },
    about: {
      de: 'Ein Wert pro Minute vom Pegel MÜNSTER OW am Dortmund-Ems-Kanal.',
      en: 'One value per minute from the gauge MÜNSTER OW on the Dortmund-Ems Canal.',
    },
    url: 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/M%C3%9CNSTER%20OW/W/measurements.json?start=P3D',
    source: { name: 'PEGELONLINE (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)', page: 'https://www.pegelonline.wsv.de' },
  },
  {
    id: 'pegelstationen',
    label: { de: 'Pegel an Bundeswasserstraßen', en: 'Gauges on federal waterways' },
    about: {
      de: 'Alle Messstellen mit Lage, Gewässer und Kilometer (für die Karte).',
      en: 'All gauging stations with location, waterway and kilometre (for the map).',
    },
    url: 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json',
    source: { name: 'PEGELONLINE (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)', page: 'https://www.pegelonline.wsv.de' },
  },
  {
    id: 'wetter_muenster',
    label: { de: 'Wetter in Münster, 20.–27. Oktober 2026', en: 'Weather in Münster, 20–27 October 2026' },
    about: {
      de: 'Stündliche Werte von Wetterstationen des Deutschen Wetterdienstes, über Bright Sky.',
      en: 'Hourly values from German Weather Service stations, via Bright Sky.',
    },
    url: 'https://api.brightsky.dev/weather?lat=51.96&lon=7.63&date=2026-10-20&last_date=2026-10-27',
    source: { name: 'Bright Sky (Daten: Deutscher Wetterdienst)', page: 'https://brightsky.dev' },
  },
  {
    id: 'fluesse_welt',
    label: { de: 'Flüsse der Welt', en: 'Rivers of the world' },
    about: {
      de: 'Große Flüsse und die Linien durch Seen als Linien, Maßstab 1:50 Mio. (GeoJSON, Natural Earth 3.3.0 über geojson.xyz).',
      en: 'Major rivers and the lines through lakes, as lines, scale 1:50 million (GeoJSON, Natural Earth 3.3.0 via geojson.xyz).',
    },
    url: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines_scale_rank.geojson',
    source: { name: 'Natural Earth (über geojson.xyz)', page: 'https://geojson.xyz/' },
  },
  {
    id: 'co2',
    label: { de: 'CO₂-Ausstoß pro Kopf, je Land und Jahr', en: 'CO₂ emissions per person, by country and year' },
    about: {
      de: 'Tonnen pro Person für jedes Land, über viele Jahrzehnte (CSV).',
      en: 'Tonnes per person for every country, over many decades (CSV).',
    },
    url: 'https://ourworldindata.org/grapher/co-emissions-per-capita.csv',
    source: { name: 'Our World in Data', page: 'https://ourworldindata.org/grapher/co-emissions-per-capita' },
  },
]

export const exampleFor = (url: string) => URL_EXAMPLES.find((e) => e.url === url)

/** Larger answers are refused before downloading. */
export const MAX_URL_BYTES = 30_000_000
