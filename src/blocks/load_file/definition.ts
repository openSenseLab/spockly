import * as Blockly from 'blockly'

import { formatText } from '../../core/tabular'
import { t } from '../../i18n'
import { attachGear, fireStateChange, gearField, type SetupBlock } from '../setup'
import { NO_FILE, normalizeFileParams, type LoadFileParams } from './mapping'

export const LOAD_FILE = 'load_file'

Blockly.Msg.SPOCKLY_LOAD_FILE_TITLE = t('block.loadFile.title')
Blockly.Msg.SPOCKLY_LOAD_FILE_NAME = t('block.loadFile.name')
Blockly.Msg.SPOCKLY_LOAD_FILE_FORMAT = t('block.loadFile.format')
Blockly.Msg.SPOCKLY_LOAD_FILE_TOOLTIP = t('block.loadFile.tooltip')

/** State the block keeps; saved with the workspace via saveExtraState (the file's name, not its content). */
export type FileBlock = SetupBlock & { fileParams: LoadFileParams }

type SavedState = LoadFileParams & { configured?: boolean }

/** Long names are cut, so the block stays narrow. */
const shortName = (name: string, max = 34) => (name.length <= max ? name : `${name.slice(0, max - 1)}…`)

function updateLabels(block: FileBlock) {
  const { name, read } = block.fileParams
  block.setFieldValue(name ? shortName(name) : t('file.none'), 'NAME')
  block.setFieldValue(read ? formatText(read) : '–', 'FORMAT')
}

const saveState = (block: FileBlock): SavedState => ({ ...block.fileParams, configured: block.setupConfigured })

/** Applies new settings and records them as an undoable change. */
export function setFileParams(block: FileBlock, params: LoadFileParams, configured = true) {
  const before = JSON.stringify(saveState(block))
  block.fileParams = normalizeFileParams(params)
  block.setupConfigured = configured
  updateLabels(block)
  fireStateChange(block, before, JSON.stringify(saveState(block)))
}

const STATE_EXTENSION = 'load_file_state'

Blockly.Extensions.registerMutator(
  STATE_EXTENSION,
  {
    saveExtraState(this: FileBlock): SavedState {
      return saveState(this)
    },
    loadExtraState(this: FileBlock, state: SavedState) {
      this.fileParams = normalizeFileParams(state)
      // Saved blocks were set up before; only a fresh block from the toolbox isn't.
      this.setupConfigured = state?.configured !== false
      updateLabels(this)
    },
  },
  function (this: FileBlock) {
    this.fileParams = { ...NO_FILE }
    this.setupConfigured = false
    updateLabels(this)
    attachGear(this)
  },
)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_FILE,
    message0: '%{BKY_SPOCKLY_LOAD_FILE_TITLE}',
    args0: [gearField],
    message1: '%{BKY_SPOCKLY_LOAD_FILE_NAME}',
    args1: [{ type: 'field_label', name: 'NAME', text: '' }],
    message2: '%{BKY_SPOCKLY_LOAD_FILE_FORMAT}',
    args2: [{ type: 'field_label', name: 'FORMAT', text: '' }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_FILE_TOOLTIP}',
    mutator: STATE_EXTENSION,
  },
])
