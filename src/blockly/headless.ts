import * as Blockly from 'blockly'

import './blocks'
import { pythonGenerator } from './generators'
import { migrateWorkspace } from './migrate'

export const generateCode = (workspace: Blockly.Workspace) =>
  pythonGenerator.workspaceToCode(workspace).trim()

/** Generate Python for a serialized workspace without rendering it. */
export const codeFromWorkspace = (state: object | null) => {
  if (!state) return ''
  const workspace = new Blockly.Workspace()
  try {
    Blockly.serialization.workspaces.load(migrateWorkspace(state), workspace)
    return generateCode(workspace)
  } finally {
    workspace.dispose()
  }
}
