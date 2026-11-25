import type * as Blockly from 'blockly'

import { nodeAt, parsePath } from '../journal/extract'
import { useKernelStore } from '../kernel/kernel'
import { toIdentifier } from './python'
import type { ValueType } from './valueInputs'

/**
 * Values taken in data blocks ("take value", "take the mean of …") and their type,
 * which the "value" block uses as its Blockly output check.
 */

export type ValueInfo = { name: string; type?: ValueType }

/** Blocks in data cells that create a single value. */
export const VALUE_BLOCKS = ['spk_take_value', 'spk_take_stat']

/** Aggregations that always give a number; min, max and first keep the column's type. */
const NUMERIC_AGGS = ['count', 'nunique', 'mean', 'median', 'sum', 'std']

const fromJsonType = (type: string | undefined): ValueType | undefined =>
  type === 'number' ? 'Number' : type === 'string' ? 'String' : type === 'boolean' ? 'Boolean' : undefined

const fromColumnKind = (kind: string | undefined): ValueType | undefined =>
  kind === 'number' ? 'Number' : kind === 'boolean' ? 'Boolean' : kind === 'text' || kind === 'category' ? 'String' : undefined

/** Name and (once Python has run) type of the value a take block creates. */
export const valueOfBlock = (type: string, fields: Record<string, unknown>): ValueInfo | null => {
  const name = toIdentifier(String(fields.NAME ?? ''))
  if (!VALUE_BLOCKS.includes(type) || !name) return null
  const source = toIdentifier(String(fields.DATASET ?? ''))
  const { structures, schemas } = useKernelStore.getState()
  if (type === 'spk_take_value') {
    const path = parsePath(String(fields.PATH ?? ''))
    const node = path && structures[source] ? nodeAt(structures[source], path) : null
    return { name, type: fromJsonType(node?.type) }
  }
  const agg = String(fields.AGG ?? '')
  if (NUMERIC_AGGS.includes(agg)) return { name, type: 'Number' }
  const column = schemas[source]?.find((field) => field.name === fields.COLUMN)
  return { name, type: fromColumnKind(column?.kind) }
}

/** Take-value blocks in a serialized workspace. */
export const valuesInState = (state: unknown): ValueInfo[] => {
  const values: ValueInfo[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      const record = node as { type?: unknown; fields?: Record<string, unknown> }
      const value = typeof record.type === 'string' && record.fields ? valueOfBlock(record.type, record.fields) : null
      if (value) values.push(value)
      Object.values(node).forEach(visit)
    }
  }
  visit(state)
  return values
}

/** Take-value blocks in a live workspace (the lab, or a data cell being edited). */
export const valuesInWorkspace = (workspace: Blockly.Workspace | null | undefined): ValueInfo[] =>
  (workspace?.getAllBlocks(false) ?? []).flatMap((block) => {
    if (!VALUE_BLOCKS.includes(block.type) || !block.isEnabled()) return []
    const fields = Object.fromEntries(['NAME', 'DATASET', 'PATH', 'AGG', 'COLUMN'].map((name) => [name, block.getFieldValue(name)]))
    const value = valueOfBlock(block.type, fields)
    return value ? [value] : []
  })

/** Merge value lists; the later definition of a name wins (like in Python). */
export const mergeValues = (...lists: ValueInfo[][]) => {
  const byName = new Map<string, ValueInfo>()
  for (const value of lists.flat()) byName.set(value.name, value)
  return [...byName.values()]
}
