/**
 * Shared data contract (see docs/PROTOTYPE_BRIEF.md §3.2–3.4).
 * Every loader produces a DataTable; every operation consumes and produces one.
 */

export type Lang = 'de' | 'en'
export type LocalizedText = { de?: string; en?: string }

export type SemanticType =
  | 'measurement' // numeric quantity, usually with a unit
  | 'category' // discrete labels
  | 'timestamp'
  | 'latitude'
  | 'longitude'
  | 'identifier' // e.g. sensor id — numeric but averaging it is meaningless
  | 'text'
  | 'geometry' // the shape of a row: a point, line or area

/**
 * Values of `date` columns are ISO 8601 strings and values of `geometry`
 * columns are GeoJSON geometries, so tables stay JSON-serialisable.
 */
export type DataType = 'number' | 'string' | 'date' | 'boolean' | 'geometry'

/** A GeoJSON geometry (RFC 7946): coordinates are [longitude, latitude]. */
export type Geometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'MultiPoint' | 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString' | 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export interface ColumnMeta {
  name: string
  label?: LocalizedText
  dataType: DataType
  semanticType: SemanticType
  unit?: string
  description?: LocalizedText
}

/** Map symbols for points: what the place is. */
export type MapSymbol = 'playground' | 'drinking-water' | 'bus-stop' | 'tree'

export interface MapStyle {
  /** Icon for points, and on the middle of areas. */
  symbol?: MapSymbol
  /** What the symbol stands for, for the legend (e.g. "Spielplatz"). */
  label?: LocalizedText
  /** Colour of the icon badge and of the areas (hex: drawn on a canvas). */
  color?: string
  /** Colour by the values of a category column, in legend order; other values are grey. */
  categories?: { column: string; entries: { value: string; label: LocalizedText; color: string }[] }
}

export interface DatasetMeta {
  id: string
  title: LocalizedText
  description?: LocalizedText
  source: { name: string; url?: string; license?: string; licenseUrl?: string }
  collectedBy?: string
  attribution?: string
  keywords?: string[]
  /** ISO timestamp of the last data update reported by the source. */
  updated?: string
  spatialExtent?: [minLon: number, minLat: number, maxLon: number, maxLat: number]
  /**
   * What a place (latitude/longitude) in the rows stands for: a measuring
   * station on the ground, or a cell of a model/satellite grid. Shown on the
   * map; unset for other data.
   */
  placeKind?: 'sensor-station' | 'grid-cell'
  /**
   * Gridded (raster) data: every row is one cell of a regular grid, its
   * latitude/longitude columns give the cell centre. The map draws the cells
   * as tiles of this size, in degrees.
   */
  grid?: { cellSize: [lon: number, lat: number] }
  /** Outline of the area the data is about (e.g. Germany); drawn on the map. */
  outline?: { geometry: Geometry; label: LocalizedText }
  /** Places for orientation on the map (e.g. Münster). Not part of the data. */
  landmarks?: { label: LocalizedText; lat: number; lon: number }[]
  /** What the map shows first when the data covers far more (e.g. Germany out of Europe). */
  initialView?: { bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number]; label: LocalizedText }
  /** How the map draws shapes that no measurement colours (e.g. OpenStreetMap features). */
  mapStyle?: MapStyle
  temporalExtent?: [startIso: string, endIso: string]
  /** Number of records the source holds; may exceed the rows actually loaded. */
  totalRecords?: number
  knownIssues?: LocalizedText[]
  suggestedQuestions?: LocalizedText[]
}

export interface DataTable {
  meta: DatasetMeta
  columns: ColumnMeta[]
  rows: Record<string, unknown>[]
}

// ---- Plan ----

export interface PlanStep {
  id: string // = Blockly block id
  op: string
  params: Record<string, unknown>
  disabled?: boolean
}

export interface Strand {
  id: string // = hat block id
  outputName?: string
  steps: PlanStep[]
}

export interface Plan {
  strands: Strand[]
}

// ---- Operations ----

export interface Warning {
  /** i18n key; the UI renders it, so core logic stays language-free. */
  code: string
  vars?: Record<string, string | number>
  severity: 'info' | 'warning' | 'error'
}

export interface ExecContext {
  signal?: AbortSignal
  /** `unit` says what is being counted, for the progress message ("servers": which server is being asked). */
  onProgress?: (done: number, total: number, unit?: 'rows' | 'stations' | 'servers') => void
}

export interface OperationDef<P = Record<string, unknown>> {
  op: string
  kind: 'load' | 'transform' | 'view' | 'output'
  inferSchema(
    input: ColumnMeta[] | null,
    params: P,
  ): { columns: ColumnMeta[]; warnings: Warning[] }
  execute(input: DataTable | null, params: P, ctx: ExecContext): Promise<DataTable>
  /** `names.output`: variable name for this step's data in the generated code. */
  toCode?(params: P, names?: { output?: string }): { python?: string; sql?: string }
}
