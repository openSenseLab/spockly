import * as Blockly from 'blockly'

import { pick, t } from '../../i18n'
import { VARIABLES } from '../load_nasa_power/presets'
import { FIRST_YEAR, lastCompleteYear } from './mapping'
import { today } from './operation'
import { AREA_PRESETS } from './presets'

export const LOAD_NASA_GRID = 'load_nasa_grid'

Blockly.Msg.SPOCKLY_LOAD_NASA_GRID_TITLE = t('block.loadNasaGrid.title')
Blockly.Msg.SPOCKLY_LOAD_NASA_GRID_AREA = t('block.loadNasaGrid.area')
Blockly.Msg.SPOCKLY_LOAD_NASA_GRID_VALUE = t('block.loadNasaGrid.value')
Blockly.Msg.SPOCKLY_LOAD_NASA_GRID_YEAR = t('block.loadNasaGrid.year')
Blockly.Msg.SPOCKLY_LOAD_NASA_GRID_TOOLTIP = t('block.loadNasaGrid.tooltip')

const areaOptions = AREA_PRESETS.map((a) => [pick(a.label) ?? a.id, a.id])
const valueOptions = VARIABLES.map((v) => [pick(v.label) ?? v.code, v.code])
/** Completed years, newest first. */
const yearOptions = Array.from({ length: lastCompleteYear(today()) - FIRST_YEAR + 1 }, (_, i) => {
  const year = String(lastCompleteYear(today()) - i)
  return [year, year]
})

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_NASA_GRID,
    message0: '%{BKY_SPOCKLY_LOAD_NASA_GRID_TITLE}',
    message1: '%{BKY_SPOCKLY_LOAD_NASA_GRID_AREA} %1',
    args1: [{ type: 'field_dropdown', name: 'AREA', options: areaOptions }],
    message2: '%{BKY_SPOCKLY_LOAD_NASA_GRID_VALUE} %1',
    args2: [{ type: 'field_dropdown', name: 'PARAMETER', options: valueOptions }],
    message3: '%{BKY_SPOCKLY_LOAD_NASA_GRID_YEAR} %1',
    args3: [{ type: 'field_dropdown', name: 'YEAR', options: yearOptions }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_NASA_GRID_TOOLTIP}',
  },
])
