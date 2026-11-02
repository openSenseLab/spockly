import { describe, expect, it } from 'vitest'

import { niceTicks, parseTime, stepKey, stepsFor, timeColumnsOf, timeSeriesOf } from './timeseries'
import type { ColumnMeta, DataTable } from './types'

// Hand-made tables in the shapes our loaders produce.
const col = (name: string, dataType: ColumnMeta['dataType'], semanticType: ColumnMeta['semanticType']): ColumnMeta => ({
  name,
  dataType,
  semanticType,
})
const table = (columns: ColumnMeta[], rows: Record<string, unknown>[]): DataTable => ({
  meta: { id: 't', title: { de: 't' }, source: { name: 't' } },
  columns,
  rows,
})

describe('parseTime and stepKey', () => {
  it('reads ISO values at any precision; values without a zone are local times', () => {
    expect(parseTime('2024')).toBe(new Date(2024, 0, 1).getTime())
    expect(parseTime('2024-05')).toBe(new Date(2024, 4, 1).getTime())
    expect(parseTime('2024-05-12')).toBe(new Date(2024, 4, 12).getTime())
    expect(parseTime('2024-05-12T14:30')).toBe(new Date(2024, 4, 12, 14, 30).getTime())
    expect(parseTime('2026-10-20T00:00:00+00:00')).toBe(Date.UTC(2026, 9, 20))
    expect(parseTime('gestern')).toBeNull()
  })

  it('names the step a time falls into', () => {
    const ms = new Date(2024, 4, 12, 14, 30).getTime()
    expect([stepKey(ms, 'hour'), stepKey(ms, 'day'), stepKey(ms, 'month'), stepKey(ms, 'year')]).toEqual([
      '2024-05-12T14:00',
      '2024-05-12',
      '2024-05',
      '2024',
    ])
  })
})

describe('stepsFor', () => {
  it('offers the steps that give 2 to 5 000 points and picks the finest with at most 200', () => {
    // Sightings over one year: months (12) automatically; days (366) and every value offered too.
    const times = ['2024-01-07', '2024-03-02', '2024-10-20', '2024-11-05'].map((v) => parseTime(v)!)
    const choice = stepsFor(times)!
    expect(choice.auto).toBe('month')
    expect(choice.steps.map((s) => s.step)).toEqual(['raw', 'day', 'month'])
    expect(choice.steps.find((s) => s.step === 'month')!.count).toBe(11)
  })

  it('picks hours for one day of sensor values', () => {
    const times = Array.from({ length: 24 * 12 }, (_, i) => new Date(2026, 9, 27, 0, i * 5).getTime())
    expect(stepsFor(times)!.auto).toBe('hour')
  })
})

describe('timeSeriesOf', () => {
  it('counts rows per month, with empty months as 0 (cranes per month)', () => {
    const t = table(
      [col('eventDate', 'date', 'timestamp'), col('individualCount', 'number', 'measurement')],
      [
        { eventDate: '2024-01-07', individualCount: 12 },
        { eventDate: '2024-01-25', individualCount: 3 },
        { eventDate: '2024-03-02', individualCount: null },
      ],
    )
    const s = timeSeriesOf(t, { stat: 'count', step: 'month' })!
    expect(s.points.map((p) => p.key)).toEqual(['2024-01', '2024-02', '2024-03'])
    expect(s.series[0].values).toEqual([2, 0, 1])
  })

  it('takes the mean per step, leaves steps without values as gaps, and gives the range', () => {
    const t = table(
      [col('zeit', 'date', 'timestamp'), col('temperatur', 'number', 'measurement')],
      [
        { zeit: '2026-10-27T10:05', temperatur: 10 },
        { zeit: '2026-10-27T10:35', temperatur: 14 },
        { zeit: '2026-10-27T12:10', temperatur: 9 },
      ],
    )
    const s = timeSeriesOf(t, { measure: 'temperatur', stat: 'mean', step: 'hour' })!
    expect(s.series[0].values).toEqual([12, null, 9])
    expect(s.series[0].low).toEqual([10, null, 9])
    expect(s.series[0].high).toEqual([14, null, 9])
  })

  it('draws one line per place for up to 3 places, named by the name column', () => {
    const t = table(
      [col('zeit', 'date', 'timestamp'), col('name', 'string', 'text'), col('lat', 'number', 'latitude'), col('lon', 'number', 'longitude'), col('wert', 'number', 'measurement')],
      [
        { zeit: '2024-01', name: 'Sylt', lat: 54.9, lon: 8.3, wert: 3 },
        { zeit: '2024-01', name: 'Zugspitze', lat: 47.4, lon: 11.0, wert: -9 },
        { zeit: '2024-02', name: 'Sylt', lat: 54.9, lon: 8.3, wert: 4 },
      ],
    )
    const s = timeSeriesOf(t, { measure: 'wert', stat: 'max', step: 'month' })!
    expect(s.places).toBe(2)
    expect(s.series.map((x) => [x.label, x.values])).toEqual([
      ['Sylt', [3, 4]],
      ['Zugspitze', [-9, null]],
    ])
  })

  it('draws more than 3 places as one line', () => {
    const rows = [1, 2, 3, 4].map((i) => ({ zeit: '2024-01-01', lat: 50 + i, lon: 7, wert: i }))
    const t = table([col('zeit', 'date', 'timestamp'), col('lat', 'number', 'latitude'), col('lon', 'number', 'longitude'), col('wert', 'number', 'measurement')], rows)
    const s = timeSeriesOf(t, { measure: 'wert', stat: 'mean', step: 'raw' })!
    expect(s.places).toBe(4)
    expect(s.series).toHaveLength(1)
    expect(s.series[0].values).toEqual([2.5])
  })

  it('needs a date column', () => {
    expect(timeSeriesOf(table([col('wert', 'number', 'measurement')], [{ wert: 1 }]), { stat: 'count', step: 'day' })).toBeNull()
  })
})

describe('timeColumnsOf', () => {
  it('puts the time of the event first and times about the record last (GBIF)', () => {
    const names = ['lastCrawled', 'modified', 'dateIdentified', 'eventDate', 'lastInterpreted']
    const t = table(names.map((n) => col(n, 'date', 'timestamp')), [])
    expect(timeColumnsOf(t).map((c) => c.name)).toEqual(['eventDate', 'lastCrawled', 'modified', 'dateIdentified', 'lastInterpreted'])
  })
})

describe('niceTicks', () => {
  it('gives clean numbers', () => {
    expect(niceTicks(0.3, 9.7)).toEqual([2, 4, 6, 8])
    expect(niceTicks(-12, 31)).toEqual([-10, 0, 10, 20, 30])
  })
})
