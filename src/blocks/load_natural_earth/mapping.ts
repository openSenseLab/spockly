/** Natural Earth GeoJSON → the shared DataTable. No network access here. */
import { boundsOf, toGeometry } from '../../core/geometry'
import type { ColumnMeta, DataTable, Geometry } from '../../core/types'
import { NE_BASE, NE_VERSION, type Bbox, type NeColumn, type NeDataset } from './presets'

export interface NeFeatureCollection {
  type: 'FeatureCollection'
  features: { properties?: Record<string, unknown> | null; geometry?: unknown }[]
}

export const fileUrl = (file: string) => `${NE_BASE}/${file}.geojson`

/** Natural Earth marks unknown values as -99. */
const isUnknown = (v: unknown) => v === null || v === undefined || v === '' || v === -99 || v === '-99'

function valueOf(properties: Record<string, unknown>, column: NeColumn): unknown {
  const raw = column.from.map((key) => properties[key]).find((v) => !isUnknown(v))
  if (raw === undefined) return null
  if (column.dataType === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return String(raw)
}

const overlaps = (a: Bbox, b: Bbox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

/**
 * One row per feature of all the dataset's files, in file order. The two
 * lake files complement each other: lakes with the same name in both
 * (checked 2026-10-26) are different lakes, or one of them is mislabelled
 * (see the spike doc), so nothing is dropped as a duplicate.
 */
export function toDataTable(dataset: NeDataset, collections: NeFeatureCollection[]): DataTable {
  const rows: Record<string, unknown>[] = []
  const shapes: Geometry[] = []
  for (const feature of collections.flatMap((c) => c.features)) {
    const geometry = toGeometry(feature.geometry)
    if (!geometry) continue
    if (dataset.within && !overlaps(boundsOf([geometry])!, dataset.within)) continue
    const properties = feature.properties ?? {}
    const row: Record<string, unknown> = {}
    for (const column of dataset.columns) row[column.name] = valueOf(properties, column)
    row.geometry = geometry
    rows.push(row)
    shapes.push(geometry)
  }

  const columns: ColumnMeta[] = [
    ...dataset.columns.map(({ name, label, dataType, semanticType, unit }) => ({ name, label, dataType, semanticType, unit })),
    { name: 'geometry', label: { de: 'Form', en: 'Shape' }, dataType: 'geometry', semanticType: 'geometry' },
  ]

  return {
    meta: {
      id: `natural-earth:${dataset.id}`,
      title: { de: `Natural Earth: ${dataset.label.de}`, en: `Natural Earth: ${dataset.label.en}` },
      description: {
        de: `${dataset.description.de} Natural Earth ${NE_VERSION}, ${dataset.files.length > 1 ? 'Dateien' : 'Datei'} ${dataset.files.join(', ')}.`,
        en: `${dataset.description.en} Natural Earth ${NE_VERSION}, ${dataset.files.length > 1 ? 'files' : 'file'} ${dataset.files.join(', ')}.`,
      },
      source: {
        name: 'Natural Earth',
        url: 'https://www.naturalearthdata.com',
        license: 'Public Domain',
        licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
      },
      // Not required (public domain), but the wording Natural Earth suggests.
      attribution: 'Made with Natural Earth.',
      keywords: ['Natural Earth', dataset.label.de ?? dataset.id],
      spatialExtent: boundsOf(shapes),
      initialView: dataset.view,
      totalRecords: rows.length,
    },
    columns,
    rows,
  }
}
