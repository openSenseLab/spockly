import type { ColumnMeta, DataTable } from './types'

export interface ColumnSummary {
  column: ColumnMeta
  /** Rows that have a value. */
  filled: number
  missing: number
  distinct: number
  numeric?: { min: number; max: number; mean: number; median: number }
  time?: { first: string; last: string }
  /** Most frequent values, most frequent first (categories and text). */
  topValues?: { value: string; count: number }[]
}

const TOP_VALUES = 3

export const isMissing = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const median = (sorted: number[]) => {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function summarizeColumn(column: ColumnMeta, rows: DataTable['rows']): ColumnSummary {
  const values = rows.map((row) => row[column.name]).filter((value) => !isMissing(value))
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = String(value)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const summary: ColumnSummary = {
    column,
    filled: values.length,
    missing: rows.length - values.length,
    distinct: counts.size,
  }

  if (column.dataType === 'number') {
    const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (numbers.length > 0) {
      const sorted = [...numbers].sort((a, b) => a - b)
      summary.numeric = {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: numbers.reduce((sum, n) => sum + n, 0) / numbers.length,
        median: median(sorted),
      }
    }
  }

  if (column.dataType === 'date') {
    const times = values
      .map((v) => ({ raw: String(v), ms: Date.parse(String(v)) }))
      .filter((t) => !Number.isNaN(t.ms))
      .sort((a, b) => a.ms - b.ms)
    if (times.length > 0) {
      summary.time = { first: times[0].raw, last: times[times.length - 1].raw }
    }
  }

  if (column.semanticType === 'category' || column.semanticType === 'text') {
    summary.topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_VALUES)
      .map(([value, count]) => ({ value, count }))
  }

  return summary
}

export const summarizeTable = (table: DataTable) =>
  table.columns.map((column) => summarizeColumn(column, table.rows))
