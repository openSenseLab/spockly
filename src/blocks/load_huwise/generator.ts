import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { LoadHuwiseParams } from './operation'

export function loadHuwiseToStep(block: Blockly.Block): PlanStep {
  const params: LoadHuwiseParams = {
    domain: String(block.getFieldValue('DOMAIN') ?? '').trim(),
    datasetId: String(block.getFieldValue('DATASET') ?? '').trim(),
    maxRows: Number(block.getFieldValue('MAX_ROWS')),
  }
  return {
    id: block.id,
    op: 'load_huwise',
    params: { ...params },
    disabled: !block.isEnabled() || undefined,
  }
}
