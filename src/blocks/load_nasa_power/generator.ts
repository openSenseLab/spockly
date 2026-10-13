import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { NasaBlock } from './definition'

export function loadNasaPowerToStep(block: Blockly.Block): PlanStep {
  const { place, variables, resolution, from, to } = (block as NasaBlock).nasaParams
  return {
    id: block.id,
    op: 'load_nasa_power',
    params: { place: { ...place }, variables: [...variables], resolution, from, to },
    disabled: !block.isEnabled() || undefined,
  }
}
