/**
 * Which blocks the last run covered. A block's result is current if the run
 * reached it (it has a Zwischenstand) and nothing it depends on has changed
 * since: not the block, not a step above it, not a dataset it names, not a
 * file it opens. The others are marked on the canvas as not run yet: new
 * blocks, changed ones, and those after the block where a run failed.
 */
import * as Blockly from 'blockly'

import type { Snapshot } from '../core/fromPython'
import { t } from '../i18n'
import { LOAD_FILE } from './files'
import { DATASET, datasetNameOf, datasetOf, lastStepOf, stepBefore } from './program'

/** What a run covered: each block's signature at the time it ran. */
export type RanSignatures = Record<string, string>

/** The class of a block the last run didn't cover; App.css draws it dashed and faded. */
export const NOT_RUN_CLASS = 'spockly-not-run'

/** A block's own settings: its type and the values of its fields (not labels like a station's status). */
function ownSettings(block: Blockly.Block): string {
  const fields = block.inputList
    .flatMap((input) => input.fieldRow)
    .filter((field) => field.name && field.isSerializable())
    .map((field) => `${field.name}=${String(field.getValue())}`)
  return `${block.type}(${fields.join(';')})`
}

/**
 * Everything a block's result depends on, as one text: the steps above it in
 * its dataset, its own settings, and the datasets it names (the measurements
 * block, the "zeige …" blocks). Equal texts mean an equal result.
 */
export function signatureOf(block: Blockly.Block, filesVersion: number, seen = new Set<string>()): string {
  // A dataset that names itself, say: no endless loop.
  if (seen.has(block.id)) return '…'
  seen.add(block.id)
  let own = ownSettings(block)
  // A file picked again under the same name is new data.
  if (block.type === LOAD_FILE) own += `@${filesVersion}`
  const named = block.getFieldValue('DATASET')
  if (typeof named === 'string' && named) {
    const last = lastStepOf(block.workspace, named)
    own += `<${last ? signatureOf(last, filesVersion, seen) : `[${named}]`}>`
  }
  const before = stepBefore(block)
  const dataset = datasetOf(block)
  const above = before ? signatureOf(before, filesVersion, seen) : dataset ? `[${datasetNameOf(dataset)}]` : ''
  return `${above}|${own}`
}

/** The signatures of all blocks now, to keep when a run starts. */
export function signatures(workspace: Blockly.Workspace, filesVersion: number): RanSignatures {
  return Object.fromEntries(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type !== DATASET)
      .map((block) => [block.id, signatureOf(block, filesVersion)]),
  )
}

/** Whether the last run's result for this block is still what the blocks say now. */
export function ranAsItIs(block: Blockly.Block, ran: RanSignatures, snapshots: Record<string, Snapshot>, filesVersion: number): boolean {
  return Boolean(snapshots[block.id]) && ran[block.id] === signatureOf(block, filesVersion)
}

/**
 * Marks the blocks the last run didn't cover. Before the first run nothing is
 * marked: then nothing has run, and the results say to click "Ausführen".
 */
export function markRunState(
  workspace: Blockly.WorkspaceSvg,
  ran: RanSignatures | null,
  snapshots: Record<string, Snapshot>,
  filesVersion: number,
) {
  for (const block of workspace.getAllBlocks(false) as Blockly.BlockSvg[]) {
    const notRun = ran !== null && block.type !== DATASET && !ranAsItIs(block, ran, snapshots, filesVersion)
    if (notRun) block.addClass(NOT_RUN_CLASS)
    else block.removeClass(NOT_RUN_CLASS)
  }
}

/** The class of the block a run failed at; App.css draws it red. */
export const FAILED_CLASS = 'spockly-failed'

/** The warning id of a run's error, apart from the blocks' own warnings. */
export const FAILED_WARNING = 'run'

/** The block's own tooltip, while hovering shows the error instead. */
const ownTooltips = new WeakMap<Blockly.Block, Blockly.Tooltip.TipInfo>()

/**
 * Whether a block is still as it was when the last run started, whether the
 * run reached it or not. Once the block a run failed at changes (or a step
 * above it), the error may be gone: it is then only "not run yet", like the
 * blocks after it.
 */
export function unchangedSinceRun(block: Blockly.Block, ran: RanSignatures | null, filesVersion: number): boolean {
  return ran !== null && ran[block.id] === signatureOf(block, filesVersion)
}

/**
 * Shows a run's error on the block it failed at: drawn red, the explanation in
 * its warning (click the warning sign) and on hovering over the block, in
 * place of what the block does. Returns the block newly marked, or null.
 */
export function markFailure(
  workspace: Blockly.WorkspaceSvg,
  failure: { blockId: string; text: string } | null,
  ran: RanSignatures | null,
  filesVersion: number,
): Blockly.BlockSvg | null {
  let marked: Blockly.BlockSvg | null = null
  for (const block of workspace.getAllBlocks(false) as Blockly.BlockSvg[]) {
    const failed = failure?.blockId === block.id && unchangedSinceRun(block, ran, filesVersion)
    if (failed) {
      if (!block.getSvgRoot().classList.contains(FAILED_CLASS)) marked = block
      block.addClass(FAILED_CLASS)
      block.setWarningText(failure.text, FAILED_WARNING)
      if (!ownTooltips.has(block)) ownTooltips.set(block, block.tooltip)
      block.setTooltip(`${t('error.onBlock')}\n${failure.text}`)
    } else {
      block.removeClass(FAILED_CLASS)
      block.setWarningText(null, FAILED_WARNING)
      const own = ownTooltips.get(block)
      if (own !== undefined) {
        block.setTooltip(own)
        ownTooltips.delete(block)
      }
    }
  }
  return marked
}
