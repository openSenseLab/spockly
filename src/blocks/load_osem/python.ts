import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import type { OsemBlock } from './definition'
import { LOAD_OSEM } from './definition'
import { loadOsemOperation } from './operation'

/** What the data is called in code: measurement + place, e.g. temperatur_muenster_mitte. */
export function osemPythonBase(block: Blockly.Block) {
  const { phenomenon, source } = (block as OsemBlock).osemParams
  return `${phenomenon} ${source.kind === 'area' ? source.area : source.tag}`
}

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_OSEM] = (block) => {
  const output = pythonNameOf(block.id)
  return `${loadOsemOperation.toCode?.((block as OsemBlock).osemParams, { output }).python ?? ''}\n\n`
}
