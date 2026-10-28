import { describe, expect, it } from 'vitest'

import { detectDelimiter, guessTable, parseCsv, pythonPath, recordsFromJson, toTable } from './tabular'

// Hand-made inputs in the shapes spreadsheets and web services produce.

describe('parseCsv', () => {
  it('reads a German spreadsheet export (";" and decimal comma)', () => {
    const csv = '﻿Datum;Ort;Temperatur\r\n01.10.2026;Münster;12,5\r\n02.10.2026;Münster;-1,25\r\n'
    const { fields, records, delimiter } = parseCsv(csv)
    expect(delimiter).toBe(';')
    expect(fields).toEqual(['Datum', 'Ort', 'Temperatur'])
    expect(records).toEqual([
      { Datum: '01.10.2026', Ort: 'Münster', Temperatur: '12,5' },
      { Datum: '02.10.2026', Ort: 'Münster', Temperatur: '-1,25' },
    ])
  })

  it('keeps delimiters, quotes and line breaks inside quoted fields', () => {
    const csv = 'name,notiz\n"Müller, Anna","sagt ""hallo""\nzweite Zeile"\n'
    expect(parseCsv(csv).records).toEqual([{ name: 'Müller, Anna', notiz: 'sagt "hallo"\nzweite Zeile' }])
  })

  it('finds the delimiter that splits every line the same way', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n')).toBe(',')
    expect(detectDelimiter('a;b\n1,5;2,5\n')).toBe(';')
    expect(detectDelimiter('a\tb\n1\t2\n')).toBe('\t')
  })

  it('names empty and repeated column names', () => {
    expect(parseCsv('wert,,wert\n1,2,3\n').fields).toEqual(['wert', 'spalte_2', 'wert_2'])
  })
})

describe('recordsFromJson', () => {
  it('takes the features of GeoJSON, properties plus geometry', () => {
    const json = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { mag: 3.8 }, geometry: { type: 'Point', coordinates: [-65.34, 17.95, 32.8] } }],
    }
    const found = recordsFromJson(json)
    expect(found.kind).toBe('geojson')
    expect(found.fields).toEqual(['mag', 'geometry'])
    expect(found.records[0].geometry).toEqual({ type: 'Point', coordinates: [-65.34, 17.95, 32.8] })
  })

  it('finds the longest list inside an object and says where', () => {
    const json = { sources: [{ id: 1 }], weather: [{ t: 1 }, { t: 2 }] }
    const found = recordsFromJson(json)
    expect(found.path).toEqual(['weather'])
    expect(found.records).toHaveLength(2)
    expect(pythonPath('daten', found.path)).toBe('daten["weather"]')
  })

  it('turns nested objects into columns joined with "_"', () => {
    const json = [{ name: 'MÜNSTER OW', water: { shortname: 'DEK', longname: 'DORTMUND-EMS-KANAL' }, tags: ['a', 'b'] }]
    expect(recordsFromJson(json).records[0]).toEqual({
      name: 'MÜNSTER OW',
      water_shortname: 'DEK',
      water_longname: 'DORTMUND-EMS-KANAL',
      tags: 'a, b',
    })
  })

  it('makes one column of a list of plain values, one row of a single object', () => {
    expect(recordsFromJson([1, 2, 3]).records).toEqual([{ wert: 1 }, { wert: 2 }, { wert: 3 }])
    expect(recordsFromJson({ a: 1, b: 'x' }).records).toEqual([{ a: 1, b: 'x' }])
  })
})

describe('guessTable', () => {
  const kinds = (fields: string[], records: Record<string, unknown>[]) =>
    Object.fromEntries(guessTable(fields, records).columns.map((c) => [c.name, `${c.dataType}/${c.semanticType}`]))

  it('reads German numbers and dates', () => {
    const { records, fields } = parseCsv('Datum;Zeit;Wert;Anzahl\n31.01.2025;31.01.2025 14:05;1.234,5;7\n01.02.2025;;-0,5;\n')
    const table = guessTable(fields, records)
    expect(table.rows[0]).toEqual({ Datum: '2025-01-31', Zeit: '2025-01-31T14:05', Wert: 1234.5, Anzahl: 7 })
    expect(table.rows[1]).toEqual({ Datum: '2025-02-01', Zeit: null, Wert: -0.5, Anzahl: null })
    expect(kinds(fields, records)).toMatchObject({ Datum: 'date/timestamp', Wert: 'number/measurement' })
  })

  it('recognises coordinates, ids, years, categories and free text', () => {
    const records = [
      { lat: '51.96', lon: '7.63', station_id: '17', year: '2024', typ: 'Schule', notiz: 'nass' },
      { lat: '51.95', lon: '7.61', station_id: '18', year: '2025', typ: 'Schule', notiz: 'trocken' },
      { lat: '51.94', lon: '7.60', station_id: '19', year: '2025', typ: 'Park', notiz: 'windig' },
      { lat: '51.93', lon: '7.62', station_id: '20', year: '2025', typ: 'Park', notiz: 'kalt' },
    ]
    expect(kinds(Object.keys(records[0]), records)).toEqual({
      lat: 'number/latitude',
      lon: 'number/longitude',
      station_id: 'string/identifier',
      year: 'date/timestamp',
      typ: 'string/category',
      notiz: 'string/text',
    })
  })

  it('keeps postcodes with a leading zero as text, and "NA" as text in a text column', () => {
    const records = [{ plz: '01067', land: 'NA' }, { plz: '48149', land: 'DE' }]
    const table = guessTable(['plz', 'land'], records)
    expect(table.rows.map((r) => r.plz)).toEqual(['01067', '48149'])
    expect(table.rows[0].land).toBe('NA')
  })

  it('reads "NA" as missing in a number column', () => {
    const table = guessTable(['wert'], [{ wert: '1.5' }, { wert: 'NA' }])
    expect(table.rows.map((r) => r.wert)).toEqual([1.5, null])
  })

  it('turns milliseconds since 1970 in a time column into dates (USGS "time")', () => {
    const table = guessTable(['time', 'mag'], [{ time: 1793180639075, mag: 3.8 }])
    expect(table.columns[0]).toMatchObject({ dataType: 'date', semanticType: 'timestamp' })
    expect(table.rows[0].time).toBe(new Date(1793180639075).toISOString())
    expect(table.rows[0].time).toBe('2026-10-28T09:43:59.075Z')
  })

  it('keeps geometries and booleans', () => {
    const point = { type: 'Point', coordinates: [7.6, 51.9] }
    const table = guessTable(['geometry', 'offen'], [{ geometry: point, offen: true }, { geometry: null, offen: false }])
    expect(table.columns.map((c) => c.dataType)).toEqual(['geometry', 'boolean'])
    expect(table.rows[0]).toEqual({ geometry: point, offen: true })
  })

  it('leaves rows beyond the limit out and says so', () => {
    const records = Array.from({ length: 5 }, (_, i) => ({ n: i }))
    const table = toTable(guessTable(['n'], records, 3), { id: 'x', title: { de: 'x' }, source: { name: 'x' } })
    expect(table.rows).toHaveLength(3)
    expect(table.meta.totalRecords).toBe(5)
    expect(table.meta.knownIssues?.[0].de).toBe('Nur die ersten 3 von 5 Zeilen wurden geladen.')
  })
})
