import { afterEach, describe, expect, it, vi } from 'vitest'

import brightSky from './__fixtures__/brightsky-muenster-four-hours.json?raw'
import emsc from './__fixtures__/emsc-germany-2025-three.geojson?raw'
import eonet from './__fixtures__/eonet-storms-2025-three.geojson?raw'
import gbif from './__fixtures__/gbif-kraniche-muenster-2024-three.json?raw'
import owid from './__fixtures__/owid-co2-per-capita-germany-three.csv?raw'
import stations from './__fixtures__/pegelonline-stations-two.json?raw'
import usgs from './__fixtures__/usgs-2.5_week-three.geojson?raw'
import { checkUrl, normalizeUrlParams, shortUrl, toUrlTable } from './mapping'
import { loadUrl, loadUrlOperation } from './operation'
import { URL_EXAMPLES } from './presets'

const example = (id: string) => URL_EXAMPLES.find((e) => e.id === id)!.url
/** An own address (not an example): CSV per country and year, no coordinates. */
const OWID = 'https://ourworldindata.org/grapher/co-emissions-per-capita.csv'
/** Own addresses, no longer examples: hourly weather (places in a separate list) and gauging stations (no times). */
const BRIGHT_SKY = 'https://api.brightsky.dev/weather?lat=51.96&lon=7.63&date=2026-10-20&last_date=2026-10-27'
const PEGEL_STATIONS = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json'
const kinds = (table: ReturnType<typeof toUrlTable>) => Object.fromEntries(table.columns.map((c) => [c.name, c.semanticType]))

afterEach(() => vi.unstubAllGlobals())

describe('toUrlTable (real answers, recorded 2026-10-28)', () => {
  it('reads USGS earthquakes (GeoJSON): points, magnitude, time as dates', () => {
    const table = toUrlTable({ url: example('erdbeben') }, usgs, 'application/json')
    expect(table.rows).toHaveLength(3)
    expect(table.rows[0]).toMatchObject({ mag: 3.8, place: '21 km SE of Esperanza, Puerto Rico', time: '2026-10-28T09:43:59.075Z' })
    expect(table.rows[0].geometry).toEqual({ type: 'Point', coordinates: [-65.3403, 17.9478, 32.782] })
    expect(kinds(table)).toMatchObject({ mag: 'measurement', time: 'timestamp', geometry: 'geometry' })
    expect(table.meta.title.de).toBe('Erdbeben weltweit, letzte 7 Tage')
    expect(table.meta.source.name).toBe('U.S. Geological Survey (USGS)')
    expect(table.meta.knownIssues?.at(-1)?.de).toContain('Lizenz dieser Daten kennt SPOCKLY nicht')
  })

  it('finds the hourly records in the Bright Sky answer ("weather", not "sources")', () => {
    const table = toUrlTable({ url: BRIGHT_SKY }, brightSky, 'application/json')
    expect(table.rows).toHaveLength(4)
    expect(table.rows[0]).toMatchObject({ timestamp: '2026-10-20T00:00:00+00:00', temperature: 5.7, relative_humidity: 86 })
    expect(kinds(table)).toMatchObject({ timestamp: 'timestamp', temperature: 'measurement', source_id: 'identifier' })
  })

  it('reads PEGELONLINE stations with coordinates and the nested waterway', () => {
    const table = toUrlTable({ url: PEGEL_STATIONS }, stations, 'application/json')
    const muenster = table.rows.find((r) => r.shortname === 'MÜNSTER OW')!
    expect(muenster).toMatchObject({ latitude: 51.968942, longitude: 7.664374, water_longname: 'DORTMUND-EMS-KANAL', km: 70.315 })
    expect(kinds(table)).toMatchObject({ latitude: 'latitude', longitude: 'longitude', number: 'identifier', uuid: 'identifier' })
    // "27800040" is a gauge number, not a quantity.
    expect(muenster.number).toBe('27800040')
  })

  it('reads EMSC earthquakes (GeoJSON): points, magnitude, region, time', () => {
    const table = toUrlTable({ url: example('erdbeben_deutschland') }, emsc, 'application/json')
    expect(table.rows).toHaveLength(3)
    expect(table.rows[0]).toMatchObject({ mag: 2.3, flynn_region: 'FRANCE-GERMANY BORDER REGION', time: '2025-12-31T03:15:39.41Z' })
    expect(table.rows[0].geometry).toEqual({ type: 'Point', coordinates: [7.9684, 47.6988, -8.3] })
    expect(kinds(table)).toMatchObject({ mag: 'measurement', time: 'timestamp', geometry: 'geometry' })
  })

  it('reads NASA EONET storm tracks: one point per storm and time, wind speed, name', () => {
    const table = toUrlTable({ url: example('wirbelstuerme_2025') }, eonet, 'application/rss+xml; charset=utf-8')
    expect(table.rows.map((r) => [r.title, r.date, r.magnitudeValue])).toEqual([
      ['Tropical Cyclone Iggy', '2025-12-31T12:00:00Z', 35],
      ['Tropical Cyclone Iggy', '2025-12-31T18:00:00Z', 35],
      ['Tropical Cyclone Iggy', '2026-01-01T00:00:00Z', 45],
    ])
    expect(table.rows[0].geometry).toEqual({ type: 'Point', coordinates: [105.7, -10.5] })
    expect(kinds(table)).toMatchObject({ date: 'timestamp', magnitudeValue: 'measurement', geometry: 'geometry' })
  })

  it('reads Our World in Data CSV with years as times', () => {
    const table = toUrlTable({ url: OWID }, owid, 'text/csv')
    expect(table.rows.map((r) => [r.Year, r['CO₂ emissions per capita']])).toEqual([
      ['2022', 7.942359],
      ['2023', 7.022808],
      ['2024', 6.7688236],
    ])
    // Three rows of "Germany": a category here; with all 26 509 rows (~250 countries) it is text.
    expect(kinds(table)).toMatchObject({ Entity: 'category', Code: 'identifier', Year: 'timestamp', 'CO₂ emissions per capita': 'measurement' })
  })

  it('reads GBIF sightings: position from decimalLatitude/-Longitude, date, number of birds; ids are no measurements', () => {
    const table = toUrlTable({ url: example('kraniche_muenster') }, gbif, 'application/json')
    expect(table.rows).toHaveLength(3)
    expect(table.rows[0]).toMatchObject({ eventDate: '2024-01-07', individualCount: 12, year: '2024' })
    expect(kinds(table)).toMatchObject({
      decimalLatitude: 'latitude',
      decimalLongitude: 'longitude',
      eventDate: 'timestamp',
      individualCount: 'measurement',
      key: 'identifier',
      taxonKey: 'identifier',
      gbifID: 'identifier',
    })
  })

  it('says when an address gives a web page instead of data', () => {
    expect(() => toUrlTable({ url: 'https://example.org/' }, '<!doctype html><html></html>', 'text/html')).toThrow(
      expect.objectContaining({ code: 'load.url.html' }),
    )
  })
})

describe('loadUrl', () => {
  it('asks the address and reads it with the settings from the setup window', async () => {
    const fetchMock = vi.fn(async () => new Response(owid, { headers: { 'Content-Type': 'text/csv' } }))
    vi.stubGlobal('fetch', fetchMock)
    const table = await loadUrl({ url: OWID, read: { format: 'csv', delimiter: ',' } })
    expect(fetchMock).toHaveBeenCalledWith(OWID, expect.anything())
    expect(table.rows).toHaveLength(3)
  })

  it('explains blocked addresses (CORS) and 404 for a web address, not a data portal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    vi.useFakeTimers()
    const blocked = loadUrl({ url: 'https://example.org/data.csv' })
    const check = expect(blocked).rejects.toMatchObject({ code: 'load.url.unreachable' })
    await vi.runAllTimersAsync()
    await check
    vi.useRealTimers()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(loadUrl({ url: 'https://example.org/data.csv' })).rejects.toMatchObject({ code: 'load.url.notFound' })
  })

  it('refuses answers announced as larger than 30 MB', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('a', { headers: { 'Content-Length': '40000000' } })))
    await expect(loadUrl({ url: 'https://example.org/big.csv' })).rejects.toMatchObject({ code: 'load.tooBig' })
  })
})

describe('settings and Python', () => {
  it('accept only https addresses', () => {
    expect(checkUrl('https://example.org/a.csv')).toBeNull()
    expect(checkUrl('http://example.org/a.csv')).toBe('url.check.notHttps')
    expect(checkUrl('example.org')).toBe('url.check.notAddress')
    expect(checkUrl('javascript:alert(1)')).toBe('url.check.notAddress')
  })

  it('fall back to the first example for odd saved settings, and drop odd read settings', () => {
    expect(normalizeUrlParams({ url: 'ftp://x' }).url).toBe(URL_EXAMPLES[0].url)
    expect(normalizeUrlParams({ url: 'https://example.org/a.csv', read: { format: 'xml' } })).toEqual({
      url: 'https://example.org/a.csv',
      read: undefined,
    })
  })

  it('shorten long addresses for the block', () => {
    expect(shortUrl(example('erdbeben'))).toBe('earthquake.usgs.gov/…/2.5_week.geojson')
  })

  it('read the answer in Python like the app does', () => {
    const csv = loadUrlOperation.toCode!({ url: OWID, read: { format: 'csv', delimiter: ',' } }, { output: 'co2' }).python
    expect(csv).toContain('co2 = pd.read_csv(io.StringIO(text), sep=",")')
    const json = loadUrlOperation.toCode!({ url: BRIGHT_SKY, read: { format: 'json', path: ['weather'] } }).python
    expect(json).toContain('df = pd.json_normalize(daten["weather"], sep="_")')
    const geo = loadUrlOperation.toCode!({ url: example('erdbeben'), read: { format: 'geojson', path: ['features'] } }).python
    expect(geo).toContain('df["geometry"] = [m["geometry"] for m in merkmale]')
  })
})
