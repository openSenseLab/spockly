import type * as Blockly from 'blockly'

import { EACH, pythonAt, pythonRows } from '../journal/extract'
import type { Selection, SelectionRef } from '../journal/types'
import { str, toIdentifier } from './python'

/**
 * Python for a selection: direct access into the original dataset, nothing is copied.
 * `current` is the dataset of the pipeline the block sits in: its columns are read from
 * df there, so the block sees the pipeline's filtered / changed rows.
 */
export const referenceCode = (ref: SelectionRef, name: string, current?: string) => {
  const dataset = toIdentifier(ref.dataset)
  switch (ref.kind) {
    case 'column':
      return `${current === dataset ? 'df' : dataset}[${str(ref.column)}]`
    case 'json':
      // Inside lists: one value per item, as a column (pandas Series) named like the block.
      return ref.path.includes(EACH)
        ? `pd.Series(${pythonRows(`${dataset}_json`, { path: ref.path, shape: 'values' })}, name=${str(name)})`
        : pythonAt(`${dataset}_json`, ref.path)
    case 'stat': {
      const values = `${dataset}[${str(ref.column)}]`
      if (ref.agg === 'count') return ref.column ? `int(${values}.count())` : `len(${dataset})`
      if (ref.agg === 'nunique') return `int(${values}.nunique())`
      if (ref.agg === 'first') return `${values}.dropna().iloc[0]`
      return `${values}.${ref.agg}()`
    }
  }
}

/** Whether the code needs pandas imported. */
export const referenceNeedsPandas = (ref: SelectionRef) => ref.kind === 'json' && ref.path.includes(EACH)

export const isSelectionRef = (value: unknown): value is SelectionRef => {
  const ref = value as Partial<SelectionRef> | null
  return !!ref && typeof ref.dataset === 'string' && (ref.kind === 'column' || ref.kind === 'json' || ref.kind === 'stat')
}

/**
 * What a block points to; kept per block and saved as its extra state. Column and value
 * blocks have ref and type; the "select … as …" block of a data block also its id and output.
 */
export type Reference = { ref?: SelectionRef; type?: string; id?: string; output?: Selection['output'] }

const references = new WeakMap<Blockly.Block, Reference>()
export const referenceOf = (block: Blockly.Block): Reference => references.get(block) ?? {}
export const setReference = (block: Blockly.Block, reference: Reference) => references.set(block, reference)

/** The data block's "select … as …" block: one selection, made in the Select tab. */
export const SELECT_BLOCK = 'spk_select'

/** Selections defined by "select … as …" blocks in a serialized workspace. */
export const selectionsInState = (state: unknown): Selection[] => {
  const found: Selection[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      const record = node as { type?: unknown; enabled?: unknown; fields?: { NAME?: unknown }; extraState?: Reference }
      const extra = record.extraState
      if (record.type === SELECT_BLOCK && record.enabled !== false && extra && isSelectionRef(extra.ref)) {
        found.push({
          id: String(extra.id ?? ''),
          name: String(record.fields?.NAME ?? '').trim() || 'value',
          output: extra.output === 'value' ? 'value' : 'column',
          ref: extra.ref,
          ...(extra.type ? { type: extra.type } : {}),
        })
      }
      Object.values(node).forEach(visit)
    }
  }
  visit(state)
  return found
}
