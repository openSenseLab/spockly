/**
 * Shared parts of blocks that are configured in a setup window (API loaders):
 * the gear button, opening the window once after the first drop, and
 * recording a settings change as an undoable Blockly event.
 */
import * as Blockly from 'blockly'

export const GEAR_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
      '</svg>',
  )

/** JSON for the gear field; put it in the block's first line. */
export const gearField = { type: 'field_image', name: 'SETUP', src: GEAR_ICON, width: 22, height: 22, alt: '⚙' }

export type SetupBlock = Blockly.Block & {
  /** False until the setup window has been shown once (it opens on first drop). */
  setupConfigured: boolean
}

// ---- Opening the window (the app registers the handler) ----

let openSetup: ((blockId: string) => void) | null = null

export function setBlockSetupOpener(handler: ((blockId: string) => void) | null) {
  openSetup = handler
}

export function requestBlockSetup(blockId: string) {
  openSetup?.(blockId)
}

/** Call from the block's init: the gear opens the setup window (not in the toolbox). */
export function attachGear(block: Blockly.Block) {
  const gear = block.getField('SETUP') as Blockly.FieldImage | null
  gear?.setOnClickHandler((field) => {
    const source = field.getSourceBlock()
    if (source && !source.isInFlyout) requestBlockSetup(source.id)
  })
}

/** A fresh block from the toolbox whose setup window hasn't been shown yet. */
export const needsSetup = (block: Blockly.Block | null): block is SetupBlock =>
  !!block && 'setupConfigured' in block && !(block as SetupBlock).setupConfigured

/** The setup window was shown (applied or not): don't open it again by itself. */
export function markSetupShown(block: SetupBlock) {
  block.setupConfigured = true
}

/** Records a change of the block's saved state, so it can be undone and triggers a recompile. */
export function fireStateChange(block: Blockly.Block, before: string, after: string) {
  if (before === after) return
  const BlockChange = Blockly.Events.get(Blockly.Events.BLOCK_CHANGE)
  Blockly.Events.fire(new BlockChange(block, 'mutation', null, before, after))
}
