import { afterEach, describe, expect, it, vi } from 'vitest'

import boxesFixture from './__fixtures__/boxes-muenster.json'
import sensorData from './__fixtures__/sensor-data.json'
import tagsFixture from './__fixtures__/tags.json'
import { boxesInArea, DEFAULT_PARAMS, SENSOR_LIMIT, stationsFor, timeWindow, type OsemBox } from './mapping'
import { boxesUrl, fetchTags, loadOsem } from './operation'
import { areaPreset } from './presets'

const NOW = new Date('2026-10-07T00:00:00Z')

/** Stations the loader should use: active, with one of the phenomena, and inside the area now. */
const expectedStations = (area: string, phenomena = ['Temperatur']) =>
  stationsFor(boxesInArea(boxesFixture as OsemBox[], areaPreset(area)!.bbox), phenomena, timeWindow('3d', NOW).from)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

/** Serves the recorded box list and sensor values like the real API. */
function serveRecorded(onSensor?: (url: URL) => unknown) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.pathname === '/boxes') return json(boxesFixture)
    if (url.pathname === '/tags') return json(tagsFixture)
    return json(onSensor ? onSensor(url) : sensorData)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Each test uses its own area or tag, so the box cache doesn't leak between tests.
describe('loadOsem', () => {
  it('asks for outdoor boxes in the area, then each active station for the window', async () => {
    const fetchMock = serveRecorded()
    const progress: number[] = []
    const table = await loadOsem(
      { ...DEFAULT_PARAMS, period: '3d' },
      { onProgress: (done) => progress.push(done) },
      NOW,
    )

    const boxUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(boxUrl.searchParams.get('bbox')).toBe('7.5897085,51.9205942,7.6647924,51.989764')
    expect(boxUrl.searchParams.get('exposure')).toBe('outdoor')

    const expected = expectedStations('muenster-mitte')
    expect(expected.length).toBeGreaterThan(0)
    const sensorCalls = fetchMock.mock.calls.slice(1).map((c) => new URL(String(c[0])))
    expect(sensorCalls).toHaveLength(expected.length)
    expect(sensorCalls[0].searchParams.get('from-date')).toBe('2026-10-04T00:00:00.000Z')
    expect(sensorCalls[0].searchParams.get('to-date')).toBe('2026-10-07T00:00:00.000Z')
    expect(progress.at(-1)).toBe(expected.length)
    expect(table.rows).toHaveLength(expected.length * sensorData.length)
  })

  it('pages backwards when a sensor returns a full page', async () => {
    let calls = 0
    const fullPage = Array.from({ length: SENSOR_LIMIT }, (_, i) => sensorData[i % sensorData.length])
    const fetchMock = serveRecorded(() => (++calls === 1 ? fullPage : sensorData.slice(0, 3)))
    await loadOsem(
      { ...DEFAULT_PARAMS, source: { kind: 'area', area: 'muenster' }, phenomena: ['Temperatur'], period: '3d' },
      {},
      NOW,
    )
    // The first sensor answers with a full page, so it is asked once more for older values.
    const stations = expectedStations('muenster').length
    const sensorCalls = fetchMock.mock.calls.map((c) => new URL(String(c[0]))).filter((u) => u.pathname.includes('/data/'))
    expect(sensorCalls).toHaveLength(stations + 1)
    const [first, second] = sensorCalls.filter((u) => u.pathname === sensorCalls[0].pathname)
    expect(Date.parse(second.searchParams.get('to-date')!)).toBeLessThan(Date.parse(first.searchParams.get('to-date')!))
  })

  it('says so when no active station measures the phenomenon', async () => {
    serveRecorded()
    await expect(
      loadOsem({ ...DEFAULT_PARAMS, source: { kind: 'area', area: 'kreis-coesfeld' }, phenomena: ['Gibt es nicht'] }, {}, NOW),
    ).rejects.toMatchObject({ code: 'load.osemNoStations' })
  })
})

describe('loadOsem with several phenomena', () => {
  it('asks each station for every chosen sensor it has', async () => {
    const fetchMock = serveRecorded()
    await loadOsem({ ...DEFAULT_PARAMS, source: { kind: 'area', area: 'muenster' }, phenomena: ['Temperatur', 'rel. Luftfeuchte'], period: '3d' }, {}, NOW)
    const stations = expectedStations('muenster', ['Temperatur', 'rel. Luftfeuchte'])
    const sensors = stations.reduce((n, s) => n + s.sensors.length, 0)
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/data/'))).toHaveLength(sensors)
  })
})

describe('boxesUrl', () => {
  it('filters by group tag and leaves out the exposure filter when all stations are wanted', () => {
    const url = new URL(boxesUrl({ kind: 'tag', tag: ' codeformuenster ' }, false))
    expect(url.searchParams.get('grouptag')).toBe('codeformuenster')
    expect(url.searchParams.has('exposure')).toBe(false)
    expect(url.searchParams.has('bbox')).toBe(false)
  })

  it('asks for a group when the tag is empty', () => {
    expect(() => boxesUrl({ kind: 'tag', tag: '  ' }, true)).toThrow(expect.objectContaining({ code: 'load.osemNoTag' }))
  })
})

describe('fetchTags', () => {
  it('skips null entries, which the live list contains', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ code: 'Ok', data: ['b', null, ' a ', '', 'b'] })))
    vi.resetModules()
    const { fetchTags: freshFetchTags } = await import('./operation')
    expect(await freshFetchTags()).toEqual(['a', 'b'])
  })

  it('returns the tags sorted without empty entries', async () => {
    serveRecorded()
    const tags = await fetchTags()
    expect(tags.length).toBeGreaterThan(0)
    expect(tags).toEqual([...tags].sort((a, b) => a.localeCompare(b, 'de')))
    expect(tags).not.toContain('')
  })
})
