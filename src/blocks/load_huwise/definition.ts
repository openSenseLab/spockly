import * as Blockly from 'blockly'

import { formatNumber, t } from '../../i18n'
import { parseDatasetLink } from './mapping'
import { MAX_ROWS } from './operation'

export const LOAD_HUWISE = 'load_huwise'

Blockly.Msg.SPOCKLY_LOAD_HUWISE_DATASET = t('block.loadHuwise.dataset')
Blockly.Msg.SPOCKLY_LOAD_HUWISE_PORTAL = t('block.loadHuwise.portal')
Blockly.Msg.SPOCKLY_LOAD_HUWISE_ROWS = t('block.loadHuwise.rows')
Blockly.Msg.SPOCKLY_LOAD_HUWISE_TOOLTIP = t('block.loadHuwise.tooltip')

const rowOptions = [100, 1000, MAX_ROWS].map((n) => [formatNumber(n), String(n)])

const PASTE_LINK_EXTENSION = 'load_huwise_paste_link'

/** Pasting a dataset page link into either text field fills in both fields. */
Blockly.Extensions.register(PASTE_LINK_EXTENSION, function (this: Blockly.Block) {
  const pasteInto = (own: 'DATASET' | 'DOMAIN', other: 'DATASET' | 'DOMAIN') => (text: string) => {
    const link = parseDatasetLink(text)
    if (!link) return text.trim()
    const parts = { DATASET: link.datasetId, DOMAIN: link.domain }
    this.setFieldValue(parts[other], other)
    return parts[own]
  }
  this.getField('DATASET')?.setValidator(pasteInto('DATASET', 'DOMAIN'))
  this.getField('DOMAIN')?.setValidator(pasteInto('DOMAIN', 'DATASET'))
})

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_HUWISE,
    // One row per setting keeps the block narrow and the fields easy to tap.
    message0: '%{BKY_SPOCKLY_LOAD_HUWISE_DATASET}',
    args0: [{ type: 'field_input', name: 'DATASET', text: 'georef-germany-land', spellcheck: false }],
    message1: '%{BKY_SPOCKLY_LOAD_HUWISE_PORTAL}',
    args1: [{ type: 'field_input', name: 'DOMAIN', text: 'hub.huwise.com', spellcheck: false }],
    message2: '%{BKY_SPOCKLY_LOAD_HUWISE_ROWS}',
    args2: [{ type: 'field_dropdown', name: 'MAX_ROWS', options: rowOptions }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_HUWISE_TOOLTIP}',
    extensions: [PASTE_LINK_EXTENSION],
  },
])
