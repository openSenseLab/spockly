import { describe, expect, it } from 'vitest'

import { classLimits, classOf, MAP_CLASSES, mapPointsOf, MAX_MAP_POINTS } from './geo'
import { tableFromPython } from './fromPython'
import type { ColumnMeta, DataTable } from './types'

const columns: ColumnMeta[] = [
  { name: 'time', dataType: 'date', semanticType: 'timestamp' },
  { name: 'temperatur', dataType: 'number', semanticType: 'measurement' },
  { name: 'station', dataType: 'string', semanticType: 'category' },
  { name: 'lat', dataType: 'number', semanticType: 'latitude' },
  { name: 'lon', dataType: 'number', semanticType: 'longitude' },
]
const table = (rows: Record<string, unknown>[], cols = columns): DataTable => ({
  meta: { id: 't', title: {}, source: { name: 'test' } },
  columns: cols,
  rows,
})

describe('mapPointsOf', () => {
  it('needs a latitude and a longitude column', () => {
    expect(mapPointsOf(table([{ lat: 52 }], columns.filter((c) => c.name !== 'lon')))).toBeNull()
  })

  it('makes one point per place and counts its rows', () => {
    const result = mapPointsOf(
      table([
        { station: 'Schloss', lat: 51.96, lon: 7.61, temperatur: 12 },
        { station: 'Schloss', lat: 51.96, lon: 7.61, temperatur: 13 },
        { station: 'Hafen', lat: 51.95, lon: 7.64, temperatur: 11 },
      ]),
    )
    expect(result).toEqual({
      points: [
        { lat: 51.96, lon: 7.61, label: 'Schloss', rows: 2, values: {}, details: [] },
        { lat: 51.95, lon: 7.64, label: 'Hafen', rows: 1, values: {}, details: [] },
      ],
      withoutPlace: 0,
      leftOut: 0,
    })
  })

  it('reads no measured values unless asked, so hidden guesses stay hidden', () => {
    const [point] = mapPointsOf(table([{ station: 'Schloss', lat: 51.96, lon: 7.61, temperatur: 12 }]))!.points
    expect(point.values).toEqual({})
  })

  it('sums up each chosen measurement per place: mean, lowest, highest, newest', () => {
    const [schloss, hafen] = mapPointsOf(
      table([
        { station: 'Schloss', lat: 51.96, lon: 7.61, time: '2026-10-20T12:10:00Z', temperatur: 14, feuchte: 80 },
        { station: 'Schloss', lat: 51.96, lon: 7.61, time: '2026-10-20T12:00:00Z', temperatur: 10, feuchte: null },
        { station: 'Schloss', lat: 51.96, lon: 7.61, time: '2026-10-20T12:05:00Z', temperatur: null, feuchte: 70 },
        { station: 'Hafen', lat: 51.95, lon: 7.64, time: '2026-10-20T12:00:00Z', temperatur: null, feuchte: 90 },
      ]),
      ['temperatur', 'feuchte'],
    )!.points
    expect(schloss.rows).toBe(3)
    expect(schloss.values.temperatur).toEqual({ count: 2, mean: 12, min: 10, max: 14, latest: 14, latestAt: '2026-10-20T12:10:00Z' })
    expect(schloss.values.feuchte).toEqual({ count: 2, mean: 75, min: 70, max: 80, latest: 80, latestAt: '2026-10-20T12:10:00Z' })
    // A place without any value for a measurement has none, rather than 0.
    expect(hafen.values.temperatur).toBeUndefined()
    expect(hafen.values.feuchte?.mean).toBe(90)
  })

  it('counts rows without usable coordinates', () => {
    const result = mapPointsOf(
      table([
        { lat: null, lon: 7.6 },
        { lat: 95, lon: 7.6 },
        { lat: '51.9', lon: 7.6 },
        { lat: 51.9, lon: 7.6 },
      ]),
    )
    expect(result?.points).toHaveLength(1)
    expect(result?.withoutPlace).toBe(3)
  })

  it('stops at MAX_MAP_POINTS places and says how many were left out', () => {
    const rows = Array.from({ length: MAX_MAP_POINTS + 3 }, (_, i) => ({ lat: 50 + i / 1e5, lon: 7 }))
    const result = mapPointsOf(table([...rows, rows[MAX_MAP_POINTS]]))
    expect(result?.points).toHaveLength(MAX_MAP_POINTS)
    expect(result?.leftOut).toBe(3)
  })
})

describe('classLimits', () => {
  it('makes equal steps from the lowest to the highest value', () => {
    const values = Array.from({ length: 101 }, (_, i) => i) // 0 … 100
    const limits = classLimits(values)
    expect(limits).toHaveLength(MAP_CLASSES - 1)
    expect(limits).toEqual([20, 40, 60, 80])
  })

  it('keeps one faulty value from squeezing the others into one colour', () => {
    // Twelve stations around 10–15 °C and one reporting −144 °C
    const values = [-144, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15]
    const classes = values.slice(1).map((v) => classOf(v, classLimits(values)))
    expect(new Set(classes).size).toBeGreaterThanOrEqual(4)
    expect(classOf(-144, classLimits(values))).toBe(0)
  })

  it('has no limits when all places have the same value or there is only one', () => {
    expect(classLimits([7, 7, 7])).toEqual([])
    expect(classLimits([7])).toEqual([])
  })
})

describe('classOf', () => {
  it('puts values below the first limit into class 0 and above the last into the last class', () => {
    const limits = [10, 20, 30, 40]
    expect([5, 10, 25, 40, 99].map((v) => classOf(v, limits))).toEqual([0, 1, 2, 4, 4])
  })
})

describe('a place of one row, e.g. a defibrillator from a CSV file', () => {
  // The start of a council's list, as Python hands it to a map with Latitude and Longitude.
  const defibrillators = tableFromPython(
    {
      spalten: ['X', 'Y', 'Premises', 'Address', 'Town', 'Postcode', 'Latitude', 'Longitude', 'COMMENTS'],
      typen: { X: 'float64', Y: 'float64', Premises: 'str', Address: 'str', Town: 'str', Postcode: 'str', Latitude: 'float64', Longitude: 'float64', COMMENTS: 'str' },
      zeilen: [
        [-1.85907, 53.7219, 'Borough Market Halifax', '19 Albion Street', 'Halifax', 'HX1 1DU', 53.7219, -1.85907, 'Maintained by Markets'],
        [-1.8607, 53.72437, 'Halifax Town Hall', 'Crossley Street', 'Halifax', 'HX1 1UJ', 53.72437, -1.8607, null],
        [-2.09666, 53.714, 'Todmorden Market', 'Brook Street', 'Todmorden', 'OL14 5AJ', 53.714, -2.09666, 'Supplied by CAFM'],
      ],
      anzahl: 3,
    },
    'karte',
    { breite: 'Latitude', laenge: 'Longitude', farbe: null },
    'defis',
  )

  it('is named by a column of words, not by a number column like X', () => {
    expect(mapPointsOf(defibrillators)!.points.map((p) => p.label)).toEqual(['Borough Market Halifax', 'Halifax Town Hall', 'Todmorden Market'])
  })

  it('brings its other text for the tooltip, without empty fields', () => {
    expect(mapPointsOf(defibrillators)!.points[1].details).toEqual([
      ['Address', 'Crossley Street'],
      ['Town', 'Halifax'],
      ['Postcode', 'HX1 1UJ'],
    ])
  })
})

describe('what a place shows on hover', () => {
  // openSenseMap's sensor rows: the sensor's title comes before its station's name.
  const sensors = (tooltipColumns?: string[]) =>
    tableFromPython(
      {
        spalten: ['sensor_title', 'sensor_unit', 'station_name', 'lat', 'lon'],
        typen: { sensor_title: 'str', sensor_unit: 'str', station_name: 'str', lat: 'float64', lon: 'float64' },
        zeilen: [
          ['Temperatur', '°C', 'Schloss', 51.96, 7.61],
          ['Luftdruck', 'hPa', 'Schloss', 51.96, 7.61],
          ['PM10', 'µg/m³', 'Schloss', 51.96, 7.61],
          ['Temperatur', '°C', 'Hafen', 51.95, 7.64],
        ],
        anzahl: 4,
      },
      'karte',
      { breite: 'lat', laenge: 'lon', farbe: null, info: tooltipColumns ?? null },
      'sensoren',
    )

  it('is named by the station, not by its first sensor', () => {
    expect(mapPointsOf(sensors())!.points.map((p) => p.label)).toEqual(['Schloss', 'Hafen'])
  })

  it('lists every different value of the columns ticked in the block, from all rows of the place', () => {
    const [schloss, hafen] = mapPointsOf(sensors(['sensor_title', 'sensor_unit']))!.points
    expect(schloss.details).toEqual([
      ['sensor_title', 'Temperatur, Luftdruck, PM10'],
      ['sensor_unit', '°C, hPa, µg/m³'],
    ])
    expect(hafen.details).toEqual([
      ['sensor_title', 'Temperatur'],
      ['sensor_unit', '°C'],
    ])
  })

  it('without a choice, shows no first row\'s details for a place of many rows: they may differ', () => {
    expect(mapPointsOf(sensors())!.points[0].details).toEqual([])
  })
})
