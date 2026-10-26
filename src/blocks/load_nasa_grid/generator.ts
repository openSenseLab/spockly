import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { LoadNasaGridParams } from './mapping'

export function loadNasaGridToStep(block: Blockly.Block): PlanStep {
  const params: LoadNasaGridParams = {
    area: String(block.getFieldValue('AREA') ?? ''),
    parameter: String(block.getFieldValue('PARAMETER') ?? ''),
    year: Number(block.getFieldValue('YEAR')),
  }
  return {
    id: block.id,
    op: 'load_nasa_grid',
    params: { ...params },
    disabled: !block.isEnabled() || undefined,
  }
}
