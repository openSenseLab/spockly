import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import type { NasaBlock } from './definition'
import { LOAD_NASA_POWER } from './definition'
import { loadNasaPowerOperation } from './operation'

/** What the data is called in code: "wetter" + place, e.g. wetter_muenster. */
export function nasaPythonBase(block: Blockly.Block) {
  const { place } = (block as NasaBlock).nasaParams
  return place.kind === 'preset' ? `wetter ${place.id}` : `wetter ${place.lat} ${place.lon}`
}

/** Keeps the existing Python preview working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_NASA_POWER] = (block) => {
  const output = pythonNameOf(block.id)
  return `${loadNasaPowerOperation.toCode?.((block as NasaBlock).nasaParams, { output }).python ?? ''}\n\n`
}
