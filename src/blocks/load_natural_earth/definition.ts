import * as Blockly from 'blockly'

import { pick, t } from '../../i18n'
import { NE_DATASETS } from './presets'

export const LOAD_NATURAL_EARTH = 'load_natural_earth'

Blockly.Msg.SPOCKLY_LOAD_NE_TITLE = t('block.loadNe.title')
Blockly.Msg.SPOCKLY_LOAD_NE_TOOLTIP = t('block.loadNe.tooltip')

const datasetOptions = NE_DATASETS.map((d) => [pick(d.label) ?? d.id, d.id])

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_NATURAL_EARTH,
    message0: '%{BKY_SPOCKLY_LOAD_NE_TITLE}',
    message1: '%1',
    args1: [{ type: 'field_dropdown', name: 'DATASET', options: datasetOptions }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_NE_TOOLTIP}',
  },
])
