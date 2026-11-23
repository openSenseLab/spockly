/**
 * A Python error in words students understand, at the block that caused it.
 * The run notes each block once it finished (merke), so the failed block is
 * the first one without a note; the step before it says what the data was
 * then, which is usually the reason (still text, JSON but no table yet).
 *
 * Errors are explained in three layers: what we know about the block (a
 * reading step, a "zeige …" block), then what Python's kind of error usually
 * means here, and last a tip how to find the cause. A block the explanation
 * suggests comes with the toolbox category it is in, and fits where the data
 * comes from: openSenseMap's answer and GeoJSON are translated from JSON, a
 * CSV file from CSV.
 */
import type * as Blockly from 'blockly'

import type { Snapshot } from '../core/fromPython'
import { isGeometry } from '../core/geometry'
import { t } from '../i18n'
import { blocksInRunOrder, categoryNames, datasetBlocks, datasetNameOf, datasetOf, isView, lastStepOf, stepBefore, stepsOf } from './program'
import { LOAD_FILE } from './files'
import { OSEM_BOX, OSEM_BOXES, OSEM_MEASUREMENTS, OSEM_TABLE } from './osem'
import { GEOJSON_TABLE, READ_JSON, SPLIT_POSITION, TRANSLATE_CSV } from './steps'
import { VIEW_MAP, VIEW_SHAPES } from './views'

export interface StepProblem {
  /** The block that failed; null if that isn't known. */
  blockId: string | null
  text: string
}

/** A text with the toolbox categories filled in, for "(unter „Allgemeine Blöcke“)". */
export const say = (key: string, vars: Record<string, string> = {}) => t(key, { ...categoryNames(), ...vars })

/** Where a dataset's data comes from, as far as it matters for the next block. */
export type Source = 'osem' | 'csv' | 'geojson' | 'json' | 'unknown'

export function sourceOf(dataset: Blockly.Block | null | undefined): Source {
  const first = dataset ? stepsOf(dataset)[0] : undefined
  if (first?.type === OSEM_BOXES || first?.type === OSEM_BOX) return 'osem'
  if (first?.type !== LOAD_FILE) return 'unknown'
  const file = String(first.getFieldValue('FILE') ?? '').toLowerCase()
  if (/\.(csv|tsv|txt)$/.test(file)) return 'csv'
  if (file.endsWith('.geojson')) return 'geojson'
  if (file.endsWith('.json')) return 'json'
  return 'unknown'
}

/** The block that translates text from this source, and where to find it. GeoJSON is JSON. */
const readNext = (source: Source) => say(`next.read.${source === 'csv' || source === 'unknown' ? source : 'json'}`)

/** The block that makes a table of the translated data from this source (a list, GeoJSON, stations), and where to find it. */
const tableNext = (source: Source) => say(`next.table.${source === 'osem' || source === 'geojson' ? source : 'json'}`)

/** The last line of a Python traceback without its exception name, e.g. "Diese Spalte gibt es nicht: …". */
function lastLine(message: string): string {
  const line = message.trim().split('\n').at(-1) ?? ''
  return line.replace(/^\w+(Error|Exception)?: /, '').replace(/^["'](.*)["']$/, '$1')
}

/**
 * What Python's kind of error usually means for students' data, or null.
 * `name` is the dataset, `data` how it looked before the failed block.
 */
function explainKind(message: string, name: string, data: Snapshot | undefined, source: Source): string | null {
  const column = message.match(/KeyError: ['"]([^'"]+)['"]\s*$/)?.[1]
  // Python tried a table's tools on something else: say what it was.
  if (/'(list|dict)' object has no attribute|list indices must be|unhashable type: '(list|dict)'/.test(message) || data?.art === 'json') {
    return say('error.notTable', { name, next: tableNext(source) })
  }
  if (/'str' object has no attribute|string indices must be integers/.test(message) || data?.art === 'text') {
    return say('error.stillText', { name, next: readNext(source) })
  }
  if (/Can only use \.str accessor/.test(message)) return say('error.kind.noLists', { name })
  if (/OutOfBoundsDatetime|DateParseError|Unknown datetime string|time data .* does not match/.test(message)) return say('error.kind.date', { name })
  if (/could not convert|invalid literal|Unable to parse string/.test(message)) return say('error.kind.number', { name })
  if (/MemoryError|out of memory/i.test(message)) return say('error.kind.memory')
  if (column) return say('error.noColumn', { name, column })
  if (/TypeError/.test(message)) return say('error.kind.type', { name })
  return null
}

/** A "zeige …" block failed: usually its dataset isn't a table yet, or a chosen column is missing. */
function explainView(view: Blockly.Block, message: string, snapshots: Record<string, Snapshot>, source: Source): string {
  const name = String(view.getFieldValue('DATASET') ?? '')
  const last = lastStepOf(view.workspace, name)
  const data = last ? snapshots[last.id] : undefined
  if (data?.art === 'text') return say('error.view.stillText', { name, next: readNext(source) })
  if (data?.art === 'json') return say('error.view.notTable', { name, next: tableNext(source) })
  // The last match: Python's traceback also shows the line of spockly.py that raised it, with its f-string.
  const missing = [...message.matchAll(/Diese Spalte gibt es nicht: (.+?)\. Vorhanden: (.*?)['"]?$/gm)].at(-1)
  if (missing) {
    // The other map would fit: shapes (from GeoJSON) on the point map, or points on the shapes map.
    const shapes = shapeColumnOf(data)
    if (view.type === VIEW_MAP && shapes) return say('error.view.useShapes', { name, column: shapes })
    if (view.type === VIEW_SHAPES && data?.art === 'tabelle' && !shapes) return say('error.view.usePoints', { name })
    return say('error.view.noColumn', { name, column: missing[1], columns: missing[2] })
  }
  return explainKind(message, name, data, source) ?? say('error.unknown', { problem: lastLine(message) })
}

/** The column of a table that holds whole shapes (GeoJSON geometries), from a snapshot's first rows. */
function shapeColumnOf(data: Snapshot | undefined): string | undefined {
  if (data?.art !== 'tabelle') return undefined
  return data.spalten.find((_, i) => {
    const filled = data.zeilen.map((row) => row[i]).filter((value) => value !== null && value !== undefined)
    return filled.length > 0 && filled.every(isGeometry)
  })
}

/**
 * The dataset starts with one openSenseMap station, but openSenseMap knows no
 * such ID: its answer is an error, which fails a step or two later.
 */
function unknownBox(dataset: Blockly.Block | null | undefined, snapshots: Record<string, Snapshot>): string | null {
  const first = dataset ? stepsOf(dataset)[0] : undefined
  if (first?.type !== OSEM_BOX) return null
  const answer = snapshots[first.id]
  const text = answer && answer.art !== 'tabelle' ? answer.text : ''
  return /"NotFound"/.test(text) ? say('error.osem.noBox', { id: String(first.getFieldValue('BOX') ?? '') }) : null
}

export function explainError(message: string, workspace: Blockly.Workspace, snapshots: Record<string, Snapshot>): StepProblem {
  const failed = blocksInRunOrder(workspace).find((block) => !snapshots[block.id])
  if (!failed) return { blockId: null, text: lastLine(message) || say('error.general') }
  if (isView(failed)) {
    const shown = datasetBlocks(workspace).find((d) => datasetNameOf(d) === String(failed.getFieldValue('DATASET') ?? ''))
    return { blockId: failed.id, text: unknownBox(shown, snapshots) ?? explainView(failed, message, snapshots, sourceOf(shown)) }
  }

  const dataset = datasetOf(failed)
  const name = dataset ? datasetNameOf(dataset) : ''
  const source = sourceOf(dataset)
  const before = stepBefore(failed)
  const data = before ? snapshots[before.id] : undefined
  const text =
    unknownBox(dataset, snapshots) ??
    explainStep(failed, message, name, data, source) ??
    explainKind(message, name, data, source) ??
    say('error.unknown', { problem: lastLine(message) })
  return { blockId: failed.id, text }
}

/** What we know about the step that failed: a file gone, offline, or data that isn't what the block takes. */
function explainStep(failed: Blockly.Block, message: string, name: string, data: Snapshot | undefined, source: Source): string | null {
  const translating = failed.type === READ_JSON || failed.type === TRANSLATE_CSV
  if (failed.type === LOAD_FILE && /FileNotFoundError/.test(message)) return say('error.fileMissing')
  // The stations table is for openSenseMap's answer only: for a file, the block that fits it.
  if (failed.type === OSEM_TABLE && source !== 'osem') return say('error.osem.notStations', { next: tableNext(source) })
  // The measurements are asked per sensor of a station: the rows they come from need both ids.
  // The missing column is in that dataset, not in the one the measurements go to.
  if (failed.type === OSEM_MEASUREMENTS && /KeyError: ['"](station_lastMeasurementAt|sensor_id|station_id)['"]/.test(message)) {
    const dataset = String(failed.getFieldValue('DATASET') ?? '')
    const source = datasetBlocks(failed.workspace).find((d) => datasetNameOf(d) === dataset)
    // No stations table at all (e.g. the list block instead), or one set to "Station".
    const hasTable = source ? stepsOf(source).some((step) => step.type === OSEM_TABLE) : false
    return say(hasTable ? 'error.osem.needsSensors' : 'block.osemMeasurements.needsTable', { dataset })
  }
  if (/NetworkError|Failed to fetch|XMLHttpRequest|HTTPError|OSError/.test(message)) return say('error.network')
  if (translating && data && data.art !== 'text') return say('error.notText', { name })
  if (failed.type === READ_JSON) return say('error.notJson', { name })
  if (failed.type === TRANSLATE_CSV) return say('error.notCsv', { name })
  // Translated JSON, but without "features" with shapes: a plain list, say. (Still text: explainKind says so.)
  if (failed.type === GEOJSON_TABLE && data?.art === 'json') return say('error.notGeojson', { name })
  if (failed.type === SPLIT_POSITION && /accessor|not subscriptable/.test(message)) return say('error.kind.noLists', { name })
  return null
}
