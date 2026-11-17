/**
 * Renaming a dataset renames it everywhere: the blocks that choose it by name
 * ("zeige …", "hole für jede Zeile in …") follow, as Blockly's own variables do.
 */
import * as Blockly from 'blockly'

import { FieldDataset } from './fields'
import { DATASET } from './program'

const nameOf = (value: unknown) => String(value ?? '').trim()

/** For the workspace's change listener: after a dataset's name changed, change it in the blocks that use it. */
export function followRename(event: Blockly.Events.Abstract, workspace: Blockly.Workspace) {
  // Undo and redo put back every change on their own, the blocks' fields too.
  if (event.type !== Blockly.Events.BLOCK_CHANGE || !event.recordUndo) return
  const change = event as Blockly.Events.BlockChange
  if (change.element !== 'field' || change.name !== 'NAME' || !change.blockId) return
  const renamed = workspace.getBlockById(change.blockId)
  if (renamed?.type !== DATASET) return

  const [before, after] = [nameOf(change.oldValue), nameOf(change.newValue)]
  if (!before || !after || before === after) return
  // Another dataset with the old name keeps the blocks that use it.
  const stillThere = workspace
    .getBlocksByType(DATASET, false)
    .some((block) => block !== renamed && nameOf(block.getFieldValue('NAME')) === before)
  if (stillThere) return

  const fields = workspace
    .getAllBlocks(false)
    .flatMap((block) => block.inputList.flatMap((input) => input.fieldRow))
    .filter((field): field is FieldDataset => field instanceof FieldDataset && field.getValue() === before)
  if (!fields.length) return

  // In the rename's event group, so one undo takes back the name and the blocks together.
  const group = change.group || Blockly.utils.idGenerator.genUid()
  change.group = group
  const outer = Blockly.Events.getGroup()
  Blockly.Events.setGroup(group)
  try {
    for (const field of fields) field.setValue(after)
  } finally {
    Blockly.Events.setGroup(outer || false)
  }
}
