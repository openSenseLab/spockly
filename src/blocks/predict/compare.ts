/** Pure logic of the "schätze …" block: the real value and how close a guess was. */
import { summarizeColumn } from '../../core/summary'
import type { DataTable } from '../../core/types'

export type Quantity = 'max' | 'min' | 'mean'

export const QUANTITIES: Quantity[] = ['max', 'min', 'mean']

export const isQuantity = (value: unknown): value is Quantity =>
  typeof value === 'string' && (QUANTITIES as string[]).includes(value)

/** The value the student is guessing, or null if the column has no numbers. */
export function actualValue(table: DataTable, columnName: string, quantity: Quantity): number | null {
  const column = table.columns.find((c) => c.name === columnName)
  if (!column || column.dataType !== 'number') return null
  const numeric = summarizeColumn(column, table.rows).numeric
  return numeric ? numeric[quantity] : null
}

export interface Comparison {
  actual: number
  /** guess − actual */
  difference: number
  verdict: 'close' | 'high' | 'low'
}

/** Within 5 % of the real value (or exactly right) counts as "close". */
const CLOSE_SHARE = 0.05

export function compareGuess(guess: number, actual: number): Comparison {
  const difference = guess - actual
  const close = Math.abs(difference) <= Math.abs(actual) * CLOSE_SHARE || Math.abs(difference) < 1e-9
  return { actual, difference, verdict: close ? 'close' : difference > 0 ? 'high' : 'low' }
}
