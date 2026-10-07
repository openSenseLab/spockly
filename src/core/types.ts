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

/** Values of `date` columns are ISO 8601 strings, so tables stay JSON-serialisable. */
export type DataType = 'number' | 'string' | 'date' | 'boolean'

export interface ColumnMeta {
  name: string
  label?: LocalizedText
  dataType: DataType
  semanticType: SemanticType
  unit?: string
  description?: LocalizedText
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
  /** `unit` says what is being counted, for the progress message. */
  onProgress?: (done: number, total: number, unit?: 'rows' | 'stations') => void
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
