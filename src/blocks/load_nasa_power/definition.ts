import * as Blockly from 'blockly'

import { formatDate, pick, t } from '../../i18n'
import { attachGear, fireStateChange, gearField, type SetupBlock } from '../setup'
import { DEFAULT_PARAMS, normalizeParams, placeLabel, type LoadNasaParams } from './mapping'
import { variable } from './presets'

export const LOAD_NASA_POWER = 'load_nasa_power'

Blockly.Msg.SPOCKLY_LOAD_NASA_TITLE = t('block.loadNasa.title')
Blockly.Msg.SPOCKLY_LOAD_NASA_PLACE = t('block.loadNasa.place')
Blockly.Msg.SPOCKLY_LOAD_NASA_VALUES = t('block.loadNasa.values')
Blockly.Msg.SPOCKLY_LOAD_NASA_PERIOD = t('block.loadNasa.period')
Blockly.Msg.SPOCKLY_LOAD_NASA_TOOLTIP = t('block.loadNasa.tooltip')

/** State the block keeps; saved with the workspace via saveExtraState. */
export type NasaBlock = SetupBlock & { nasaParams: LoadNasaParams }

type SavedState = LoadNasaParams & { configured?: boolean }

/** Up to two names, otherwise "Temperatur + 2 weitere", so the block stays narrow. */
function valuesText(codes: string[]) {
  const names = codes.map((code) => pick(variable(code)?.label) ?? code)
  return names.length <= 2 ? names.join(', ') : t('block.loadNasa.moreValues', { first: names[0], count: names.length - 1 })
}

function updateLabels(block: NasaBlock) {
  const { place, variables, resolution, from, to } = block.nasaParams
  const range = resolution === 'daily' ? `${formatDate(from)} – ${formatDate(to)}` : `${from} – ${to}`
  block.setFieldValue(pick(placeLabel(place)) ?? '', 'PLACE')
  block.setFieldValue(variables.length ? valuesText(variables) : '–', 'VALUES')
  block.setFieldValue(`${range} · ${t(resolution === 'daily' ? 'nasa.daily' : 'nasa.monthly')}`, 'PERIOD')
}

const saveState = (block: NasaBlock): SavedState => ({ ...block.nasaParams, configured: block.setupConfigured })

/** Applies new settings and records them as an undoable change. */
export function setNasaParams(block: NasaBlock, params: LoadNasaParams, configured = true) {
  const before = JSON.stringify(saveState(block))
  block.nasaParams = normalizeParams(params)
  block.setupConfigured = configured
  updateLabels(block)
  fireStateChange(block, before, JSON.stringify(saveState(block)))
}

const STATE_EXTENSION = 'load_nasa_power_state'

Blockly.Extensions.registerMutator(
  STATE_EXTENSION,
  {
    saveExtraState(this: NasaBlock): SavedState {
      return saveState(this)
    },
    loadExtraState(this: NasaBlock, state: SavedState) {
      this.nasaParams = normalizeParams(state)
      // Saved blocks were set up before; only a fresh block from the toolbox isn't.
      this.setupConfigured = state?.configured !== false
      updateLabels(this)
    },
  },
  function (this: NasaBlock) {
    this.nasaParams = { ...DEFAULT_PARAMS, variables: [...DEFAULT_PARAMS.variables] }
    this.setupConfigured = false
    updateLabels(this)
    attachGear(this)
  },
)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_NASA_POWER,
    message0: '%{BKY_SPOCKLY_LOAD_NASA_TITLE}',
    args0: [gearField],
    message1: '%{BKY_SPOCKLY_LOAD_NASA_PLACE}',
    args1: [{ type: 'field_label', name: 'PLACE', text: '' }],
    message2: '%{BKY_SPOCKLY_LOAD_NASA_VALUES}',
    args2: [{ type: 'field_label', name: 'VALUES', text: '' }],
    message3: '%{BKY_SPOCKLY_LOAD_NASA_PERIOD}',
    args3: [{ type: 'field_label', name: 'PERIOD', text: '' }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_NASA_TOOLTIP}',
    mutator: STATE_EXTENSION,
  },
])
