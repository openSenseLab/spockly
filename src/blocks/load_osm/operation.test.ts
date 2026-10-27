import { afterEach, describe, expect, it, vi } from 'vitest'

import rivers from './__fixtures__/fluesse-muenster-mitte.json'
import { elementGeometry, normalizeOsmParams, toOsmTable, type OverpassResponse } from './mapping'
import { loadOsm, loadOsmOperation, snapshotUrl } from './operation'
import { osmTopic, OSM_TOPICS, overpassQuery, OVERPASS_SERVERS } from './presets'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const params = { topic: 'fluesse', area: 'muenster-mitte' }
const response = rivers as unknown as OverpassResponse

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('toOsmTable (rivers and streams, Münster-Mitte, recorded 2026-10-27)', () => {
  const table = toOsmTable(osmTopic('fluesse')!, params, response)

  it('makes one line per way, with name, kind and OSM id', () => {
    expect(table.rows).toHaveLength(response.elements.length)
    expect(table.rows.every((r) => (r.geometry as { type: string }).type === 'LineString')).toBe(true)
    expect(table.rows.map((r) => r.art)).toEqual(expect.arrayContaining(['river']))
    expect(table.rows[0].osm_id).toMatch(/^way\/\d+$/)
  })

  it('names the source, licence and credit as the ODbL asks', () => {
    expect(table.meta.source).toMatchObject({ name: 'OpenStreetMap', license: 'ODbL 1.0' })
    expect(table.meta.attribution).toContain('© OpenStreetMap')
    expect(table.meta.updated).toBe(response.osm3s?.timestamp_osm_base)
    expect(table.meta.knownIssues).toBeUndefined()
  })
})

describe('elementGeometry', () => {
  // Hand-made elements in the shape Overpass sends them.
  const ring = [
    { lat: 51.96, lon: 7.62 },
    { lat: 51.96, lon: 7.63 },
    { lat: 51.97, lon: 7.63 },
    { lat: 51.96, lon: 7.62 },
  ]
  it('turns nodes and way centres into points, closed ways of area topics into areas', () => {
    expect(elementGeometry({ type: 'node', id: 1, lat: 51.96, lon: 7.62 }, 'point')).toEqual({ type: 'Point', coordinates: [7.62, 51.96] })
    expect(elementGeometry({ type: 'way', id: 2, center: { lat: 51.9, lon: 7.6 } }, 'point')).toEqual({ type: 'Point', coordinates: [7.6, 51.9] })
    expect(elementGeometry({ type: 'way', id: 3, geometry: ring }, 'area')?.type).toBe('Polygon')
    // A closed way of a line topic (e.g. a round cycle path) stays a line.
    expect(elementGeometry({ type: 'way', id: 4, geometry: ring }, 'line')?.type).toBe('LineString')
    expect(elementGeometry({ type: 'way', id: 5, geometry: [ring[0]] }, 'line')).toBeNull()
  })
})

describe('loadOsm', () => {
  it('asks the servers in turn and uses the first answer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('at capacity', { status: 502 }))
      .mockResolvedValueOnce(new Response('at capacity', { status: 502 })) // the one retry of getJson
      .mockResolvedValueOnce(json(rivers))
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const steps: [number, number, string?][] = []
    const loading = loadOsm(params, { onProgress: (d, t, u) => steps.push([d, t, u]) })
    await vi.runAllTimersAsync()
    const table = await loading
    expect(table.rows).toHaveLength(response.elements.length)
    expect(table.meta.knownIssues).toBeUndefined()
    expect(String(fetchMock.mock.calls[2][0])).toContain(OVERPASS_SERVERS[1])
    expect(decodeURIComponent(String(fetchMock.mock.calls[2][0]))).toContain('way["waterway"')
    expect(steps).toEqual([
      [1, OVERPASS_SERVERS.length, 'servers'],
      [2, OVERPASS_SERVERS.length, 'servers'],
    ])
  })

  it('falls back to the stored copy when no server answers, and says so', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/data/osm/') ? json(rivers) : new Response('at capacity', { status: 502 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const loading = loadOsm(params)
    await vi.runAllTimersAsync()
    const table = await loading
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe(snapshotUrl(params))
    expect(table.rows).toHaveLength(response.elements.length)
    expect(table.meta.knownIssues?.[0].de).toContain('gespeicherte Kopie vom 27.10.2026')
  })

  it('uses the Münster copy for a city without one, and says so', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/data/osm/') ? json(rivers) : new Response('at capacity', { status: 502 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const loading = loadOsm({ topic: 'fluesse', area: 'koeln' })
    await vi.runAllTimersAsync()
    const table = await loading
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe(snapshotUrl({ topic: 'fluesse', area: 'muenster' }))
    expect(table.meta.title.de).toContain('Münster – ganze Stadt')
    expect(table.meta.knownIssues?.[0].de).toContain('für Köln gibt es keine gespeicherte Kopie')
  })

  it('stops when the load is cancelled instead of trying the next server', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      controller.abort()
      throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError')
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadOsm(params, { signal: controller.signal })).rejects.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('cycle paths: kind of path', () => {
  const of = osmTopic('radwege')!.derived!.of
  // Tag combinations as documented on wiki.openstreetmap.org (Key:cycleway, Key:bicycle_road).
  it('tells separate paths, shared paths, bicycle streets and lanes along roads apart', () => {
    expect(of({ highway: 'cycleway' })).toBe('radweg')
    expect(of({ highway: 'footway', bicycle: 'designated' })).toBe('rad_und_fuss')
    expect(of({ highway: 'residential', bicycle_road: 'yes' })).toBe('fahrradstrasse')
    expect(of({ highway: 'primary', 'cycleway:right': 'track' })).toBe('an_der_strasse')
    expect(of({ highway: 'secondary', cycleway: 'lane' })).toBe('an_der_strasse')
    expect(of({ highway: 'footway' })).toBeNull()
  })

  it('becomes a column the map colours by', () => {
    const way = { type: 'way' as const, id: 1, tags: { highway: 'cycleway' }, geometry: [{ lat: 51.96, lon: 7.62 }, { lat: 51.97, lon: 7.63 }] }
    const table = toOsmTable(osmTopic('radwege')!, { topic: 'radwege', area: 'muenster' }, { elements: [way] })
    expect(table.rows[0].art).toBe('radweg')
    expect(table.meta.mapStyle?.categories?.column).toBe('art')
    expect(table.meta.mapStyle?.categories?.entries.map((e) => e.value)).toEqual(['radweg', 'an_der_strasse', 'rad_und_fuss', 'fahrradstrasse'])
  })

  it('names the same kinds in the generated Python', () => {
    const code = loadOsmOperation.toCode!({ topic: 'radwege', area: 'muenster' }).python
    expect(code).toContain('def art(t):')
    expect(code).toContain('zeile["art"] = art(t)')
  })
})

describe('queries and settings', () => {
  it('give points a symbol', () => {
    expect(osmTopic('spielplaetze')!.mapStyle?.symbol).toBe('playground')
    expect(osmTopic('trinkwasser')!.mapStyle?.symbol).toBe('drinking-water')
  })

  it('put the area into Overpass order (south, west, north, east)', () => {
    expect(overpassQuery(osmTopic('trinkwasser')!, [7.58, 51.92, 7.66, 51.98])).toBe(
      '[out:json][timeout:60];node["amenity"="drinking_water"](51.92,7.58,51.98,7.66);out;',
    )
  })

  it('fall back to defaults for odd saved settings', () => {
    expect(normalizeOsmParams({ topic: 'atlantis', area: 'mars' }, OSM_TOPICS)).toEqual({ topic: 'fluesse', area: 'muenster-mitte' })
  })
})
