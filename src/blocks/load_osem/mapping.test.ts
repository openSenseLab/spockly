import { describe, expect, it } from 'vitest'

import outsideBox from './__fixtures__/box-outside-area.json'
import boxesFixture from './__fixtures__/boxes-muenster.json'
import humidity from './__fixtures__/sensor-data-humidity.json'
import temperature from './__fixtures__/sensor-data.json'
import {
  boxesInArea,
  DEFAULT_PARAMS,
  nextPageEnd,
  normalizeParams,
  phenomenaIn,
  phenomenonColumns,
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
  it('keeps only boxes that measured in the window and have one of the phenomena', () => {
    const stations = stationsFor(boxes, ['Temperatur'], threeDaysAgo)
    const names = stations.map((s) => s.box.name)
    expect(names).toContain('Wetterstation Erpho')
    expect(names).not.toContain('Aasee-Station') // last value in August
    expect(names).not.toContain('Geo1_Floor2_SeminarRoom242_Ceiling') // no Temperatur sensor
    expect(stations.every((s) => s.sensors.every((sensor) => sensor.title === 'Temperatur'))).toBe(true)
  })

  it('collects every chosen sensor of a box', () => {
    const erpho = stationsFor(boxes, ['Temperatur', 'rel. Luftfeuchte'], threeDaysAgo).find(
      (s) => s.box.name === 'Wetterstation Erpho',
    )
    expect(erpho?.sensors.map((s) => s.title)).toEqual(['Temperatur', 'rel. Luftfeuchte'])
  })

  it('puts the most recently active station first', () => {
    const times = stationsFor(boxes, ['Temperatur'], threeDaysAgo).map((s) => Date.parse(s.box.lastMeasurementAt ?? ''))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})

describe('phenomenaIn', () => {
  it('counts stations per phenomenon among active boxes, most common first', () => {
    const options = phenomenaIn(boxes, threeDaysAgo)
    expect(options[0].stations).toBeGreaterThanOrEqual(options.at(-1)!.stations)
    const temp = options.find((o) => o.title === 'Temperatur')
    expect(temp?.stations).toBe(stationsFor(boxes, ['Temperatur'], threeDaysAgo).length)
    expect(temp?.unit).toBe('°C')
  })
})

describe('phenomenonColumns', () => {
  it('makes readable, unique column names that do not clash with the fixed ones', () => {
    expect(phenomenonColumns(['Temperatur', 'rel. Luftfeuchte', 'PM2.5'])).toEqual(['temperatur', 'rel_luftfeuchte', 'pm2_5'])
    expect(phenomenonColumns(['Station', 'Time'])).toEqual(['station_wert', 'time_wert'])
  })
})

describe('nextPageEnd', () => {
  const from = new Date('2026-10-01T00:00:00Z')

  it('stops when a page is not full', () => {
    expect(nextPageEnd(temperature as OsemMeasurement[], from)).toBeNull()
  })

  it('continues just before the oldest value of a full page', () => {
    // A full page: the recorded values repeated up to the limit.
    const page = Array.from({ length: SENSOR_LIMIT }, (_, i) => temperature[i % temperature.length])
    const oldest = Math.min(...temperature.map((m) => Date.parse(m.createdAt)))
    expect(nextPageEnd(page, from)?.getTime()).toBe(oldest - 1)
  })
})

describe('toDataTable', () => {
  const erpho = stationsFor(boxes, ['Temperatur', 'rel. Luftfeuchte'], threeDaysAgo).find(
    (s) => s.box.name === 'Wetterstation Erpho',
  )!
  const [tempSensor, humiditySensor] = erpho.sensors
  const oneDay = timeWindow('1d', NOW)

  it('makes one row per measurement time, oldest first, with a numeric column for the phenomenon', () => {
    const table = toDataTable(
      DEFAULT_PARAMS,
      [{ box: erpho.box, sensor: tempSensor, values: temperature as OsemMeasurement[] }],
      oneDay,
      1,
    )
    expect(table.rows).toHaveLength(temperature.length)
    expect(typeof table.rows[0].temperatur).toBe('number')
    expect(String(table.rows[0].time) <= String(table.rows.at(-1)!.time)).toBe(true)
    expect(table.rows[0]).toMatchObject({ station: 'Wetterstation Erpho', exposure: 'outdoor' })
    expect(table.rows[0].lat).toBeCloseTo(51.964, 2)
    expect(table.columns.find((c) => c.name === 'temperatur')).toMatchObject({
      semanticType: 'measurement',
      unit: '°C',
      label: { de: 'Temperatur' },
    })
  })

  it('puts the sensors of one box side by side, matched by timestamp', () => {
    const params = { ...DEFAULT_PARAMS, phenomena: ['Temperatur', 'rel. Luftfeuchte'] }
    const table = toDataTable(
      params,
      [
        { box: erpho.box, sensor: tempSensor, values: temperature as OsemMeasurement[] },
        { box: erpho.box, sensor: humiditySensor, values: humidity as OsemMeasurement[] },
      ],
      oneDay,
      1,
    )
    // Recorded from the same box: the timestamps match, so the rows don't double.
    expect(table.rows).toHaveLength(temperature.length)
    expect(table.rows.every((r) => typeof r.temperatur === 'number' && typeof r.rel_luftfeuchte === 'number')).toBe(true)
    expect(table.columns.map((c) => c.name).slice(0, 3)).toEqual(['time', 'temperatur', 'rel_luftfeuchte'])
    expect(table.meta.title.de).toBe('openSenseMap: Temperatur, rel. Luftfeuchte – Münster – Stadtbezirk Mitte')
    expect(table.meta.description?.de).toContain('Nicht jede Station misst alles')
  })

  it('leaves a value empty where a sensor did not report', () => {
    const params = { ...DEFAULT_PARAMS, phenomena: ['Temperatur', 'rel. Luftfeuchte'] }
    const table = toDataTable(
      params,
      [
        { box: erpho.box, sensor: tempSensor, values: temperature as OsemMeasurement[] },
        { box: erpho.box, sensor: humiditySensor, values: (humidity as OsemMeasurement[]).slice(0, 10) },
      ],
      oneDay,
      1,
    )
    expect(table.rows).toHaveLength(temperature.length)
    expect(table.rows.filter((r) => r.rel_luftfeuchte === null)).toHaveLength(temperature.length - 10)
  })

  it('describes the dataset and counts stations, not sensors', () => {
    const stations = stationsFor(boxes, ['Temperatur'], threeDaysAgo)
    const table = toDataTable(
      DEFAULT_PARAMS,
      [{ box: erpho.box, sensor: tempSensor, values: temperature as OsemMeasurement[] }],
      oneDay,
      stations.length,
    )
    expect(table.meta.title.de).toBe('openSenseMap: Temperatur – Münster – Stadtbezirk Mitte')
    expect(table.meta.description?.de).toContain('Messwerte von 1 openSenseMap-Stationen')
    expect(table.meta.description?.de).toContain(`Es gibt ${stations.length} passende Stationen`)
    expect(table.meta.totalRecords).toBe(temperature.length)
  })

  it('leaves out the unit and says so when stations use different units', () => {
    const fahrenheit = { ...tempSensor, unit: '°F' }
    const other = { ...erpho.box, _id: 'other-box', name: 'Andere Station' }
    const table = toDataTable(
      DEFAULT_PARAMS,
      [
        { box: erpho.box, sensor: tempSensor, values: temperature.slice(0, 2) as OsemMeasurement[] },
        { box: other, sensor: fahrenheit, values: temperature.slice(0, 2) as OsemMeasurement[] },
      ],
      oneDay,
      2,
    )
    expect(table.columns.find((c) => c.name === 'temperatur')?.unit).toBeUndefined()
    expect(table.meta.description?.de).toContain('unterschiedliche Einheiten für: Temperatur')
  })

  it('converts air pressure in Pa to hPa, so all stations share one unit', () => {
    // Seen around Münster: most stations report hPa, two report Pa.
    const params = { ...DEFAULT_PARAMS, phenomena: ['Luftdruck'] }
    const at = (createdAt: string, value: string): OsemMeasurement => ({ createdAt, value })
    const hpa = { ...tempSensor, _id: 's1', title: 'Luftdruck', unit: 'hPa' }
    const pa = { ...tempSensor, _id: 's2', title: 'Luftdruck', unit: 'Pa' }
    const other = { ...erpho.box, _id: 'other-box', name: 'Andere Station' }
    const table = toDataTable(
      params,
      [
        { box: erpho.box, sensor: hpa, values: [at('2026-10-21T10:00:00Z', '1012.4')] },
        { box: other, sensor: pa, values: [at('2026-10-21T10:00:00Z', '101325')] },
      ],
      oneDay,
      2,
    )
    // Rows are sorted by time, then station name ("Andere Station" first).
    expect(table.rows.map((r) => [r.station, r.luftdruck])).toEqual([
      ['Andere Station', 1013.25],
      ['Wetterstation Erpho', 1012.4],
    ])
    expect(table.columns.find((c) => c.name === 'luftdruck')?.unit).toBe('hPa')
    expect(table.meta.description?.de).toContain('Luftdruck: 1 Station misst in Pa; ihre Werte wurden in hPa umgerechnet.')
    expect(table.meta.description?.de).not.toContain('unterschiedliche Einheiten')
  })
})

describe('normalizeParams', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(normalizeParams(undefined)).toEqual(DEFAULT_PARAMS)
    expect(normalizeParams({ source: { kind: 'area', area: 'atlantis' }, period: '99d' })).toEqual(DEFAULT_PARAMS)
  })

  it('keeps valid settings', () => {
    const params = { source: { kind: 'tag', tag: 'codeformuenster' }, phenomena: ['PM10', 'PM2.5'], period: '7d', outdoorOnly: false }
    expect(normalizeParams(params)).toEqual(params)
  })

  it('reads blocks saved with a single phenomenon', () => {
    expect(normalizeParams({ ...DEFAULT_PARAMS, phenomena: undefined, phenomenon: 'PM10' }).phenomena).toEqual(['PM10'])
  })

  it('keeps at most five phenomena', () => {
    expect(normalizeParams({ phenomena: ['a', 'b', 'c', 'd', 'e', 'f'] }).phenomena).toHaveLength(5)
  })
})
