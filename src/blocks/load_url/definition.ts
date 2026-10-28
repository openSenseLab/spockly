import * as Blockly from 'blockly'

import { formatText } from '../../core/tabular'
import { t } from '../../i18n'
import { attachGear, fireStateChange, gearField, type SetupBlock } from '../setup'
import { DEFAULT_URL_PARAMS, normalizeUrlParams, shortUrl, type LoadUrlParams } from './mapping'

export const LOAD_URL = 'load_url'

Blockly.Msg.SPOCKLY_LOAD_URL_TITLE = t('block.loadUrl.title')
Blockly.Msg.SPOCKLY_LOAD_URL_ADDRESS = t('block.loadUrl.address')
Blockly.Msg.SPOCKLY_LOAD_URL_FORMAT = t('block.loadUrl.format')
Blockly.Msg.SPOCKLY_LOAD_URL_TOOLTIP = t('block.loadUrl.tooltip')

/** State the block keeps; saved with the workspace via saveExtraState. */
export type UrlBlock = SetupBlock & { urlParams: LoadUrlParams }

type SavedState = LoadUrlParams & { configured?: boolean }

function updateLabels(block: UrlBlock) {
  const { url, read } = block.urlParams
  block.setFieldValue(shortUrl(url), 'ADDRESS')
  block.setFieldValue(read ? formatText(read) : t('url.format.unknown'), 'FORMAT')
}

const saveState = (block: UrlBlock): SavedState => ({ ...block.urlParams, configured: block.setupConfigured })

/** Applies new settings and records them as an undoable change. */
export function setUrlParams(block: UrlBlock, params: LoadUrlParams, configured = true) {
  const before = JSON.stringify(saveState(block))
  block.urlParams = normalizeUrlParams(params)
  block.setupConfigured = configured
  updateLabels(block)
  fireStateChange(block, before, JSON.stringify(saveState(block)))
}

const STATE_EXTENSION = 'load_url_state'

Blockly.Extensions.registerMutator(
  STATE_EXTENSION,
  {
    saveExtraState(this: UrlBlock): SavedState {
      return saveState(this)
    },
    loadExtraState(this: UrlBlock, state: SavedState) {
      this.urlParams = normalizeUrlParams(state)
      // Saved blocks were set up before; only a fresh block from the toolbox isn't.
      this.setupConfigured = state?.configured !== false
      updateLabels(this)
    },
  },
  function (this: UrlBlock) {
    this.urlParams = { ...DEFAULT_URL_PARAMS }
    this.setupConfigured = false
    updateLabels(this)
    attachGear(this)
  },
)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_URL,
    message0: '%{BKY_SPOCKLY_LOAD_URL_TITLE}',
    args0: [gearField],
    message1: '%{BKY_SPOCKLY_LOAD_URL_ADDRESS}',
    args1: [{ type: 'field_label', name: 'ADDRESS', text: '' }],
    message2: '%{BKY_SPOCKLY_LOAD_URL_FORMAT}',
    args2: [{ type: 'field_label', name: 'FORMAT', text: '' }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_URL_TOOLTIP}',
    mutator: STATE_EXTENSION,
  },
])
