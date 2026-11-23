import type { Language } from '../i18n'

/** Semantic column kinds shown to learners (not raw pandas dtypes). */
export type ColumnKind = 'number' | 'category' | 'text' | 'date' | 'boolean' | 'geometry'

export type ColumnProfile = {
  name: string
  kind: ColumnKind
  dtype: string
  missing: number
  unique: number
  min?: number | string | null
  max?: number | string | null
  mean?: number | null
  median?: number | null
  std?: number | null
  /** Most frequent values for category/text/boolean columns. */
  top?: { value: string; count: number }[]
  /** Histogram bins for numeric columns. */
  histogram?: { start: number; end: number; count: number }[]
}

/** Shape of a JSON value, summarised over the first array items. */
export type JsonNode = {
  key?: string
  /** JSON type; several types are joined with "|" (e.g. "string|null"). */
  type: string
  length?: number
  example?: string
  children?: JsonNode[]
  items?: JsonNode
  truncated?: boolean
}

export type JsonInfo = {
  kind: 'json' | 'geojson'
  structure: JsonNode
  /** Keys leading to the array that became the table rows ([] = the top level). */
  recordsPath: string[] | null
  /** Field that became the geometry column, if any. */
  geometryKey: string | null
}

export type DatasetProfile = {
  name: string
  rows: number
  columns: ColumnProfile[]
  spatial: boolean
  geometryTypes: string[]
  /** [west, south, east, north] */
  bbox: [number, number, number, number] | null
  preview: Record<string, unknown>[]
  /** GeoJSON FeatureCollection preview for spatial data (capped). */
  mapPreview: GeoJSON.FeatureCollection | null
  /** Only for JSON sources. */
  json?: JsonInfo | null
}

export type ChartKind = 'bar' | 'line' | 'scatter' | 'histogram'

export type Basemap = 'light' | 'osm' | 'topo' | 'satellite' | 'dark'
export type MapStyle = 'auto' | 'points' | 'bubbles' | 'areas' | 'lines'

export type MapLayer = {
  name: string
  style: MapStyle
  geojson: GeoJSON.FeatureCollection
  colorBy: string | null
  colorKind: ColumnKind | null
  sizeBy: string | null
  label: string | null
  totalFeatures: number
}

export type FieldInfo = { name: string; kind: ColumnKind }

export type DataSourceRef = { kind: 'example' | 'url' | 'file'; ref: string }

export type CellOutput =
  | {
      type: 'table'
      title: string
      columns: FieldInfo[]
      rows: Record<string, unknown>[]
      totalRows: number
    }
  | {
      type: 'chart'
      title: string
      kind: ChartKind
      x: string
      y: string | null
      color: string | null
      fields: FieldInfo[]
      rows: Record<string, unknown>[]
      totalRows: number
    }
  | { type: 'map'; title: string; basemap: Basemap; layers: MapLayer[] }
  /** An Altair chart: its Vega-Lite specification. */
  | { type: 'vega'; title: string; spec: Record<string, unknown> }
  /** A folium map: a self-contained HTML page, shown in a sandboxed frame. */
  | { type: 'html'; title: string; html: string }
  | { type: 'value'; label: string; value: string | number | null }
  | { type: 'text'; text: string }
  | { type: 'saved'; name: string; rows: number }
  /** Emitted by the load blocks: the profile used for the data inspection task. */
  | { type: 'inspection'; source: DataSourceRef; profile: DatasetProfile }

export type RunState = {
  status: 'idle' | 'stale' | 'running' | 'done' | 'error'
  error?: string
}

export type TextCell = {
  id: string
  type: 'text'
  markdown: string
}

/** Data and analysis cells are both Blockly workspaces; they differ in their toolbox. */
export type BlockCell = {
  id: string
  type: 'data' | 'analysis'
  title: string
  workspace: object | null
  code: string
  outputs: CellOutput[]
  note: string
  /** Inspection questions answered correctly, per dataset name (data cells). */
  solved: Record<string, string[]>
}

export type DataCell = BlockCell & { type: 'data' }
export type AnalysisCell = BlockCell & { type: 'analysis' }

export type Cell = TextCell | BlockCell
export type CellType = Cell['type']

export type ShareInfo = { id: string; token: string; updatedAt: string }

export type Journal = {
  id: string
  title: string
  subtitle: string
  author: string
  language: Language
  cells: Cell[]
  /** Uploaded files (name → text) referenced by "load file" blocks. Never published. */
  files: Record<string, string>
  /** Short link of this journal; the token allows updating or deleting it. Kept only in this browser. */
  share?: ShareInfo
  updatedAt: string
}

/** What a shared link contains: everything needed to render, nothing needed to compute. */
export type PublishedJournal = {
  v: 2
  title: string
  subtitle: string
  author: string
  language: Language
  publishedAt: string
  cells: PublishedCell[]
}

export type PublishedCell =
  | { type: 'text'; markdown: string }
  | {
      type: 'data' | 'analysis'
      title: string
      note: string
      workspace: object | null
      outputs: CellOutput[]
    }
