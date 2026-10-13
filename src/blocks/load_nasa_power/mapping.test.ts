import { describe, expect, it } from 'vitest'

import dailyJanuary from './__fixtures__/daily-muenster-2025-01.json'
import dailyRecent from './__fixtures__/daily-recent-with-gaps.json'
import monthly from './__fixtures__/monthly-muenster-2024-2025.json'
import {
  checkParams,
  dateKey,
  DEFAULT_PARAMS,
  normalizeParams,
  requestUrl,
  toDataTable,
  type LoadNasaParams,
  type PowerResponse,
} from './mapping'

const TODAY = '2026-10-13'
const params = (patch: Partial<LoadNasaParams> = {}): LoadNasaParams => ({ ...DEFAULT_PARAMS, ...patch })

describe('checkParams', () => {
  it('accepts the defaults', () => {
    expect(checkParams(DEFAULT_PARAMS, TODAY)).toBeNull()
  })

  it.each([
    [{ variables: [] }, 'load.nasaNoVariables'],
    [{ from: '1975-01-01' }, 'load.nasaTooEarly'],
    [{ to: '2026-12-31' }, 'load.nasaFuture'],
    [{ from: '2025-06-01', to: '2025-01-01' }, 'load.nasaFromAfterTo'],
    [{ from: '2025-13-40' }, 'load.nasaBadDates'],
    [{ place: { kind: 'coords', lat: 95, lon: 7 } }, 'load.nasaBadCoords'],
    [{ place: { kind: 'preset', id: 'atlantis' } }, 'load.nasaUnknownPlace'],
    [{ resolution: 'monthly', from: '2020', to: '2026' }, 'load.nasaYearNotComplete'],
    [{ resolution: 'monthly', from: '2020-01-01', to: '2024' }, 'load.nasaBadDates'],
  ] as [Partial<LoadNasaParams>, string][])('%o → %s', (patch, code) => {
    expect(checkParams(params(patch), TODAY)).toBe(code)
  })

  it('accepts complete years for monthly values', () => {
    expect(checkParams(params({ resolution: 'monthly', from: '1981', to: '2025' }), TODAY)).toBeNull()
  })
})

describe('requestUrl', () => {
  it('asks the point endpoint with compact dates and the chosen variables', () => {
    const url = new URL(requestUrl(params({ from: '2025-01-01', to: '2025-01-10' })))
    expect(url.pathname).toBe('/api/temporal/daily/point')
    expect(url.searchParams.get('parameters')).toBe('T2M,PRECTOTCORR,WS50M')
    expect(url.searchParams.get('start')).toBe('20250101')
    expect(url.searchParams.get('latitude')).toBe('51.9625')
  })
})

describe('dateKey', () => {
  it('turns API keys into ISO dates and drops the annual "month 13"', () => {
    expect(dateKey('20250131', 'daily')).toBe('2025-01-31')
    expect(dateKey('202502', 'monthly')).toBe('2025-02')
    expect(dateKey('202513', 'monthly')).toBeNull()
  })
})

describe('toDataTable', () => {
  it('makes one row per day with a column per variable', () => {
    const table = toDataTable(params({ from: '2025-01-01', to: '2025-01-10' }), dailyJanuary as PowerResponse, TODAY)
    expect(table.rows).toHaveLength(10)
    expect(table.rows[0].date).toBe('2025-01-01')
    expect(table.columns.map((c) => c.name)).toEqual(['date', 'T2M', 'PRECTOTCORR', 'WS50M', 'lat', 'lon'])
    expect(table.columns.find((c) => c.name === 'T2M')).toMatchObject({ unit: '°C', semanticType: 'measurement' })
    expect(table.columns.find((c) => c.name === 'PRECTOTCORR')?.unit).toBe('mm/d')
    expect(typeof table.rows[0].T2M).toBe('number')
  })

  it('turns the fill value of days not available yet into missing values', () => {
    const table = toDataTable(params({ variables: ['T2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN'] }), dailyRecent as PowerResponse, TODAY)
    const last = table.rows.at(-1)!
    expect(last.T2M).toBeNull()
    expect(last.ALLSKY_SFC_SW_DWN).toBeNull()
    expect(table.rows.some((r) => r.T2M === -999)).toBe(false)
    expect(table.rows.some((r) => typeof r.T2M === 'number')).toBe(true)
  })

  it('has 12 months per year, without the annual value', () => {
    const table = toDataTable(params({ resolution: 'monthly', from: '2024', to: '2025', variables: ['T2M', 'PRECTOTCORR'] }), monthly as PowerResponse, TODAY)
    expect(table.rows).toHaveLength(24)
    expect(table.rows[0].date).toBe('2024-01')
    expect(table.rows.at(-1)!.date).toBe('2025-12')
  })

  it('says where the data comes from and that it is not a station', () => {
    const table = toDataTable(params(), dailyJanuary as PowerResponse, TODAY)
    expect(table.meta.title.de).toBe('NASA POWER: Wetterdaten Münster (täglich)')
    expect(table.meta.description?.de).toContain('nicht von einer Messstation')
    expect(table.meta.attribution).toContain('NASA Earth Science Division')
    expect(table.meta.attribution).toContain(`accessed ${TODAY}`)
  })
})

describe('normalizeParams', () => {
  it('falls back to defaults and drops unknown variables', () => {
    expect(normalizeParams(undefined)).toEqual(DEFAULT_PARAMS)
    expect(normalizeParams({ ...DEFAULT_PARAMS, variables: ['T2M', 'NOPE'] }).variables).toEqual(['T2M'])
  })
})
