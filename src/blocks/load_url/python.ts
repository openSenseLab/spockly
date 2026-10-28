import type * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import type { UrlBlock } from './definition'
import { LOAD_URL } from './definition'
import { loadUrlOperation } from './operation'
import { exampleFor } from './presets'

/** What the data is called in code: the example's name (erdbeben) or "daten" + the server's name. */
export function urlPythonBase(block: Blockly.Block) {
  const { url } = (block as UrlBlock).urlParams
  const example = exampleFor(url)
  if (example) return example.id
  try {
    return `daten ${new URL(url).hostname.replace(/^(www|api)\./, '').split('.')[0]}`
  } catch {
    return 'daten'
  }
}

/** Keeps the existing Python preview working; the plan is what actually runs. */
pythonGenerator.forBlock[LOAD_URL] = (block) => {
  const output = pythonNameOf(block.id)
  return `${loadUrlOperation.toCode?.((block as UrlBlock).urlParams, { output }).python ?? ''}\n\n`
}
