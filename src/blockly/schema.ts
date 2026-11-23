import type * as Blockly from 'blockly'

import { useKernelStore, type CoordinateSystem } from '../kernel/kernel'
import { toIdentifier } from './python'

export const PIPELINE = 'spk_pipeline'

const isStep = (block: Blockly.Block) =>
  block.type !== PIPELINE && block.type !== 'spk_map_layer' && !!block.previousConnection

const allColumns = () => {
  const columns = new Set<string>()
  for (const fields of Object.values(useKernelStore.getState().schemas)) {
    for (const field of fields) columns.add(field.name)
  }
  return [...columns]
}

const datasetColumns = (name: string) =>
  useKernelStore.getState().schemas[toIdentifier(name)]?.map((field) => field.name) ?? null

/** Apply what a step does to the column list, without running Python. */
const applyStep = (columns: string[], step: Blockly.Block): string[] => {
  const field = (name: string) => String(step.getFieldValue(name) ?? '')
  const add = (...names: string[]) => [...columns.filter((c) => !names.includes(c)), ...names]
  switch (step.type) {
    case 'spk_compute':
    case 'spk_distance':
    case 'spk_area':
    case 'spk_count_within':
    case 'spk_length':
    case 'spk_nearest':
      return add(field('NAME'))
    case 'spk_aggregate_within':
      return add(field('NAME') || (field('AGG') === 'count' ? 'count' : `${field('AGG')}_${field('COLUMN')}`))
    case 'spk_spatial_join': {
      const other = datasetColumns(field('DATASET')) ?? []
      return add(...other.filter((c) => c !== 'geometry' && !columns.includes(c)))
    }
    case 'spk_buffer':
    case 'spk_to_centroids':
      return columns.includes('geometry') ? columns : add('geometry')
    case 'spk_dissolve':
      return columns
    case 'spk_convex_hull':
      return ['geometry']
    case 'spk_grid':
      return ['geometry', 'count']
    case 'spk_points':
      return add('geometry')
    case 'spk_centroid':
      return add(...centreColumns(step))
    case 'spk_drop':
      return columns.filter((c) => c !== field('COLUMN'))
    case 'spk_rename':
      return columns.map((c) => (c === field('COLUMN') ? field('NAME') : c))
    case 'spk_group': {
      const agg = field('AGG')
      return [field('BY'), agg === 'count' ? 'count' : toIdentifier(`${agg}_${field('COLUMN')}`)]
    }
    case 'spk_join': {
      const other = datasetColumns(field('DATASET')) ?? []
      return add(...other.filter((c) => !columns.includes(c) && c !== 'geometry'))
    }
    default:
      return columns
  }
}

/**
 * Columns available at the position of `block`: the pipeline's dataset columns,
 * transformed by every step above it. Falls back to all known columns.
 */
export const columnsForBlock = (block: Blockly.Block | null): string[] => {
  // Map layers: another dataset's columns, or (current data) = the enclosing map block's position.
  let layer = block
  while (layer && layer.type !== 'spk_map_layer') layer = layer.getParent()
  if (layer) {
    const dataset = String(layer.getFieldValue('DATASET') ?? '')
    if (dataset) return datasetColumns(dataset) ?? allColumns()
    block = layer.getSurroundParent()
  }
  let step = block
  while (step && !isStep(step) && step.type !== PIPELINE) step = step.getParent()
  if (!step) return allColumns()

  const chain: Blockly.Block[] = []
  let current: Blockly.Block | null = step.type === PIPELINE ? step : step.getPreviousBlock()
  while (current && current.type !== PIPELINE) {
    chain.unshift(current)
    current = current.getPreviousBlock()
  }
  if (!current) return allColumns()

  const base = datasetColumns(String(current.getFieldValue('DATASET') ?? ''))
  if (!base) return allColumns()
  return chain.reduce(applyStep, base).filter(Boolean)
}

/** Columns a step adds that always hold numbers (measurements, counts, statistics). */
const numericOutputs = (step: Blockly.Block): string[] => {
  const field = (name: string) => String(step.getFieldValue(name) ?? '')
  switch (step.type) {
    case 'spk_distance':
    case 'spk_area':
    case 'spk_length':
    case 'spk_nearest':
    case 'spk_count_within':
    case 'spk_compute':
      return [field('NAME')]
    case 'spk_aggregate_within':
      return [field('NAME') || (field('AGG') === 'count' ? 'count' : `${field('AGG')}_${field('COLUMN')}`)]
    case 'spk_group':
      return field('AGG') === 'count' ? ['count'] : [toIdentifier(`${field('AGG')}_${field('COLUMN')}`)]
    case 'spk_grid':
      return ['count']
    case 'spk_centroid':
      return centreColumns(step)
    default:
      return []
  }
}

/**
 * Whether a column holds numbers at the position of `block` (e.g. to pick a
 * continuous or a categorical colour scale). Undefined when unknown.
 */
export const isNumericColumn = (block: Blockly.Block | null, column: string): boolean | undefined => {
  const kinds = (name: string) => useKernelStore.getState().schemas[toIdentifier(name)]
  let layer = block
  while (layer && layer.type !== 'spk_map_layer') layer = layer.getParent()
  if (layer) {
    const dataset = String(layer.getFieldValue('DATASET') ?? '')
    if (dataset) {
      const field = kinds(dataset)?.find((f) => f.name === column)
      return field ? field.kind === 'number' : undefined
    }
    block = layer.getSurroundParent()
  }
  let step = block
  while (step && !isStep(step) && step.type !== PIPELINE) step = step.getParent()
  if (!step) return undefined
  let current: Blockly.Block | null = step.type === PIPELINE ? step : step.getPreviousBlock()
  const chain: Blockly.Block[] = []
  while (current && current.type !== PIPELINE) {
    chain.unshift(current)
    current = current.getPreviousBlock()
  }
  // The last step that produced the column decides; otherwise the dataset's own type.
  for (const previous of [...chain].reverse()) {
    if (numericOutputs(previous).includes(column)) return true
  }
  const field = current ? kinds(String(current.getFieldValue('DATASET') ?? ''))?.find((f) => f.name === column) : undefined
  return field ? field.kind === 'number' : undefined
}

const WGS84: CoordinateSystem = { crs: 'EPSG:4326', projected: false }

/** The pipeline block and the steps before `block` (in order), or null outside a pipeline. */
const chainBefore = (block: Blockly.Block | null) => {
  let step = block
  while (step && !isStep(step) && step.type !== PIPELINE) step = step.getParent()
  if (!step) return null
  const chain: Blockly.Block[] = []
  let current: Blockly.Block | null = step.type === PIPELINE ? step : step.getPreviousBlock()
  while (current && current.type !== PIPELINE) {
    chain.unshift(current)
    current = current.getPreviousBlock()
  }
  return current ? { pipeline: current, chain } : null
}

/**
 * Coordinate system of the data at the position of `block`: the dataset's own system
 * (reported by Python), changed by "transform coordinate system" or "create points".
 * Undefined when not known yet (before the first run).
 */
export const crsAt = (block: Blockly.Block | null): CoordinateSystem | undefined => {
  const found = chainBefore(block)
  if (!found) return undefined
  let system: CoordinateSystem | undefined =
    useKernelStore.getState().crs[toIdentifier(String(found.pipeline.getFieldValue('DATASET') ?? ''))]
  for (const step of found.chain) {
    if (step.type === 'spk_to_crs') {
      const crs = String(step.getFieldValue('CRS') ?? '')
      system = { crs, projected: crs !== 'EPSG:4326' }
    }
    if (step.type === 'spk_points') system = WGS84
  }
  return system
}

/** Names of the columns "add centre coordinates" creates: x/y in a metric system, lon/lat in degrees. */
export const centreColumns = (step: Blockly.Block): [string, string] =>
  String(step.getFieldValue('MODE') ?? 'own') === 'own' && crsAt(step)?.projected
    ? ['centroid_x', 'centroid_y']
    : ['centroid_lon', 'centroid_lat']
