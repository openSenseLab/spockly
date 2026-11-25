/**
 * Advice after a run that went through, but not as students meant: no error,
 * yet a result that hides a mistake. "mache eine Tabelle aus der Liste" on
 * GeoJSON makes a table of one row, as GeoJSON is one object with its list
 * "features" inside; on a single openSenseMap station, too. On openSenseMap's
 * list of stations it works, but "mache eine Tabelle aus den Stationen" fits:
 * the measurements need it. The advice says why and which block fits, with
 * where to find it.
 */
import type * as Blockly from 'blockly'

import type { Snapshot } from '../core/fromPython'
import { say, sourceOf } from './errors'
import { datasetNameOf, datasetOf, stepBefore } from './program'
import { JSON_TABLE } from './steps'

export interface Advice {
  blockId: string
  text: string
}

/** Advice for one block after the last run, or null: only for blocks that ran. */
export function adviceFor(block: Blockly.Block, snapshots: Record<string, Snapshot>): string | null {
  if (block.type !== JSON_TABLE || !snapshots[block.id]) return null
  const before = stepBefore(block)
  const data = before ? snapshots[before.id] : undefined
  if (data?.art !== 'json') return null
  const dataset = datasetOf(block)
  const name = dataset ? datasetNameOf(dataset) : ''
  // A list starts with "[": then each entry is a row, as meant. One object starts with "{", unless a list
  // inside it became the rows (liste_in, e.g. {"count": …, "results": [...]}): then the table has more than one.
  const table = snapshots[block.id]
  const one = data.text.trimStart().startsWith('{') && !(table.art === 'tabelle' && table.anzahl > 1)
  // openSenseMap's stations have a block of their own, which "hole … die Messwerte" needs: a list of them works here, but say so.
  if (sourceOf(dataset) === 'osem') return say(one ? 'advice.osemOne' : 'advice.osemList', { name })
  if (!one) return null
  if (/"type":\s*"(FeatureCollection|Feature)"|"features":/.test(data.text)) return say('advice.geojson', { name })
  return say('advice.notList', { name })
}

/** All advice after the last run, in the order of the blocks on the canvas. */
export function allAdvice(workspace: Blockly.Workspace, snapshots: Record<string, Snapshot>): Advice[] {
  return workspace.getAllBlocks(true).flatMap((block) => {
    const text = adviceFor(block, snapshots)
    return text ? [{ blockId: block.id, text }] : []
  })
}
