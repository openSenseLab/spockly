import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import { LOAD_NATURAL_EARTH } from './definition'
import { loadNaturalEarthToStep } from './generator'
import { loadNaturalEarthOperation, type LoadNaturalEarthParams } from './operation'
import { neDataset } from './presets'

/** What the data is called in code, e.g. laender_der_welt. */
export const naturalEarthPythonBase = (block: Blockly.Block) =>
  neDataset(String(block.getFieldValue('DATASET') ?? ''))?.pythonName ?? 'natural_earth'

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_NATURAL_EARTH] = (block) => {
  const params = loadNaturalEarthToStep(block).params as unknown as LoadNaturalEarthParams
  const output = pythonNameOf(block.id)
  return `${loadNaturalEarthOperation.toCode?.(params, { output }).python ?? ''}\n\n`
}
