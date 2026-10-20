import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import type { OsemBlock } from './definition'
import { LOAD_OSEM } from './definition'
import { loadOsemOperation } from './operation'

/** What the data is called in code: measurement + place, e.g. temperatur_muenster_mitte; "messwerte" for several. */
export function osemPythonBase(block: Blockly.Block) {
  const { phenomena, source } = (block as OsemBlock).osemParams
  const what = phenomena.length === 1 ? phenomena[0] : 'messwerte'
  return `${what} ${source.kind === 'area' ? source.area : source.tag}`
}

/** Keeps the existing Python preview (dev view) working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_OSEM] = (block) => {
  const output = pythonNameOf(block.id)
  return `${loadOsemOperation.toCode?.((block as OsemBlock).osemParams, { output }).python ?? ''}\n\n`
}
