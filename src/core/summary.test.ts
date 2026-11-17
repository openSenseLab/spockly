import { describe, expect, it } from 'vitest'

import { summarizeColumn } from './summary'
import type { ColumnMeta } from './types'

// Hand-made test rows, not a dataset.
const rows = [
  { temp: 4, station: 'A', time: '2026-01-03T10:00:00Z' },
  { temp: 10, station: 'B', time: '2026-01-01T10:00:00Z' },
  { temp: null, station: 'A', time: null },
  { temp: 7, station: '', time: '2026-01-02T10:00:00Z' },
  { temp: 1, station: 'A', time: 'not a date' },
]

const col = (name: string, dataType: ColumnMeta['dataType'], semanticType: ColumnMeta['semanticType']) =>
  ({ name, dataType, semanticType }) satisfies ColumnMeta

describe('summarizeColumn', () => {
  it('computes numeric statistics and ignores missing values', () => {
    const s = summarizeColumn(col('temp', 'number', 'measurement'), rows)
    expect(s.filled).toBe(4)
    expect(s.missing).toBe(1)
    expect(s.numeric).toEqual({ min: 1, max: 10, mean: 5.5, median: 5.5 })
  })

  it('counts empty strings as missing and lists the most frequent values', () => {
    const s = summarizeColumn(col('station', 'string', 'category'), rows)
    expect(s.missing).toBe(1)
    expect(s.distinct).toBe(2)
    expect(s.topValues).toEqual([
      { value: 'A', count: 3 },
      { value: 'B', count: 1 },
    ])
  })

  it('finds the time range and skips unparseable dates', () => {
    const s = summarizeColumn(col('time', 'date', 'timestamp'), rows)
    expect(s.time).toEqual({ first: '2026-01-01T10:00:00Z', last: '2026-01-03T10:00:00Z' })
  })

  it('handles a column without any values', () => {
    const s = summarizeColumn(col('nothing', 'number', 'measurement'), rows)
    expect(s.filled).toBe(0)
    expect(s.numeric).toBeUndefined()
  })
})
