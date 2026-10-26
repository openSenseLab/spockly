import { describe, expect, it } from 'vitest'

import nrw from './__fixtures__/nrw-t2m-2024.json'
import {
  checkGridParams,
  gridRequestUrl,
  normalizeGridParams,
  toGridTable,
  type LoadNasaGridParams,
  type PowerGridResponse,
} from './mapping'

const params: LoadNasaGridParams = { area: 'nrw', parameter: 'T2M', year: 2024 }
const table = toGridTable(params, nrw as PowerGridResponse, '2026-10-26')

describe('toGridTable (NRW, temperature, 2024)', () => {
  it('makes one row per cell and month, without the annual value', () => {
    // 26 cells touching NRW × 12 months; the API's month 13 (annual value) is left out.
    expect(table.rows).toHaveLength(26 * 12)
    expect(new Set(table.rows.map((r) => r.date))).toEqual(new Set(Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, '0')}`)))
    expect(table.rows.every((r) => typeof r.T2M === 'number')).toBe(true)
  })

  it('reads the grid size from the data and marks the rows as grid cells', () => {
    expect(table.meta.grid).toEqual({ cellSize: [0.625, 0.5] })
    expect(table.meta.placeKind).toBe('grid-cell')
    expect(table.meta.description?.de).toContain('26 Rasterzellen von je 0,5° × 0,625°')
    expect(table.meta.description?.de).toContain('von 30 im Rechteck')
  })

  it('keeps only cells touching the outline, not the neighbours in the rectangle', () => {
    const kept = new Set(table.rows.map((r) => `${r.lon},${r.lat}`))
    // Münster's cell stays; corners in Hesse and the Netherlands go.
    expect(kept.has('7.5,52')).toBe(true)
    for (const outside of ['8.75,50.5', '9.375,50.5', '9.375,51', '6.25,52.5']) expect(kept.has(outside)).toBe(false)
    expect(kept.size).toBe(26)
  })

  it('carries the outline, places for orientation and the outline credit', () => {
    expect(table.meta.outline?.label.de).toBe('Nordrhein-Westfalen')
    expect(table.meta.outline?.geometry.type).toBe('MultiPolygon')
    expect(table.meta.landmarks?.map((l) => l.label.de)).toContain('Münster')
    expect(table.meta.attribution).toContain('© GeoBasis-DE / BKG')
    expect(table.meta.attribution).toContain('Daten geändert')
  })

  it('keeps the cell elevation from the third coordinate', () => {
    const first = (nrw as PowerGridResponse).features![0].geometry!.coordinates!
    const row = table.rows.find((r) => r.lon === first[0] && r.lat === first[1])
    expect(row?.hoehe).toBe(first[2])
    expect(table.columns.find((c) => c.name === 'hoehe')).toMatchObject({ unit: 'm', semanticType: 'measurement' })
  })

  it('shows units the usual way', () => {
    expect(table.columns.find((c) => c.name === 'T2M')?.unit).toBe('°C')
  })
})

describe('grid requests', () => {
  it('ask for one value over the area rectangle for one year', () => {
    const url = new URL(gridRequestUrl(params))
    expect(url.pathname).toBe('/api/temporal/monthly/regional')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      parameters: 'T2M',
      'latitude-min': '50.32',
      'latitude-max': '52.53',
      'longitude-min': '5.87',
      'longitude-max': '9.46',
      start: '2024',
      end: '2024',
    })
  })

  it('accept only completed years from 1981 and known areas and values', () => {
    expect(checkGridParams(params, '2026-10-26')).toBeNull()
    expect(checkGridParams({ ...params, year: 2026 }, '2026-10-26')).toBe('load.nasaYearNotComplete')
    expect(checkGridParams({ ...params, year: 1980 }, '2026-10-26')).toBe('load.nasaTooEarly')
    expect(checkGridParams({ ...params, area: 'mars' }, '2026-10-26')).toBe('load.nasaUnknownPlace')
    expect(checkGridParams({ ...params, parameter: 'XYZ' }, '2026-10-26')).toBe('load.nasaNoVariables')
  })

  it('fall back to defaults for odd saved settings', () => {
    expect(normalizeGridParams({ area: 'mars', parameter: 7 }, '2026-10-26')).toEqual({ area: 'deutschland', parameter: 'T2M', year: 2025 })
  })
})
