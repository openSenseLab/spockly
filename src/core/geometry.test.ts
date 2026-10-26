import { describe, expect, it } from 'vitest'

import bremenShape from '../blocks/load_huwise/__fixtures__/georef-germany-land.bremen-shape.json'
import { mapShapesOf } from './geo'
import { boundsOf, containsPoint, isGeometry, rectTouches, shapeKind, toGeometry, vertexCount } from './geometry'
import { summarizeColumn } from './summary'
import type { ColumnMeta, Geometry } from './types'

// Small hand-made shapes for the counting rules; the real Bremen outline below is recorded data.
const point: Geometry = { type: 'Point', coordinates: [7.6, 51.96] }
const line: Geometry = { type: 'LineString', coordinates: [[7.6, 51.9], [7.7, 52.0], [7.8, 52.1]] }
const bremen = toGeometry(bremenShape.results[0].geo_shape)!

describe('geometry helpers', () => {
  it('recognise GeoJSON geometries and say whether they are points, lines or areas', () => {
    expect(isGeometry(point)).toBe(true)
    expect(isGeometry({ type: 'Feature' })).toBe(false)
    expect(isGeometry('POINT (7 51)')).toBe(false)
    expect([point, line, bremen].map(shapeKind)).toEqual(['point', 'line', 'area'])
  })

  it('unwrap the Feature Huwise sends', () => {
    expect(bremen.type).toBe('MultiPolygon')
    expect(toGeometry({ type: 'Feature', geometry: point, properties: {} })).toBe(point)
    expect(toGeometry({ type: 'Feature', geometry: null })).toBeNull()
  })

  it('count vertices and find the rectangle around shapes', () => {
    expect(vertexCount(point)).toBe(1)
    expect(vertexCount(line)).toBe(3)
    expect(vertexCount(bremen)).toBeGreaterThan(100)
    expect(boundsOf([point, line])).toEqual([7.6, 51.9, 7.8, 52.1])
    // Bremen and Bremerhaven: the rectangle reaches up to the North Sea coast.
    const [, minLat, , maxLat] = boundsOf([bremen])!
    expect(minLat).toBeLessThan(53.1)
    expect(maxLat).toBeGreaterThan(53.5)
    expect(boundsOf([])).toBeUndefined()
  })
})

describe('summary of a geometry column', () => {
  const column: ColumnMeta = { name: 'shape', dataType: 'geometry', semanticType: 'geometry' }
  it('counts points, lines and areas instead of comparing values as text', () => {
    const summary = summarizeColumn(column, [{ shape: point }, { shape: line }, { shape: bremen }, { shape: null }])
    expect(summary.filled).toBe(3)
    expect(summary.missing).toBe(1)
    expect(summary.shapes?.counts).toEqual({ point: 1, line: 1, area: 1 })
    expect(summary.shapes?.vertices).toBe(1 + 3 + vertexCount(bremen))
    expect(summary.topValues).toBeUndefined()
  })
})

describe('mapShapesOf', () => {
  it('makes one shape per row, named by a name column, with the row’s values', () => {
    const result = mapShapesOf(
      {
        meta: { id: 't', title: {}, source: { name: 'test' } },
        columns: [
          { name: 'year', dataType: 'string', semanticType: 'category' },
          { name: 'lan_name', dataType: 'string', semanticType: 'text' },
          { name: 'einwohner', dataType: 'number', semanticType: 'measurement' },
          { name: 'shape', dataType: 'geometry', semanticType: 'geometry' },
        ],
        rows: [
          { year: '2025', lan_name: 'Bremen', einwohner: 700000, shape: bremen },
          { year: '2025', lan_name: 'ohne Form', einwohner: 1, shape: null },
        ],
      },
      ['einwohner'],
    )
    expect(result?.shapes).toHaveLength(1)
    expect(result?.withoutShape).toBe(1)
    // "lan_name", not the first category column "year".
    expect(result?.shapes[0].label).toBe('Bremen')
    expect(result?.shapes[0].values.einwohner).toMatchObject({ count: 1, mean: 700000, max: 700000 })
  })
})

describe('containsPoint and rectTouches', () => {
  // A square with a square hole, hand-made.
  const square: Geometry = {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  }
  it('finds points inside an area but not in its holes', () => {
    expect(containsPoint(square, 2, 2)).toBe(true)
    expect(containsPoint(square, 5, 5)).toBe(false)
    expect(containsPoint(square, 12, 2)).toBe(false)
    expect(containsPoint(line, 7.7, 52.0)).toBe(false)
  })
  it('tells whether a rectangle touches an area', () => {
    expect(rectTouches([9, 9, 11, 11], square)).toBe(true) // overlaps a corner
    expect(rectTouches([-5, -5, 15, 15], square)).toBe(true) // contains the whole area
    expect(rectTouches([11, 11, 12, 12], square)).toBe(false)
    // Real outline: Bremen's city centre is inside, a spot in the North Sea is not.
    expect(rectTouches([8.79, 53.07, 8.81, 53.08], bremen)).toBe(true)
    expect(rectTouches([7.0, 54.5, 7.1, 54.6], bremen)).toBe(false)
  })
})
