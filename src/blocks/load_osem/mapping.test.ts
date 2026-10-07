import { describe, expect, it } from 'vitest'

import outsideBox from './__fixtures__/box-outside-area.json'
import boxesFixture from './__fixtures__/boxes-muenster.json'
import sensorData from './__fixtures__/sensor-data.json'
import {
  boxesInArea,
  DEFAULT_PARAMS,
  nextPageEnd,
  normalizeParams,
  phenomenaIn,
  SENSOR_LIMIT,
  stationsFor,
  timeWindow,
  toDataTable,
  type OsemBox,
  type OsemMeasurement,
} from './mapping'

const boxes = boxesFixture as OsemBox[]
// The fixtures were recorded at this time; "active" is relative to it.
const NOW = new Date('2026-10-07T00:00:00Z')
const { from: threeDaysAgo } = timeWindow('3d', NOW)

describe('timeWindow', () => {
  it('ends now and reaches back the chosen number of days', () => {
    const { from, to } = timeWindow('7d', NOW)
    expect(to.toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(from.toISOString()).toBe('2026-09-30T00:00:00.000Z')
  })
})

describe('boxesInArea', () => {
  it('drops boxes the area query returns although they are elsewhere now', () => {
    const mitte: [number, number, number, number] = [7.5897085, 51.9205942, 7.6647924, 51.989764]
    const kept = boxesInArea([...boxes, outsideBox as OsemBox], mitte)
    expect(kept.map((b) => b.name)).not.toContain('Bundeskanzleramt')
    expect(kept.map((b) => b.name)).toContain('Wetterstation Erpho')
  })
})

describe('stationsFor', () => {
  it('keeps only boxes that measured in the window and have the phenomenon', () => {
    const stations = stationsFor(boxes, 'Temperatur', threeDaysAgo)
    const names = stations.map((s) => s.box.name)
    expect(names).toContain('Wetterstation Erpho')
    expect(names).not.toContain('Aasee-Station') // last value in August
    expect(names).not.toContain('Geo1_Floor2_SeminarRoom242_Ceiling') // no Temperatur sensor
    expect(stations.every((s) => s.sensor.title === 'Temperatur')).toBe(true)
  })

  it('puts the most recently active station first', () => {
    const times = stationsFor(boxes, 'Temperatur', threeDaysAgo).map((s) =>
      Date.parse(s.box.lastMeasurementAt ?? ''),
    )
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})

describe('phenomenaIn', () => {
  it('counts stations per phenomenon among active boxes, most common first', () => {
    const options = phenomenaIn(boxes, threeDaysAgo)
    expect(options[0].stations).toBeGreaterThanOrEqual(options.at(-1)!.stations)
    const temperature = options.find((o) => o.title === 'Temperatur')
    expect(temperature?.stations).toBe(stationsFor(boxes, 'Temperatur', threeDaysAgo).length)
    expect(temperature?.unit).toBe('°C')
  })
})

describe('nextPageEnd', () => {
  const from = new Date('2026-10-01T00:00:00Z')

  it('stops when a page is not full', () => {
    expect(nextPageEnd(sensorData as OsemMeasurement[], from)).toBeNull()
  })

  it('continues just before the oldest value of a full page', () => {
    // A full page: the recorded values repeated up to the limit.
    const page = Array.from({ length: SENSOR_LIMIT }, (_, i) => sensorData[i % sensorData.length])
    const oldest = Math.min(...sensorData.map((m) => Date.parse(m.createdAt)))
    expect(nextPageEnd(page, from)?.getTime()).toBe(oldest - 1)
  })
})

describe('toDataTable', () => {
  const stations = stationsFor(boxes, 'Temperatur', threeDaysAgo)
  const erpho = stations.find((s) => s.box.name === 'Wetterstation Erpho')!
  const table = toDataTable(
    DEFAULT_PARAMS,
    [{ station: erpho, values: sensorData as OsemMeasurement[] }],
    timeWindow('1d', NOW),
    stations.length,
  )

  it('makes one row per measurement, oldest first, with numeric values', () => {
    expect(table.rows).toHaveLength(sensorData.length)
    expect(typeof table.rows[0].value).toBe('number')
    expect(String(table.rows[0].time) <= String(table.rows.at(-1)!.time)).toBe(true)
    expect(table.rows[0]).toMatchObject({ station: 'Wetterstation Erpho', exposure: 'outdoor' })
  })

  it('uses the location stored with each measurement', () => {
    expect(table.rows[0].lat).toBeCloseTo(51.964, 2)
    expect(table.rows[0].lon).toBeCloseTo(7.645, 2)
  })

  it('describes the columns and the dataset', () => {
    const value = table.columns.find((c) => c.name === 'value')
    expect(value).toMatchObject({ semanticType: 'measurement', unit: '°C', label: { de: 'Temperatur' } })
    expect(table.columns.find((c) => c.name === 'unit')).toBeUndefined()
    expect(table.columns.find((c) => c.name === 'station_id')?.semanticType).toBe('identifier')
    expect(table.meta.title.de).toBe('openSenseMap: Temperatur – Münster – Stadtbezirk Mitte')
    expect(table.meta.description?.de).toContain('Messwerte von 1 openSenseMap-Stationen')
    expect(table.meta.description?.de).toContain(`Es gibt ${stations.length} passende Stationen`)
    expect(table.meta.totalRecords).toBe(sensorData.length)
  })

  it('adds a unit column when stations use different units', () => {
    const fahrenheit = { ...erpho, sensor: { ...erpho.sensor, unit: '°F' } }
    const mixed = toDataTable(
      DEFAULT_PARAMS,
      [
        { station: erpho, values: sensorData.slice(0, 2) as OsemMeasurement[] },
        { station: fahrenheit, values: sensorData.slice(0, 2) as OsemMeasurement[] },
      ],
      timeWindow('1d', NOW),
      2,
    )
    expect(mixed.columns.find((c) => c.name === 'unit')).toBeDefined()
    expect(mixed.columns.find((c) => c.name === 'value')?.unit).toBeUndefined()
  })
})

describe('normalizeParams', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(normalizeParams(undefined)).toEqual(DEFAULT_PARAMS)
    expect(normalizeParams({ source: { kind: 'area', area: 'atlantis' }, period: '99d' })).toEqual(DEFAULT_PARAMS)
  })

  it('keeps valid settings', () => {
    const params = { source: { kind: 'tag', tag: 'codeformuenster' }, phenomenon: 'PM10', period: '7d', outdoorOnly: false }
    expect(normalizeParams(params)).toEqual(params)
  })
})
