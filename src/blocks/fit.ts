/**
 * Why two blocks don't snap together. Blockly refuses connections whose data
 * kinds don't fit (see DATA in program.ts), but says nothing; after a drop
 * next to such a block, this says why and which block fits instead.
 */
import * as Blockly from 'blockly'

import { t } from '../i18n'
import { LOAD_FILE } from './files'
import { OSEM_FETCH, OSEM_MEASUREMENTS } from './osem'
import { blockText, categoryNames, DATA, DATASET, type DataKind, isStep, kindOf, PROGRAM } from './program'
import { READ_JSON } from './steps'

/** What the connection gives below it (a step's "next", a dataset's inside), or "program" (under a dataset or a "zeige" block). */
function gives(connection: Blockly.Connection): (DataKind | 'program')[] {
  return (connection.getCheck() ?? []).map((check) => (check === PROGRAM ? 'program' : kindOf(check))).filter((k) => k !== null)
}

/** What a block takes from above. */
function takes(block: Blockly.Block): (DataKind | 'program')[] {
  return (block.previousConnection?.getCheck() ?? []).map((check) => (check === PROGRAM ? 'program' : kindOf(check))).filter((k) => k !== null)
}

/**
 * Why `lower` can't go under `upper` (a block's next connection, or a dataset's inside), in the
 * student's words; null if they would fit, or for blocks this doesn't know.
 */
export function whyNotFit(upper: Blockly.Connection, lower: Blockly.Block): string | null {
  const given = gives(upper)
  const taken = takes(lower)
  if (!given.length || !taken.length || taken.some((kind) => given.includes(kind))) return null
  const above = upper.getSourceBlock()
  const words = { block: blockText(lower), above: above.type === DATASET ? '' : blockText(above), ...categoryNames() }
  const is = (kind: DataKind | 'program') => given.includes(kind)
  if (taken.includes('program')) return t('fit.view', words)
  if (is('program')) return t('fit.outside', words)
  if (is('start')) return t('fit.first', words)
  // The measurements make a new dataset from another one's rows: say which, and how to start one.
  if (taken.includes('start') && lower.type === OSEM_MEASUREMENTS) {
    return t('fit.measurements', { ...words, rows: String(lower.getFieldValue('DATASET') ?? ''), dataset: t('toolbox.dataset') })
  }
  if (taken.includes('start')) return t('fit.source', words)
  if (is('text')) return t('fit.text', words)
  if (taken.includes('text')) return t('fit.translated', words)
  if (is('table')) return t('fit.table', words)
  // The stations table is for openSenseMap's stations only; GeoJSON's table isn't for them.
  if (taken.includes('stations')) return t('fit.notStations', words)
  if (is('stations') && taken.includes('json')) return t('fit.stationsNotGeojson', words)
  if (is('list')) return t('fit.csvList', words)
  return t('fit.notTable', words)
}

/** Where a chain's data comes from: its first step, above `block`. */
function firstStep(block: Blockly.Block): Blockly.Block {
  let first = block
  for (let up = first.getPreviousBlock(); up && isStep(up); up = up.getPreviousBlock()) first = up
  return first
}

/**
 * What "übersetze den JSON-Text" leaves below it, by where the text came from:
 * openSenseMap's answer is stations (for the stations table), a file plain
 * JSON (for the list and GeoJSON tables). Without a source above, both, so a
 * loose block can still be put together. A block below that doesn't fit any
 * more is pushed aside by Blockly; call after every change.
 */
export function narrowKinds(workspace: Blockly.Workspace) {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== READ_JSON || !block.nextConnection) continue
    const source = firstStep(block).type
    const kinds =
      source === OSEM_FETCH ? [DATA.stations] : source === LOAD_FILE ? [DATA.json] : [DATA.json, DATA.stations]
    const now = block.nextConnection.getCheck() ?? []
    if (now.length !== kinds.length || kinds.some((kind) => !now.includes(kind))) block.nextConnection.setCheck(kinds)
  }
}

/**
 * How near a drop counts as "meant to go there": more than Blockly's snapping
 * distance, which is only a few pixels – a block dropped roughly in place
 * should get the reason too.
 */
const NEAR = () => Math.max(Blockly.config.snapRadius * 2.5, 60)

/** A place near a drop where the dropped blocks could have gone. */
export interface DropSpot {
  /** How far from the dropped blocks. */
  distance: number
  /** Nothing is there yet (the end of a chain, an empty dataset); else the blocks would go in between. */
  free: boolean
  /** Of the dropped blocks' own kind: a step's place in a dataset for a step, a place under a dataset for a "zeige" block. */
  own: boolean
  /** Why they don't fit there, or null if they do. */
  reason: string | null
}

/**
 * Which spot the student meant, and why the blocks don't fit there. Spots of
 * the blocks' own kind come first (a step is meant for a dataset's steps, not
 * for below the dataset), then free ones: students build from top to bottom,
 * so a drop near a chain means "at its end" rather than "in between". Then the
 * nearest. Null if the meant spot fits (dropped too far away to snap) or there
 * is no spot.
 */
export function reasonForDrop(spots: DropSpot[]): string | null {
  const nearest = (list: DropSpot[]) => list.reduce<DropSpot | null>((best, s) => (!best || s.distance < best.distance ? s : best), null)
  const own = spots.some((s) => s.own) ? spots.filter((s) => s.own) : spots
  const meant = nearest(own.filter((s) => s.free)) ?? nearest(own)
  return meant?.reason ?? null
}

/** The free connection at the end of the chain that starts with `block`. */
function endOf(block: Blockly.Block): Blockly.Connection | null {
  let end = block
  while (end.getNextBlock()) end = end.getNextBlock()!
  return end.nextConnection
}

/**
 * After a drop: the reason the dropped blocks didn't snap to a block next to
 * them, or null. Looks at the free connections at the top and the bottom of
 * the dropped stack, near where they were dropped.
 */
export function misfitAfterDrop(block: Blockly.BlockSvg): string | null {
  const workspace = block.workspace
  const stack = new Set(block.getDescendants(false).map((b) => b.id))
  let tail: Blockly.BlockSvg = block
  while (tail.getNextBlock()) tail = tail.getNextBlock()!
  const top = block.previousConnection?.isConnected() ? null : block.previousConnection
  const bottom = tail.nextConnection?.isConnected() ? null : tail.nextConnection
  const step = isStep(block)
  /** Whether a spot under `upper` is of the dropped blocks' own kind. */
  const own = (upper: Blockly.Connection) => !gives(upper).includes('program') === step
  const spots: DropSpot[] = []
  for (const connection of [top, bottom]) {
    if (!connection) continue
    const db = workspace.connectionDBList[Blockly.OPPOSITE_TYPE[connection.type]]
    for (const other of db.getNeighbours(connection, NEAR())) {
      if (stack.has(other.getSourceBlock().id)) continue
      const distance = connection.distanceFrom(other)
      if (connection === top) {
        const occupant = other.targetBlock()
        // Dropped onto a chain: most likely meant for its end, if that's near too.
        const end = occupant ? endOf(occupant) : null
        if (end && connection.distanceFrom(end as Blockly.RenderedConnection) < 2 * NEAR()) {
          spots.push({ distance, free: true, own: own(end), reason: whyNotFit(end, block) })
        }
        // In between: the dropped blocks must fit under `other`, and what is there already under them.
        const reason = whyNotFit(other, block) ?? (occupant && bottom ? whyNotFit(bottom, occupant) : null)
        spots.push({ distance, free: !occupant, own: own(other), reason })
      } else {
        const above = other.targetConnection
        // Dropped just above a block in a chain: also most likely meant for the chain's end.
        const end = above ? endOf(other.getSourceBlock()) : null
        if (end && connection.distanceFrom(end as Blockly.RenderedConnection) < 2 * NEAR()) {
          spots.push({ distance, free: true, own: own(end), reason: top ? whyNotFit(end, block) : null })
        }
        // Above `other`: it must fit under the dropped blocks, and they under whatever is above it.
        const reason = whyNotFit(connection, other.getSourceBlock()) ?? (above && top ? whyNotFit(above, block) : null)
        spots.push({ distance, free: !above, own: own(connection), reason })
      }
    }
  }
  return reasonForDrop(spots)
}
