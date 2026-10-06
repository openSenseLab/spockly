import type { DsMode } from "./types";
import { stepsToolbox } from "./stepsToolbox";
import { unifiedToolbox } from "./unifiedToolbox";
import { tasksToolbox } from "./tasksToolbox";

/**
 * Central registry for the three pedagogical branches.
 *
 * Each branch is a self-contained module that registers its block definitions and
 * generators (via side-effect imports) and exposes a toolbox. The `BlocklyWorkspace`
 * selects the toolbox based on the active `dsMode`.
 */

// Register block definitions + generators for each branch (side-effect imports).
import "./stepsBlocks";
import "./stepsGenerators";
import "./unifiedBlocks";
import "./unifiedGenerators";
import "./tasksBlocks";
import "./tasksGenerators";

/** Map a DsMode to its toolbox. */
export function getToolboxForMode(mode: DsMode) {
  switch (mode) {
    case "steps":
      return stepsToolbox;
    case "unified":
      return unifiedToolbox;
    case "tasks":
      return tasksToolbox;
    default:
      return stepsToolbox;
  }
}
