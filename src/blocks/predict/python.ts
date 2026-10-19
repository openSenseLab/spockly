import { pythonGenerator } from 'blockly/python'

import { pythonNameOf } from '../pythonNames'
import { PREDICT } from './definition'

/** The guess as a comment, and the line that computes the real value. */
pythonGenerator.forBlock[PREDICT] = (block) => {
  const data = pythonNameOf(block.getRootBlock().id)
  const column = JSON.stringify(String(block.getFieldValue('COLUMN')))
  const quantity = String(block.getFieldValue('QUANTITY'))
  const guess = Number(block.getFieldValue('GUESS'))
  // The explanation as a comment; a line break would end the comment early.
  const reason = String(block.getFieldValue('REASON') ?? '').replace(/\s+/g, ' ').trim()
  return (
    `vermutung = ${guess}  # ${quantity} von ${column}\n` +
    `print("Vermutung:", vermutung, "| tatsächlich:", ${data}[${column}].${quantity}())\n` +
    (reason ? `# Warum: ${reason}\n` : '')
  )
}
