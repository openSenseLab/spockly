import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { LoadNaturalEarthParams } from './operation'

export function loadNaturalEarthToStep(block: Blockly.Block): PlanStep {
  const params: LoadNaturalEarthParams = { dataset: String(block.getFieldValue('DATASET') ?? '') }
  return {
    id: block.id,
    op: 'load_natural_earth',
    params: { ...params },
    disabled: !block.isEnabled() || undefined,
  }
}
