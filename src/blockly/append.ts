import * as Blockly from 'blockly'

import type { Selection } from '../journal/types'
import { generateCode } from './headless'
import { SELECT_BLOCK, referenceOf } from './reference'

/** The data block's "select … as …" block for a selection. */
export const selectBlockState = (selection: Selection) => ({
  type: SELECT_BLOCK,
  fields: { NAME: selection.name },
  extraState: { id: selection.id, output: selection.output, ref: selection.ref, ...(selection.type ? { type: selection.type } : {}) },
})

const result = (workspace: Blockly.Workspace) => ({ state: Blockly.serialization.workspaces.save(workspace), code: generateCode(workspace) })

/**
 * Add blocks below the load blocks (the stack that loads `dataset`, else the first stack)
 * and return the workspace's new state and code. Used by the Select tab of the inspection.
 */
export const appendToLoadStack = (workspace: Blockly.WorkspaceSvg, states: object[], dataset: string) => {
  let block: Blockly.Block | null = null
  for (const state of states) block = appendOne(workspace, state, dataset)
  if (block) workspace.scrollBoundsIntoView((block as Blockly.BlockSvg).getBoundingRectangle())
  return result(workspace)
}

const appendOne = (workspace: Blockly.WorkspaceSvg, state: object, dataset: string) => {
  const stacks = workspace.getTopBlocks(true).filter((block) => block.previousConnection?.getCheck()?.includes('load') ?? false)
  const loads = (top: Blockly.Block) => top.getDescendants(true).some((block) => block.getFieldValue('NAME') === dataset)
  const stack = stacks.find(loads) ?? stacks[0]
  const block = Blockly.serialization.blocks.append(state as Blockly.serialization.blocks.State, workspace)
  if (stack) {
    let last = stack
    while (last.getNextBlock()) last = last.getNextBlock()!
    last.nextConnection?.connect(block.previousConnection!)
  } else {
    block.moveBy(24, 24)
  }
  return block
}

/** Delete the "select … as …" block of a selection (the blocks below it move up). */
export const removeSelectBlock = (workspace: Blockly.WorkspaceSvg, id: string) => {
  const block = workspace.getAllBlocks(false).find((candidate) => candidate.type === SELECT_BLOCK && referenceOf(candidate).id === id)
  block?.dispose(true)
  return result(workspace)
}
