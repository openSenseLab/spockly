import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { OsemBlock } from './definition'

export function loadOsemToStep(block: Blockly.Block): PlanStep {
  const { source, phenomena, period, outdoorOnly } = (block as OsemBlock).osemParams
  return {
    id: block.id,
    op: 'load_osem',
    params: { source: { ...source }, phenomena: [...phenomena], period, outdoorOnly },
    disabled: !block.isEnabled() || undefined,
  }
}
