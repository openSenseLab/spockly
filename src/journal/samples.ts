export type SampleId = 'stations' | 'zones' | 'weather'

export type Sample = {
  id: SampleId
  path: string
  format: 'csv' | 'geojson'
  spatial: boolean
  /** CSV columns to read as dates. */
  parseDates?: string[]
  /** CSV coordinate columns: the generated code turns the table into points. */
  lonLat?: [string, string]
}

/** Synthetic teaching datasets in public/data (see scripts/make_samples.py). */
export const SAMPLES: Sample[] = [
  { id: 'stations', path: 'data/stations.csv', format: 'csv', spatial: true, parseDates: ['installed'], lonLat: ['lon', 'lat'] },
  { id: 'zones', path: 'data/zones.geojson', format: 'geojson', spatial: true },
  { id: 'weather', path: 'data/weather.csv', format: 'csv', spatial: false, parseDates: ['date'] },
]

/** Absolute URL of a sample file, as it appears in the generated Python code. */
export const sampleUrl = (sample: Sample) => new URL(`${import.meta.env.BASE_URL}${sample.path}`, window.location.href).href
