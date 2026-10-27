import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import { LOAD_OSM } from './definition'
import { loadOsmToStep } from './generator'
import type { LoadOsmParams } from './mapping'
import { loadOsmOperation } from './operation'
import { osmTopic } from './presets'

/** What the data is called in code: topic + area, e.g. radwege_muenster_mitte. */
export const osmPythonBase = (block: Blockly.Block) =>
  `${osmTopic(String(block.getFieldValue('TOPIC') ?? ''))?.pythonName ?? 'osm'} ${String(block.getFieldValue('AREA') ?? '')}`

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_OSM] = (block) => {
  const params = loadOsmToStep(block).params as unknown as LoadOsmParams
  const output = pythonNameOf(block.id)
  return `${loadOsmOperation.toCode?.(params, { output }).python ?? ''}\n\n`
}
