// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import './index'
import { followRename } from './rename'

/** Two datasets ("sensoren", and "messwerte" made from it) and blocks that show them. */
function workspaceWith(extraDataset?: string) {
  const workspace = new Blockly.Workspace()
  const blocks: object[] = [
    { type: 'spockly_dataset', id: 'sensoren', fields: { NAME: 'sensoren' } },
    {
      type: 'spockly_dataset',
      id: 'messwerte',
      fields: { NAME: 'messwerte' },
      inputs: { STEPS: { block: { type: 'osem_measurements', id: 'hole', fields: { DATASET: 'sensoren' } } } },
    },
    { type: 'view_table', id: 'zeige-sensoren', fields: { DATASET: 'sensoren' } },
    { type: 'view_table', id: 'zeige-messwerte', fields: { DATASET: 'messwerte' } },
  ]
  if (extraDataset) blocks.push({ type: 'spockly_dataset', id: 'zweiter', fields: { NAME: extraDataset } })
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks } }, workspace)
  return workspace
}

/** Renames the dataset as a student would, and passes the change on as the workspace's listener does. */
function rename(workspace: Blockly.Workspace, id: string, name: string) {
  const block = workspace.getBlockById(id)!
  const before = block.getFieldValue('NAME')
  block.setFieldValue(name, 'NAME')
  const event = new Blockly.Events.BlockChange(block, 'field', 'NAME', before, name)
  followRename(event, workspace)
  return event
}

const chosen = (workspace: Blockly.Workspace, id: string) => workspace.getBlockById(id)!.getFieldValue('DATASET')

describe('followRename', () => {
  it('renames the dataset in every block that uses it, and only there', () => {
    const workspace = workspaceWith()
    rename(workspace, 'sensoren', 'Stationen')
    expect(chosen(workspace, 'hole')).toBe('Stationen')
    expect(chosen(workspace, 'zeige-sensoren')).toBe('Stationen')
    expect(chosen(workspace, 'zeige-messwerte')).toBe('messwerte')
  })

  it('leaves the blocks alone while another dataset still has the old name', () => {
    const workspace = workspaceWith('sensoren')
    rename(workspace, 'sensoren', 'Stationen')
    expect(chosen(workspace, 'zeige-sensoren')).toBe('sensoren')
  })

  it('ignores the spaces around a name, as the generated code does', () => {
    const workspace = workspaceWith()
    rename(workspace, 'sensoren', '  sensoren ')
    rename(workspace, 'sensoren', 'Stationen ')
    expect(chosen(workspace, 'zeige-sensoren')).toBe('Stationen')
  })

  it('puts the blocks in the rename\'s event group, so one undo takes both back', () => {
    const workspace = workspaceWith()
    const event = rename(workspace, 'sensoren', 'Stationen')
    expect(event.group).not.toBe('')
  })

  it('does nothing for the changes an undo makes, which put back the blocks on their own', () => {
    const workspace = workspaceWith()
    const block = workspace.getBlockById('sensoren')!
    Blockly.Events.setRecordUndo(false)
    try {
      block.setFieldValue('Stationen', 'NAME')
      followRename(new Blockly.Events.BlockChange(block, 'field', 'NAME', 'sensoren', 'Stationen'), workspace)
    } finally {
      Blockly.Events.setRecordUndo(true)
    }
    expect(chosen(workspace, 'zeige-sensoren')).toBe('sensoren')
  })
})
