import { describe, expect, it } from 'vitest'

import { tableFromPython, viewFrom, type PythonTable } from './fromPython'

// Hand-made, in the shape spockly.py's _paket() writes for openSenseMap measurements.
const measurements: PythonTable = {
  spalten: ['createdAt', 'value', 'station', 'lat', 'lon', 'sensor_id'],
  typen: { createdAt: 'datetime64[ns, UTC]', value: 'float64', station: 'object', lat: 'float64', lon: 'float64', sensor_id: 'object' },
  zeilen: [
    ['2026-11-09T10:00:00.000Z', 9.5, 'Schulhof', 51.96, 7.62, 'a1'],
    ['2026-11-09T10:05:00.000Z', 9.7, 'Schulhof', 51.96, 7.62, 'a1'],
    ['2026-11-09T10:00:00.000Z', 8.1, 'Park', 51.95, 7.61, 'b2'],
  ],
  anzahl: 3,
}
const kinds = (t: ReturnType<typeof tableFromPython>) => Object.fromEntries(t.columns.map((c) => [c.name, `${c.dataType}/${c.semanticType}`]))

describe('tableFromPython', () => {
  it('takes the column types from pandas: dates, numbers, text (too few rows for categories)', () => {
    const t = tableFromPython(measurements, 'tabelle', {}, 'messwerte')
    expect(kinds(t)).toEqual({
      createdAt: 'date/timestamp',
      value: 'number/measurement',
      station: 'string/text',
      lat: 'number/measurement',
      lon: 'number/measurement',
      sensor_id: 'string/text',
    })
    expect(t.rows[0]).toEqual({ createdAt: '2026-11-09T10:00:00.000Z', value: 9.5, station: 'Schulhof', lat: 51.96, lon: 7.62, sensor_id: 'a1' })
    expect(t.meta.title.de).toBe('messwerte')
  })

  it('on a map: the chosen columns are the position and the colour, other numbers are not measurements', () => {
    const t = tableFromPython(measurements, 'karte', { breite: 'lat', laenge: 'lon', farbe: 'value' }, 'messwerte')
    expect(kinds(t)).toMatchObject({ lat: 'number/latitude', lon: 'number/longitude', value: 'number/measurement' })
  })

  it('in a time chart: the chosen time and value; the group column is a category', () => {
    const t = tableFromPython(measurements, 'zeitverlauf', { zeit: 'createdAt', wert: 'value', je: 'station' }, 'messwerte')
    expect(kinds(t)).toMatchObject({ createdAt: 'date/timestamp', value: 'number/measurement', lat: 'number/text', station: 'string/category' })
  })

  it('keeps shapes, and shows other objects as JSON text', () => {
    const shapes: PythonTable = {
      spalten: ['geometry', 'tags'],
      typen: { geometry: 'object', tags: 'object' },
      zeilen: [[{ type: 'Point', coordinates: [7.6, 51.9] }, { a: 1 }]],
      anzahl: 1,
    }
    const t = tableFromPython(shapes, 'tabelle', {}, 'orte')
    expect(t.rows[0]).toEqual({ geometry: { type: 'Point', coordinates: [7.6, 51.9] }, tags: '{"a":1}' })
    expect(kinds(t).geometry).toBe('geometry/geometry')
  })

  it('draws the shapes of the chosen column on the map, and none on a point map', () => {
    const shapes: PythonTable = {
      spalten: ['name', 'form', 'lat', 'lon'],
      typen: { name: 'object', form: 'object', lat: 'float64', lon: 'float64' },
      zeilen: [['Park', { type: 'Polygon', coordinates: [[[7.6, 51.9], [7.7, 51.9], [7.7, 52], [7.6, 51.9]]] }, 51.9, 7.6]],
      anzahl: 1,
    }
    expect(kinds(tableFromPython(shapes, 'karte', { form: 'form' }, 'parks')).form).toBe('geometry/geometry')
    const points = tableFromPython(shapes, 'karte', { breite: 'lat', laenge: 'lon' }, 'parks')
    expect(kinds(points).form).toBe('string/text')
    expect(typeof points.rows[0].form).toBe('string')
  })
})

describe('viewFrom', () => {
  it('reads the message from the worker', () => {
    const view = viewFrom({ kind: 'karte', title: 'messwerte', data: JSON.stringify(measurements), options: '{"breite":"lat","laenge":"lon","farbe":"value"}' })
    expect(view.kind).toBe('karte')
    expect(view.table.rows).toHaveLength(3)
  })
})
