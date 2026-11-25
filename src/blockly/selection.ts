import type * as Blockly from 'blockly'

import { referenceOf } from './reference'

/**
 * Columns and datasets are blocks of their own ("pm10", "stations") that plug into slots
 * of the analysis blocks, instead of dropdown menus. The toolbox offers one block per
 * column and dataset; type checks keep columns out of dataset slots and vice versa.
 */

export const COLUMN_BLOCK = 'spk_column'
export const DATASET_BLOCK = 'spk_dataset'

/** Check names: a column slot accepts any column block, a dataset slot any dataset block. */
export const COLUMN_CHECK = 'Column'
export const DATASET_CHECK = 'Dataset'
export const COLOUR_CHECK = 'Colour'

type SlotKind = 'column' | 'dataset'
type Slot = { input: string; kind: SlotKind }

const columns = (...inputs: string[]): Slot[] => inputs.map((input) => ({ input, kind: 'column' }))
const datasets = (...inputs: string[]): Slot[] => inputs.map((input) => ({ input, kind: 'dataset' }))

/** Analysis blocks and their column / dataset slots (formerly dropdown fields of the same name). */
export const SELECTION_SLOTS: Record<string, Slot[]> = {
  spk_pipeline: datasets('DATASET'),
  spk_join: [...datasets('DATASET'), ...columns('COLUMN')],
  spk_filter: columns('COLUMN'),
  spk_filter_in: columns('COLUMN'),
  spk_sort: columns('COLUMN'),
  spk_group: columns('BY', 'COLUMN'),
  spk_convert: columns('COLUMN'),
  spk_round: columns('COLUMN'),
  spk_rename: columns('COLUMN'),
  spk_drop: columns('COLUMN'),
  spk_drop_missing: columns('COLUMN'),
  spk_points: columns('LON', 'LAT'),
  spk_count_within: datasets('DATASET'),
  spk_nearest: datasets('DATASET'),
  spk_inside: datasets('DATASET'),
  spk_spatial_join: datasets('DATASET'),
  spk_aggregate_within: [...columns('COLUMN'), ...datasets('DATASET')],
  spk_dissolve: columns('BY'),
  spk_show_chart: columns('X', 'Y', 'COLOR'),
  spk_show_map: columns('COLOR'),
  spk_map_layer: [...datasets('DATASET'), ...columns('COLOR', 'SIZE', 'LABEL')],
  spk_show_stat: columns('COLUMN'),
}

/** Argument for a block definition: an inline slot for a column or dataset block. */
export const columnSlot = (name: string) => ({ type: 'input_value', name, check: COLUMN_CHECK })
export const datasetSlot = (name: string) => ({ type: 'input_value', name, check: DATASET_CHECK })
/** Colour of a chart or map: by a column, or one fixed colour (colour block). */
export const colourSlot = (name: string) => ({ type: 'input_value', name, check: [COLUMN_CHECK, COLOUR_CHECK] })

/** Serialized column / dataset blocks, e.g. for toolbox entries. */
export const columnBlock = (name: string, extraState?: object) => ({
  type: COLUMN_BLOCK,
  fields: { COLUMN: name },
  ...(extraState ? { extraState } : {}),
})
export const datasetBlock = (name: string) => ({ type: DATASET_BLOCK, fields: { NAME: name } })

/**
 * The column or dataset name chosen in `input`: the name on the block plugged into the
 * slot (empty when the slot is empty). Plain fields are read as they are, so the same
 * code works for blocks that still have a field of that name (data cells).
 */
export const selectionValue = (block: Blockly.Block | null | undefined, input: string): string => {
  if (!block) return ''
  if (block.getField(input)) return String(block.getFieldValue(input) ?? '')
  const target = block.getInputTargetBlock(input)
  if (!target || !target.isEnabled()) return ''
  if (target.type === COLUMN_BLOCK) {
    // A column of a table: its real name (the block may show another one).
    const ref = referenceOf(target).ref
    return ref?.kind === 'column' ? ref.column : String(target.getFieldValue('COLUMN') ?? '')
  }
  if (target.type === DATASET_BLOCK) return String(target.getFieldValue('NAME') ?? '')
  return ''
}

/** Same for a serialized block: the field value, or the name on the block in the slot. */
export const serializedSelection = (block: { fields?: Record<string, unknown>; inputs?: Record<string, unknown> } | undefined, input: string) => {
  if (!block) return ''
  if (block.fields && input in block.fields) return String(block.fields[input] ?? '')
  const target = (block.inputs?.[input] as { block?: { fields?: Record<string, unknown> } } | undefined)?.block
  return String(target?.fields?.COLUMN ?? target?.fields?.NAME ?? '')
}

/**
 * Workspaces saved with dropdown fields ({"fields": {"COLUMN": "pm10"}}) get the matching
 * column / dataset block in the slot instead, so nothing is lost.
 */
export const migrateSelections = <T>(state: T): T => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit)
    if (!node || typeof node !== 'object') return node
    const record = Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)])) as {
      type?: unknown
      fields?: Record<string, unknown>
      inputs?: Record<string, unknown>
    }
    const slots = typeof record.type === 'string' ? SELECTION_SLOTS[record.type] : undefined
    if (!slots || !record.fields) return record
    const fields = { ...record.fields }
    const inputs = { ...(record.inputs ?? {}) }
    for (const slot of slots) {
      if (!(slot.input in fields)) continue
      const name = String(fields[slot.input] ?? '')
      delete fields[slot.input]
      if (!name || inputs[slot.input]) continue
      inputs[slot.input] = { block: slot.kind === 'column' ? columnBlock(name) : datasetBlock(name) }
    }
    return { ...record, fields, inputs }
  }
  return visit(state) as T
}
