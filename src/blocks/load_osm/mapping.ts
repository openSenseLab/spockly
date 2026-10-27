/** Overpass JSON → the shared DataTable. No network access here. */
import type { ColumnMeta, DataTable, Geometry, LocalizedText } from '../../core/types'
import type { AreaPreset } from '../load_osem/presets'
import { osmArea, SNAPSHOT_DATE, type OsmTopic } from './presets'

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export interface OverpassResponse {
  elements: OverpassElement[]
  osm3s?: { timestamp_osm_base?: string }
}

export interface LoadOsmParams {
  topic: string
  area: string
}

/** The element's shape: a point for nodes and way centres, else the way as line or (closed) area. */
export function elementGeometry(element: OverpassElement, shape: OsmTopic['shape']): Geometry | null {
  if (element.type === 'node' && typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { type: 'Point', coordinates: [element.lon, element.lat] }
  }
  if (element.center) return { type: 'Point', coordinates: [element.center.lon, element.center.lat] }
  const coords = element.geometry?.map((p) => [p.lon, p.lat])
  if (!coords || coords.length < 2) return null
  const [first, last] = [coords[0], coords[coords.length - 1]]
  const closed = coords.length >= 4 && first[0] === last[0] && first[1] === last[1]
  if (shape === 'area' && closed) return { type: 'Polygon', coordinates: [coords] }
  return { type: 'LineString', coordinates: coords }
}

export function toOsmTable(
  topic: OsmTopic,
  params: LoadOsmParams,
  response: OverpassResponse,
  {
    fromSnapshot = false,
    askedFor = params.area,
  }: {
    fromSnapshot?: boolean
    /** The area the student picked, if the stored copy is of another one. */
    askedFor?: string
  } = {},
): DataTable {
  const area = osmArea(params.area)!
  const rows: Record<string, unknown>[] = []
  for (const element of response.elements ?? []) {
    const geometry = elementGeometry(element, topic.shape)
    if (!geometry) continue
    const tags = element.tags ?? {}
    const row: Record<string, unknown> = { name: tags.name ?? null }
    if (topic.derived) row[topic.derived.name] = topic.derived.of(tags)
    for (const column of topic.columns) row[column.name] = tags[column.tag] ?? null
    row.osm_id = `${element.type}/${element.id}`
    row.geometry = geometry
    rows.push(row)
  }

  const columns: ColumnMeta[] = [
    { name: 'name', label: { de: 'Name', en: 'Name' }, dataType: 'string', semanticType: 'text' },
    ...(topic.derived
      ? [{ name: topic.derived.name, label: topic.derived.label, dataType: 'string', semanticType: 'category' } satisfies ColumnMeta]
      : []),
    ...topic.columns.map(({ name, label, semanticType }): ColumnMeta => ({ name, label, dataType: 'string', semanticType })),
    { name: 'osm_id', label: { de: 'OSM-Kennung', en: 'OSM id' }, dataType: 'string', semanticType: 'identifier' },
    { name: 'geometry', label: { de: 'Form', en: 'Shape' }, dataType: 'geometry', semanticType: 'geometry' },
  ]

  const stand = response.osm3s?.timestamp_osm_base
  const relations =
    topic.shape === 'area'
      ? {
          de: ' Flächen, die in OpenStreetMap aus mehreren Teilen bestehen (Relationen), fehlen noch.',
          en: ' Areas made of several parts in OpenStreetMap (relations) are not included yet.',
        }
      : { de: '', en: '' }

  return {
    meta: {
      id: `osm:${topic.id}:${params.area}`,
      title: {
        de: `OpenStreetMap: ${topic.label.de} – ${area.label.de}`,
        en: `OpenStreetMap: ${topic.label.en} – ${area.label.en}`,
      },
      description: {
        de:
          `${topic.label.de} aus OpenStreetMap im Rechteck um ${area.label.de}, eingetragen von Freiwilligen.` +
          ` Was nicht eingetragen ist, fehlt – die Karte ist so vollständig wie die Arbeit der Mitwirkenden.${relations.de}`,
        en:
          `${topic.label.en} from OpenStreetMap in the rectangle around ${area.label.en}, mapped by volunteers.` +
          ` What nobody has mapped is missing – the map is as complete as its contributors' work.${relations.en}`,
      },
      source: {
        name: 'OpenStreetMap',
        url: 'https://www.openstreetmap.org',
        license: 'ODbL 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      },
      attribution: '© OpenStreetMap-Mitwirkende (openstreetmap.org/copyright)',
      keywords: ['OpenStreetMap', topic.label.de ?? topic.id, area.label.de ?? area.id],
      updated: stand,
      spatialExtent: area.bbox,
      mapStyle: topic.derived
        ? { categories: { column: topic.derived.name, entries: topic.derived.kinds.map(({ value, label, color }) => ({ value, label, color })) } }
        : topic.mapStyle,
      totalRecords: rows.length,
      knownIssues: fromSnapshot ? [snapshotNotice(area, osmArea(askedFor) ?? area)] : undefined,
    },
    columns,
    rows,
  }
}

/** Says that this is a stored copy, and of which place if it isn't the one asked for. */
function snapshotNotice(area: AreaPreset, askedFor: AreaPreset): LocalizedText {
  const date = SNAPSHOT_DATE.split('-').reverse().join('.')
  if (area.id === askedFor.id) {
    return {
      de: `Die OpenStreetMap-Server waren gerade nicht erreichbar. Das ist eine gespeicherte Kopie vom ${date} – nicht ganz aktuell, aber dieselbe Art von Daten.`,
      en: `The OpenStreetMap servers could not be reached. This is a stored copy from ${SNAPSHOT_DATE} – not quite up to date, but the same kind of data.`,
    }
  }
  return {
    de: `Die OpenStreetMap-Server waren gerade nicht erreichbar, und für ${askedFor.label.de} gibt es keine gespeicherte Kopie. Damit du weiterarbeiten kannst, siehst du die gespeicherte Kopie für ${area.label.de} vom ${date}. Versuch es später noch einmal mit ${askedFor.label.de}.`,
    en: `The OpenStreetMap servers could not be reached, and there is no stored copy for ${askedFor.label.en}. So that you can keep working, this is the stored copy for ${area.label.en} from ${SNAPSHOT_DATE}. Try ${askedFor.label.en} again later.`,
  }
}

/** Checks params coming from a saved block; anything odd falls back to the defaults. */
export function normalizeOsmParams(raw: unknown, topics: { id: string }[]): LoadOsmParams {
  const r = (raw ?? {}) as Partial<LoadOsmParams>
  return {
    topic: typeof r.topic === 'string' && topics.some((t) => t.id === r.topic) ? r.topic : topics[0].id,
    area: typeof r.area === 'string' && osmArea(r.area) ? r.area : 'muenster-mitte',
  }
}
