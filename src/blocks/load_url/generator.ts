import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { UrlBlock } from './definition'

export function loadUrlToStep(block: Blockly.Block): PlanStep {
  const { url, read } = (block as UrlBlock).urlParams
  return {
    id: block.id,
    op: 'load_url',
    params: { url, ...(read ? { read: { ...read, ...(read.path ? { path: [...read.path] } : {}) } } : {}) },
    disabled: !block.isEnabled() || undefined,
  }
}
