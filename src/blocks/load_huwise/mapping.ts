/**
 * Pure mapping from Huwise (formerly Opendatasoft) Explore API v2.1 responses
 * to the shared DataTable contract. No network access here.
 */
import { toGeometry } from '../../core/geometry'
import { isMissing } from '../../core/summary'
import type { ColumnMeta, DataTable, DatasetMeta, Lang, SemanticType } from '../../core/types'

// ---- Response shapes (only the parts we read) ----

export interface HuwiseField {
  name: string
  label?: string | null
  type: string // text, int, double, date, datetime, boolean, geo_point_2d, geo_shape, file, json, …
  description?: string | null
  annotations?: Record<string, unknown>
}

export interface HuwiseDatasetResponse {
  dataset_id: string
  fields: HuwiseField[]
  metas: {
    default: {
      title?: string | null
      description?: string | null
      keyword?: string[] | null
      license?: string | null
      license_url?: string | null
      language?: string | null
      modified?: string | null
      publisher?: string | null
      records_count?: number | null
      attributions?: string[] | null
      bbox?: { geometry?: { coordinates?: number[][][] } } | null
    }
    dcat?: {
      creator?: string | null
      temporal_coverage_start?: string | null
      temporal_coverage_end?: string | null
    } | null
  }
}

export interface HuwiseRecordsResponse {
  total_count: number
  results: Record<string, unknown>[]
}

// ---- Helpers ----

/** Fields we can't represent yet (attachments) are left out of the request. */
const UNSUPPORTED_TYPES = new Set(['file', 'image'])

export const isSupportedField = (field: HuwiseField) => !UNSUPPORTED_TYPES.has(field.type)

const IDENTIFIER_NAME = /(^|_)(id|uid|code|key|nr|nummer)(_|$)/i
/** A text column with at most this many distinct values counts as a category. */
const MAX_CATEGORY_VALUES = 20

export function stripHtml(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

const localized = (text: string | null | undefined, lang: Lang) =>
  text ? { [lang]: text } : undefined

/** Huwise metadata may be in any language; we file it under DE or EN, defaulting to EN. */
const toLang = (language: string | null | undefined): Lang => (language === 'de' ? 'de' : 'en')

function columnsForField(field: HuwiseField, lang: Lang): ColumnMeta[] {
  const label = localized(field.label, lang)
  const description = localized(field.description, lang)

  if (field.type === 'geo_point_2d') {
    const base = field.label ?? field.name
    return [
      {
        name: `${field.name}_lat`,
        label: localized(`${base} (lat)`, lang),
        dataType: 'number',
        semanticType: 'latitude',
        unit: '°',
        description,
      },
      {
        name: `${field.name}_lon`,
        label: localized(`${base} (lon)`, lang),
        dataType: 'number',
        semanticType: 'longitude',
        unit: '°',
        description,
      },
    ]
  }

  // A point, line or area per record (GeoJSON), e.g. the outline of a federal state.
  if (field.type === 'geo_shape') {
    return [{ name: field.name, label, dataType: 'geometry', semanticType: 'geometry', description }]
  }

  const looksLikeId = IDENTIFIER_NAME.test(field.name)
  let dataType: ColumnMeta['dataType']
  let semanticType: SemanticType

  switch (field.type) {
    case 'int':
    case 'double':
      dataType = 'number'
      semanticType = looksLikeId ? 'identifier' : 'measurement'
      break
    case 'date':
    case 'datetime':
      dataType = 'date'
      semanticType = 'timestamp'
      break
    case 'boolean':
      dataType = 'boolean'
      semanticType = 'category'
      break
    default:
      dataType = 'string'
      semanticType = looksLikeId ? 'identifier' : field.annotations?.facet ? 'category' : 'text'
  }

  return [{ name: field.name, label, dataType, semanticType, description }]
}

function cellValue(value: unknown, column: ColumnMeta): unknown {
  if (value === null || value === undefined) return null
  // Huwise wraps shapes in a GeoJSON Feature; the table keeps the bare geometry.
  if (column.dataType === 'geometry') return toGeometry(value)
  // Multivalued fields arrive as arrays.
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (column.dataType === 'number' && typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

function toRow(record: Record<string, unknown>, fields: HuwiseField[], columns: ColumnMeta[]) {
  const row: Record<string, unknown> = {}
  for (const field of fields) {
    const value = record[field.name]
    if (field.type === 'geo_point_2d') {
      const point = value as { lat?: unknown; lon?: unknown } | null | undefined
      row[`${field.name}_lat`] = typeof point?.lat === 'number' ? point.lat : null
      row[`${field.name}_lon`] = typeof point?.lon === 'number' ? point.lon : null
      continue
    }
    const column = columns.find((c) => c.name === field.name)
    if (column) row[field.name] = cellValue(value, column)
  }
  return row
}

/** Text columns with few distinct values behave like categories (e.g. yes/no). */
function refineSemanticTypes(columns: ColumnMeta[], rows: Record<string, unknown>[]): ColumnMeta[] {
  return columns.map((column) => {
    if (column.semanticType !== 'text' || rows.length === 0) return column
    const filled = rows.map((r) => r[column.name]).filter((v) => !isMissing(v))
    const distinct = new Set(filled).size
    // Values must repeat on average, otherwise it's free text (or too sparse to tell).
    return distinct > 0 && distinct <= MAX_CATEGORY_VALUES && distinct <= filled.length / 2
      ? { ...column, semanticType: 'category' }
      : column
  })
}

function bboxToExtent(
  bbox: HuwiseDatasetResponse['metas']['default']['bbox'],
): DatasetMeta['spatialExtent'] {
  const ring = bbox?.geometry?.coordinates?.[0]
  if (!ring || ring.length === 0) return undefined
  const lons = ring.map((c) => c[0])
  const lats = ring.map((c) => c[1])
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
}

export const datasetPageUrl = (domain: string, datasetId: string) =>
  `https://${domain}/explore/dataset/${encodeURIComponent(datasetId)}/`

export function toDatasetMeta(domain: string, dataset: HuwiseDatasetResponse): DatasetMeta {
  const d = dataset.metas.default
  const dcat = dataset.metas.dcat
  const lang = toLang(d.language)
  const start = dcat?.temporal_coverage_start
  const end = dcat?.temporal_coverage_end

  return {
    id: `huwise:${domain}/${dataset.dataset_id}`,
    title: localized(d.title ?? dataset.dataset_id, lang) ?? {},
    description: d.description ? localized(stripHtml(d.description), lang) : undefined,
    source: {
      name: d.publisher ?? domain,
      url: datasetPageUrl(domain, dataset.dataset_id),
      license: d.license ?? undefined,
      licenseUrl: d.license_url ?? undefined,
    },
    collectedBy: dcat?.creator ?? undefined,
    attribution: d.attributions?.length ? d.attributions.join(' · ') : undefined,
    keywords: d.keyword ?? undefined,
    updated: d.modified ?? undefined,
    spatialExtent: bboxToExtent(d.bbox),
    temporalExtent: start && end ? [start, end] : undefined,
    totalRecords: d.records_count ?? undefined,
  }
}

export function toDataTable(
  domain: string,
  dataset: HuwiseDatasetResponse,
  records: Record<string, unknown>[],
  totalRecords: number,
): DataTable {
  const lang = toLang(dataset.metas.default.language)
  const fields = dataset.fields.filter(isSupportedField)
  const columns = fields.flatMap((field) => columnsForField(field, lang))
  const rows = records.map((record) => toRow(record, fields, columns))

  return {
    meta: { ...toDatasetMeta(domain, dataset), totalRecords },
    columns: refineSemanticTypes(columns, rows),
    rows,
  }
}

// ---- Block input parsing ----

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
const DATASET_ID = /^[a-z0-9][a-z0-9_.-]*$/i

export const isValidDomain = (domain: string) => DOMAIN.test(domain)
export const isValidDatasetId = (id: string) => DATASET_ID.test(id)

/**
 * Students will often paste the link of a dataset page, e.g.
 * https://hub.huwise.com/explore/dataset/georef-germany-land/table/
 * or an API URL. Returns domain + dataset id if the text is such a link.
 */
export function parseDatasetLink(text: string): { domain: string; datasetId: string } | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  const match =
    url.pathname.match(/\/explore\/dataset\/([^/]+)/) ??
    url.pathname.match(/\/catalog\/datasets\/([^/]+)/)
  if (!match) return null
  const datasetId = decodeURIComponent(match[1])
  return isValidDomain(url.hostname) && isValidDatasetId(datasetId)
    ? { domain: url.hostname, datasetId }
    : null
}
