import { describe, expect, it } from 'vitest'

import landMeta from './__fixtures__/georef-germany-land.meta.json'
import landRecords from './__fixtures__/georef-germany-land.records.json'
import waterMeta from './__fixtures__/osm-australia-drinking-water.meta.json'
import waterRecords from './__fixtures__/osm-australia-drinking-water.records.json'
import {
  parseDatasetLink,
  stripHtml,
  toDataTable,
  type HuwiseDatasetResponse,
} from './mapping'

const land = toDataTable(
  'hub.huwise.com',
  landMeta as HuwiseDatasetResponse,
  landRecords.results,
  landRecords.total_count,
)
const water = toDataTable(
  'hub.huwise.com',
  waterMeta as HuwiseDatasetResponse,
  waterRecords.results,
  waterRecords.total_count,
)
const column = (table: typeof land, name: string) => table.columns.find((c) => c.name === name)

describe('toDataTable (georef-germany-land)', () => {
  it('fills dataset metadata', () => {
    expect(land.meta.id).toBe('huwise:hub.huwise.com/georef-germany-land')
    expect(land.meta.title.de).toBe('Federal States (Länder) - Germany')
    expect(land.meta.source.license).toContain('Data licence Germany')
    expect(land.meta.source.url).toBe('https://hub.huwise.com/explore/dataset/georef-germany-land/')
    expect(land.meta.totalRecords).toBe(16)
    expect(land.meta.spatialExtent?.map((n) => Math.round(n))).toEqual([6, 47, 15, 55])
    expect(land.meta.description?.de).not.toMatch(/<[a-z]/i)
  })

  it('splits geo points into latitude and longitude and drops polygons', () => {
    expect(column(land, 'geo_point_2d_lat')?.semanticType).toBe('latitude')
    expect(column(land, 'geo_point_2d_lon')?.semanticType).toBe('longitude')
    expect(column(land, 'geo_shape')).toBeUndefined()
    const mv = land.rows.find((r) => r.lan_name === 'Mecklenburg-Vorpommern')
    expect(mv?.geo_point_2d_lat).toBeCloseTo(53.75, 1)
    expect(mv?.geo_point_2d_lon).toBeCloseTo(12.53, 1)
  })

  it('joins multivalued fields and guesses semantic types', () => {
    expect(land.rows).toHaveLength(16)
    expect(typeof land.rows[0].lan_name).toBe('string')
    expect(column(land, 'lan_code')?.semanticType).toBe('identifier')
    expect(column(land, 'year')).toMatchObject({ dataType: 'date', semanticType: 'timestamp' })
    // lan_type: Land / Freistaat / Freie und Hansestadt — few distinct values
    expect(column(land, 'lan_type')?.semanticType).toBe('category')
    // the portal marks lan_name as a facet, so it is a category
    expect(column(land, 'lan_name')?.semanticType).toBe('category')
    // free text with a value per row stays text
    expect(column(water, 'meta_osm_url')?.semanticType).toBe('text')
  })
})

describe('toDataTable (osm-australia-drinking-water)', () => {
  it('maps numbers, datetimes and keeps missing values as null', () => {
    expect(column(water, 'meta_versions_number')).toMatchObject({
      dataType: 'number',
      semanticType: 'measurement',
    })
    expect(column(water, 'meta_first_update')?.semanticType).toBe('timestamp')
    expect(column(water, 'meta_osm_id')?.semanticType).toBe('identifier')
    expect(water.rows[0].name).toBeNull()
    // only a few names filled in: too sparse to call it a category
    expect(column(water, 'name')?.semanticType).toBe('text')
    expect(water.meta.totalRecords).toBe(waterRecords.total_count)
    expect(water.meta.title.en).toBe('Drinking Water Points - Australia - OSM data')
  })
})

describe('parseDatasetLink', () => {
  it.each([
    'https://hub.huwise.com/explore/dataset/georef-germany-land/table/',
    'https://hub.huwise.com/explore/dataset/georef-germany-land/',
    'https://hub.huwise.com/api/explore/v2.1/catalog/datasets/georef-germany-land/records?limit=10',
  ])('reads %s', (link) => {
    expect(parseDatasetLink(link)).toEqual({
      domain: 'hub.huwise.com',
      datasetId: 'georef-germany-land',
    })
  })

  it('ignores plain ids and unrelated links', () => {
    expect(parseDatasetLink('georef-germany-land')).toBeNull()
    expect(parseDatasetLink('https://example.org/some/page')).toBeNull()
  })
})

describe('stripHtml', () => {
  it('turns markup into plain text with paragraphs', () => {
    expect(stripHtml('<p>A &amp; B</p><ul><li>one</li><li>two</li></ul>')).toBe('A & B\none\ntwo')
  })
})
