import * as Blockly from "blockly";
import { UNIFIED_BLOCK_TYPES, UNIFIED_COLOR } from "./unifiedConstants";
import {
  UNIFIED_ANALYSIS_ACTIONS,
  UNIFIED_DATASETS,
  UNIFIED_LOCATION_DATASETS,
  UNIFIED_PREPROCESSING_ACTIONS,
  UNIFIED_STARTER_ANALYSES,
  UNIFIED_STARTER_OUTPUTS,
  UNIFIED_VISUALIZATION_TYPES,
} from "./unifiedConstants";

/**
 * "Unified block" branch (Branch C) block definitions.
 *
 * These are all-in-one monolithic statement blocks that run a complete analysis.
 * They teach the big picture and serve as a demo / starting point, not for
 * learning the internal data-flow relationships.
 */

const unifiedBlocks = [
  {
    type: UNIFIED_BLOCK_TYPES.EXPLORE_DATASET,
    tooltip:
      "All-in-one unified block that loads, analyzes, and plots a dataset in a single step.",
    helpUrl: "",
    message0: "🔬 Unified block: Explore dataset %1 into %2",
    args0: [
      {
        type: "field_dropdown",
        name: "DATASET_URL",
        options: [...UNIFIED_DATASETS],
      },
      {
        type: "field_variable",
        name: "VAR",
        variable: "df",
      },
    ],
    message1: "analyze: %1",
    args1: [
      {
        type: "field_dropdown",
        name: "ACTION",
        options: [...UNIFIED_ANALYSIS_ACTIONS],
      },
    ],
    message2: "visualize: plot %1 titled %2",
    args2: [
      {
        type: "field_dropdown",
        name: "CHART_TYPE",
        options: [...UNIFIED_VISUALIZATION_TYPES],
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Dataset Distribution",
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: UNIFIED_COLOR,
  },

  {
    type: UNIFIED_BLOCK_TYPES.HEAT_ISLANDS_UNIFIED,
    tooltip:
      "All-in-one unified that runs a complete example investigation on the local 72-hour dataset: load, clean, analyze, visualize (time + space), and export.",
    helpUrl: "",
    message0: "🌡️ Unified block: Example investigation (local 72-hour dataset)",
    previousStatement: null,
    nextStatement: null,
    colour: UNIFIED_COLOR,
  },

  {
    type: UNIFIED_BLOCK_TYPES.WORKSHOP_STARTER,
    tooltip:
      "One all-in-one Unified block for a canonical Münster procedure. It loads, cleans, analyzes, visualizes, and exports the selected result.",
    helpUrl: "",
    message0: "Unified block investigation: load %1",
    args0: [
      {
        type: "field_dropdown",
        name: "DATASET",
        options: [UNIFIED_DATASETS[0]],
      },
    ],
    message1: "preprocess %1, analyze %2, output %3",
    args1: [
      {
        type: "field_dropdown",
        name: "PREPROCESS",
        options: [...UNIFIED_PREPROCESSING_ACTIONS],
      },
      {
        type: "field_dropdown",
        name: "ANALYSIS",
        options: [...UNIFIED_STARTER_ANALYSES],
      },
      {
        type: "field_dropdown",
        name: "OUTPUT",
        options: [...UNIFIED_STARTER_OUTPUTS],
      },
    ],
    message2: "locations %1, titled %2",
    args2: [
      {
        type: "field_dropdown",
        name: "LOCATION_DATASET",
        options: [...UNIFIED_LOCATION_DATASETS],
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Münster temperature investigation",
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: UNIFIED_COLOR,
  },
];

Blockly.common.defineBlocksWithJsonArray(unifiedBlocks);
