import type * as Blockly from 'blockly'

import type { PlanStep } from '../../core/types'
import type { FileBlock } from './definition'

export function loadFileToStep(block: Blockly.Block): PlanStep {
  const { fileId, name, file, read } = (block as FileBlock).fileParams
  return {
    id: block.id,
    op: 'load_file',
    params: { fileId, name, file, ...(read ? { read: { ...read, ...(read.path ? { path: [...read.path] } : {}) } } : {}) },
    disabled: !block.isEnabled() || undefined,
  }
}
