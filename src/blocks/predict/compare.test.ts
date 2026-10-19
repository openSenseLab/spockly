import { describe, expect, it } from 'vitest'

import type { DataTable } from '../../core/types'
import { actualValue, compareGuess } from './compare'

// Hand-made test table, not a dataset.
const table: DataTable = {
  meta: { id: 'test', title: { en: 'test' }, source: { name: 'test' } },
  columns: [
    { name: 'temp', dataType: 'number', semanticType: 'measurement', unit: '°C' },
    { name: 'station', dataType: 'string', semanticType: 'category' },
  ],
  rows: [
    { temp: 4, station: 'A' },
    { temp: 10, station: 'B' },
    { temp: null, station: 'A' },
    { temp: 7, station: 'C' },
  ],
}

describe('actualValue', () => {
  it('computes the highest, lowest and mean value, ignoring missing values', () => {
    expect(actualValue(table, 'temp', 'max')).toBe(10)
    expect(actualValue(table, 'temp', 'min')).toBe(4)
    expect(actualValue(table, 'temp', 'mean')).toBe(7)
  })

  it('has no value for missing or non-numeric columns', () => {
    expect(actualValue(table, 'station', 'max')).toBeNull()
    expect(actualValue(table, 'nope', 'max')).toBeNull()
  })
})

describe('compareGuess', () => {
  it('says whether the guess was too high or too low, and by how much', () => {
    expect(compareGuess(30, 26)).toEqual({ actual: 26, difference: 4, verdict: 'high' })
    expect(compareGuess(20, 26)).toMatchObject({ difference: -6, verdict: 'low' })
  })

  it('counts guesses within 5 % as close', () => {
    expect(compareGuess(25, 26).verdict).toBe('close')
    expect(compareGuess(0, 0).verdict).toBe('close')
    expect(compareGuess(0.5, 0).verdict).toBe('high')
  })
})
