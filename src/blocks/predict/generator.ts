import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { PredictBlock } from './definition'

/** A prediction doesn't change the data; the step tells the panel which column to keep hidden. */
export function predictToStep(block: Blockly.Block): PlanStep {
  return {
    id: block.id,
    op: 'predict_value',
    params: {
      quantity: block.getFieldValue('QUANTITY'),
      column: block.getFieldValue('COLUMN'),
      guess: Number(block.getFieldValue('GUESS')),
      revealed: (block as PredictBlock).revealed,
      reason: String(block.getFieldValue('REASON') ?? '').trim(),
    },
    disabled: !block.isEnabled() || undefined,
  }
}
