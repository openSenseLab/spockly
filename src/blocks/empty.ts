/**
 * Data that came out empty: an area without stations, a file without rows.
 * The Zwischenstand says so in words, and why if the block knows, rather than
 * "text (2 characters): []" or a table of 0 rows without a word.
 */
import type * as Blockly from 'blockly'

import type { Snapshot } from '../core/fromPython'
import { t } from '../i18n'
import { BY_AREA, OSEM_FETCH } from './osem'
import { datasetOf, stepsOf } from './program'

/** Whether nothing is in it: no rows, no entries, or text that is only an empty list or object. */
export function isEmpty(snapshot: Snapshot): boolean {
  if (snapshot.art === 'tabelle' || snapshot.art === 'json') return snapshot.anzahl === 0
  return ['', '[]', '{}'].includes(snapshot.text.trim())
}

/**
 * Why the block's data is empty, if known; else true (empty, reason unknown).
 * Empty after the openSenseMap block, the steps below it are empty for its reason.
 */
export function emptyReason(block: Blockly.Block): string | true {
  const dataset = datasetOf(block)
  const source = dataset ? (stepsOf(dataset)[0] ?? block) : block
  if (source.type !== OSEM_FETCH) return true
  if (source.getFieldValue('MODE') !== BY_AREA) return t('snapshot.empty.osemIds')
  return t(source.getFieldValue('OUTDOOR') === 'TRUE' ? 'hint.osem.noStationsOutdoor' : 'hint.osem.noStations')
}
