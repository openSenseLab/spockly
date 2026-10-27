import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { LoadOsmParams } from './mapping'

export function loadOsmToStep(block: Blockly.Block): PlanStep {
  const params: LoadOsmParams = {
    topic: String(block.getFieldValue('TOPIC') ?? ''),
    area: String(block.getFieldValue('AREA') ?? ''),
  }
  return {
    id: block.id,
    op: 'load_osm',
    params: { ...params },
    disabled: !block.isEnabled() || undefined,
  }
}
