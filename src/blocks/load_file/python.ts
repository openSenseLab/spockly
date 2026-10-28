import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import type { FileBlock } from './definition'
import { LOAD_FILE } from './definition'
import { loadFileOperation } from './operation'

/** What the data is called in code: the file's name without its ending, e.g. messung_klasse_9b. */
export function filePythonBase(block: Blockly.Block) {
  const { name } = (block as FileBlock).fileParams
  return name ? name.replace(/\.[^.]+$/, '') : 'datei'
}

/** Keeps the existing Python preview working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_FILE] = (block) => {
  const output = pythonNameOf(block.id)
  return `${loadFileOperation.toCode?.((block as FileBlock).fileParams, { output }).python ?? ''}\n\n`
}
