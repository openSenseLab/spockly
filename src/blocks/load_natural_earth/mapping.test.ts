import { describe, expect, it } from 'vitest'

import countries from './__fixtures__/countries-110m-three.geojson?raw'
import lakesEurope from './__fixtures__/lakes-europe-10m-two.geojson?raw'
import lakesWorld from './__fixtures__/lakes-10m-three.geojson?raw'
import { fileUrl, toDataTable, type NeFeatureCollection } from './mapping'
import { NE_DATASETS, neDataset } from './presets'

const collection = JSON.parse(countries) as NeFeatureCollection
const table = toDataTable(neDataset('countries')!, [collection])
const row = (name: string) => table.rows.find((r) => r.name === name)!

describe('Natural Earth countries', () => {
  it('makes one row per country with German names and the shape as geometry', () => {
    expect(table.rows.map((r) => r.name).sort()).toEqual(['Deutschland', 'Fidschi', 'Frankreich'])
    expect(row('Deutschland').geometry).toMatchObject({ type: 'Polygon' })
    expect(row('Fidschi').geometry).toMatchObject({ type: 'MultiPolygon' })
    expect(table.columns.find((c) => c.name === 'geometry')).toMatchObject({ dataType: 'geometry', semanticType: 'geometry' })
  })

  it('keeps population and GDP as measurements, with the year they are from', () => {
    expect(row('Deutschland')).toMatchObject({ einwohner: 83132799, kontinent: 'Europe' })
    expect(typeof row('Deutschland').bip).toBe('number')
    expect(row('Deutschland').einwohner_jahr).toMatch(/^\d{4}$/)
    expect(table.columns.find((c) => c.name === 'einwohner')?.semanticType).toBe('measurement')
  })

  it('treats -99, Natural Earth’s mark for unknown, as missing', () => {
    // France has ISO_A3 "-99" in the source file.
    expect(row('Frankreich').iso).toBeNull()
    expect(row('Deutschland').iso).toBe('DEU')
  })

  it('describes the source, credits it and knows its extent', () => {
    expect(table.meta.source).toMatchObject({ name: 'Natural Earth', license: 'Public Domain' })
    expect(table.meta.attribution).toBe('Made with Natural Earth.')
    // Fiji crosses the 180° meridian, so the extent spans the whole width.
    const [minLon, , maxLon] = table.meta.spatialExtent!
    expect(minLon).toBeLessThan(-170)
    expect(maxLon).toBeGreaterThan(170)
  })
})

describe('Natural Earth lakes in Europe', () => {
  const lakes = toDataTable(neDataset('lakes')!, [JSON.parse(lakesWorld), JSON.parse(lakesEurope)] as NeFeatureCollection[])
  const names = lakes.rows.map((r) => r.name)

  it('joins the large lakes with the smaller European ones', () => {
    // Bodensee only in the world file, Chiemsee only in the European one.
    expect(names).toContain('Bodensee')
    expect(names).toContain('Chiemsee')
  })

  it('keeps the source as it is, including its mislabelled Lago Maggiore', () => {
    // Natural Earth 5.1.2: the world file calls the outline at 8.5–8.85° E (Lago Maggiore)
    // "Lago di Como"; the real Lake Como (9.07–9.41° E) is in the European file.
    const como = lakes.rows.filter((r) => r.name === 'Comer')
    expect(como).toHaveLength(2)
  })

  it('leaves out lakes outside Europe', () => {
    expect(names).not.toContain('Victoriasee')
  })

  it('starts the map on the Alpine foreland, where the whole of Europe would look empty', () => {
    expect(lakes.meta.initialView?.label.de).toBe('Alpenvorland (Bodensee bis Chiemsee)')
    // Bodensee and Chiemsee lie inside the first view.
    const [minLon, minLat, maxLon, maxLat] = lakes.meta.initialView!.bbox
    expect(minLon).toBeLessThan(9.03)
    expect(maxLon).toBeGreaterThan(12.53)
    expect(minLat).toBeLessThan(47.49)
    expect(maxLat).toBeGreaterThan(47.94)
    expect(table.meta.initialView).toBeUndefined() // countries: the whole world
  })
})

describe('Natural Earth datasets', () => {
  it('load pinned files from jsDelivr', () => {
    for (const file of NE_DATASETS.flatMap((d) => d.files)) {
      expect(fileUrl(file)).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/nvkelso\/natural-earth-vector@v5\.1\.2\/geojson\/ne_\w+\.geojson$/)
    }
  })
})
