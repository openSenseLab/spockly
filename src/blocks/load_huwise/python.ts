import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import { LOAD_HUWISE } from './definition'
import { loadHuwiseOperation, type LoadHuwiseParams } from './operation'
import { loadHuwiseToStep } from './generator'

/** What the data is called in code: the dataset id, e.g. georef_germany_land. */
export const huwisePythonBase = (block: Blockly.Block) => String(block.getFieldValue('DATASET') ?? '')

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_HUWISE] = (block) => {
  const params = loadHuwiseToStep(block).params as unknown as LoadHuwiseParams
  const output = pythonNameOf(block.id)
  return `${loadHuwiseOperation.toCode?.(params, { output }).python ?? ''}\n\n`
}
