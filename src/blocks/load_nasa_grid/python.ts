import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import { LOAD_NASA_GRID } from './definition'
import { loadNasaGridToStep } from './generator'
import type { LoadNasaGridParams } from './mapping'
import { loadNasaGridOperation } from './operation'

/** What the data is called in code: value + area, e.g. t2m_karte_deutschland. */
export const nasaGridPythonBase = (block: Blockly.Block) =>
  `${String(block.getFieldValue('PARAMETER') ?? '')} karte ${String(block.getFieldValue('AREA') ?? '')}`

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_NASA_GRID] = (block) => {
  const params = loadNasaGridToStep(block).params as unknown as LoadNasaGridParams
  const output = pythonNameOf(block.id)
  return `${loadNasaGridOperation.toCode?.(params, { output }).python ?? ''}\n\n`
}
