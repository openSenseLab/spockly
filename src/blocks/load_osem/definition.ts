import * as Blockly from 'blockly'

import { pick, t } from '../../i18n'
import { DEFAULT_PARAMS, normalizeParams, sourceLabel, type LoadOsemParams } from './mapping'
import { PERIODS } from './presets'

export const LOAD_OSEM = 'load_osem'

Blockly.Msg.SPOCKLY_LOAD_OSEM_TITLE = t('block.loadOsem.title')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PHENOMENON = t('block.loadOsem.phenomenon')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PLACE = t('block.loadOsem.place')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PERIOD = t('block.loadOsem.period')
Blockly.Msg.SPOCKLY_LOAD_OSEM_TOOLTIP = t('block.loadOsem.tooltip')

const GEAR_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
      '</svg>',
  )

/** State the block keeps; saved with the workspace via saveExtraState. */
export type OsemBlock = Blockly.Block & {
  osemParams: LoadOsemParams
  /** False until the setup window has been shown once (it opens on first drop). */
  osemConfigured: boolean
}

type SavedState = LoadOsemParams & { configured?: boolean }

// ---- Opening the setup window (the app registers the handler) ----

let openSetup: ((blockId: string) => void) | null = null
export function setOsemSetupOpener(handler: ((blockId: string) => void) | null) {
  openSetup = handler
}
export function requestOsemSetup(blockId: string) {
  openSetup?.(blockId)
}

// ---- Labels ----

function updateLabels(block: OsemBlock) {
  const { phenomenon, source, period, outdoorOnly } = block.osemParams
  const when = pick(PERIODS[period].label) ?? period
  block.setFieldValue(phenomenon, 'PHENOMENON')
  block.setFieldValue(pick(sourceLabel(source)) ?? '', 'PLACE')
  block.setFieldValue(outdoorOnly ? `${when} · ${t('block.loadOsem.outdoorShort')}` : when, 'PERIOD')
}

/** Applies new settings and records them as an undoable change. */
export function setOsemParams(block: OsemBlock, params: LoadOsemParams, configured = true) {
  const before = JSON.stringify(saveState(block))
  block.osemParams = normalizeParams(params)
  block.osemConfigured = configured
  updateLabels(block)
  const after = JSON.stringify(saveState(block))
  if (before !== after) {
    const BlockChange = Blockly.Events.get(Blockly.Events.BLOCK_CHANGE)
    Blockly.Events.fire(new BlockChange(block, 'mutation', null, before, after))
  }
}

/** A fresh block from the toolbox whose setup window hasn't been shown yet. */
export const needsOsemSetup = (block: Blockly.Block | null): block is OsemBlock =>
  block?.type === LOAD_OSEM && !(block as OsemBlock).osemConfigured

/** The setup window was shown (applied or not): don't open it again by itself. */
export function markOsemConfigured(block: OsemBlock) {
  block.osemConfigured = true
}

const saveState = (block: OsemBlock): SavedState => ({
  ...block.osemParams,
  configured: block.osemConfigured,
})

// ---- Block definition ----

const STATE_EXTENSION = 'load_osem_state'

Blockly.Extensions.registerMutator(
  STATE_EXTENSION,
  {
    saveExtraState(this: OsemBlock): SavedState {
      return saveState(this)
    },
    loadExtraState(this: OsemBlock, state: SavedState) {
      this.osemParams = normalizeParams(state)
      // Saved blocks were set up before; only a fresh block from the toolbox isn't.
      this.osemConfigured = state?.configured !== false
      updateLabels(this)
    },
  },
  function (this: OsemBlock) {
    this.osemParams = { ...DEFAULT_PARAMS }
    this.osemConfigured = false
    updateLabels(this)
    const gear = this.getField('SETUP') as Blockly.FieldImage | null
    gear?.setOnClickHandler((field) => {
      const block = field.getSourceBlock()
      if (block && !block.isInFlyout) requestOsemSetup(block.id)
    })
  },
)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_OSEM,
    message0: '%{BKY_SPOCKLY_LOAD_OSEM_TITLE}',
    args0: [{ type: 'field_image', name: 'SETUP', src: GEAR_ICON, width: 22, height: 22, alt: '⚙' }],
    message1: '%{BKY_SPOCKLY_LOAD_OSEM_PHENOMENON}',
    args1: [{ type: 'field_label', name: 'PHENOMENON', text: '' }],
    message2: '%{BKY_SPOCKLY_LOAD_OSEM_PLACE}',
    args2: [{ type: 'field_label', name: 'PLACE', text: '' }],
    message3: '%{BKY_SPOCKLY_LOAD_OSEM_PERIOD}',
    args3: [{ type: 'field_label', name: 'PERIOD', text: '' }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_OSEM_TOOLTIP}',
    mutator: STATE_EXTENSION,
  },
])
