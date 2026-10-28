import * as Blockly from "blockly";

import { saveFilesForReload } from "../../blocks/load_file/store";

/**
 * Keeps the blocks when the language switch reloads the page.
 * sessionStorage: survives the reload, but not closing the tab.
 */
const CARRY_KEY = "spockly.carryWorkspace";
let activeWorkspace: Blockly.WorkspaceSvg | null = null;

/** Read once per page load; a later language switch writes a fresh copy. */
export const carriedState = (() => {
  try {
    const json = window.sessionStorage.getItem(CARRY_KEY);
    window.sessionStorage.removeItem(CARRY_KEY);
    return json ? (JSON.parse(json) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
})();

export function setActiveWorkspace(workspace: Blockly.WorkspaceSvg | null) {
  activeWorkspace = workspace;
}

/** The main workspace, for UI outside Blockly (e.g. a block's setup window). */
export const getActiveWorkspace = () => activeWorkspace;

export function saveWorkspaceForReload() {
  saveFilesForReload();
  if (!activeWorkspace) return;
  try {
    const state = Blockly.serialization.workspaces.save(activeWorkspace);
    window.sessionStorage.setItem(CARRY_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("[workspace] could not keep blocks across reload", error);
  }
}
