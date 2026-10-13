import * as Blockly from 'blockly'

import { pick, t } from '../../i18n'
import { attachGear, fireStateChange, gearField, type SetupBlock } from '../setup'
import { DEFAULT_PARAMS, normalizeParams, sourceLabel, type LoadOsemParams } from './mapping'
import { PERIODS } from './presets'

export const LOAD_OSEM = 'load_osem'

Blockly.Msg.SPOCKLY_LOAD_OSEM_TITLE = t('block.loadOsem.title')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PHENOMENON = t('block.loadOsem.phenomenon')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PLACE = t('block.loadOsem.place')
Blockly.Msg.SPOCKLY_LOAD_OSEM_PERIOD = t('block.loadOsem.period')
Blockly.Msg.SPOCKLY_LOAD_OSEM_TOOLTIP = t('block.loadOsem.tooltip')

/** State the block keeps; saved with the workspace via saveExtraState. */
export type OsemBlock = SetupBlock & {
  osemParams: LoadOsemParams
}

type SavedState = LoadOsemParams & { configured?: boolean }

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
  block.setupConfigured = configured
  updateLabels(block)
  fireStateChange(block, before, JSON.stringify(saveState(block)))
}

const saveState = (block: OsemBlock): SavedState => ({
  ...block.osemParams,
  configured: block.setupConfigured,
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
      this.setupConfigured = state?.configured !== false
      updateLabels(this)
    },
  },
  function (this: OsemBlock) {
    this.osemParams = { ...DEFAULT_PARAMS }
    this.setupConfigured = false
    updateLabels(this)
    attachGear(this)
  },
)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_OSEM,
    message0: '%{BKY_SPOCKLY_LOAD_OSEM_TITLE}',
    args0: [gearField],
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
