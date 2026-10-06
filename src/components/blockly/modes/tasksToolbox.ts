import { TASKS_BLOCK_TYPES } from "./tasksConstants";
import { standardCategories } from "../toolbox/toolbox";

/**
 * Toolbox for the "Tasks" branch (Branch D).
 *
 * Organized by the four predefined actionable step categories:
 * Load → Preprocess → Analyze → Output/Viz.
 *
 * Each category contains a single block with a method dropdown. The "Starters"
 * category contains complete, runnable example taskss that chain the steps in a
 * user-defined order.
 */

/** A single block in a starter chain. `next` is nested by the `starter` helper. */
type StarterBlock = {
  type: string;
  fields?: Record<string, unknown>;
  next?: StarterBlock | { block: StarterBlock };
};

/**
 * Build a nested Blockly block chain from a flat list of block specs.
 * Each block's `next` is wrapped as `{ block: ... }`, as Blockly expects.
 */
function starter(...blocks: StarterBlock[]): Record<string, unknown> {
  let result: StarterBlock | undefined;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = { ...blocks[i] };
    if (result) {
      block.next = { block: result };
    }
    result = block;
  }
  return { kind: "block", ...result! };
}

/**
 * Toolbox for the "Tasks" branch (Branch D).
 *
 * The standard Blockly categories (Logic, Math, Text, Variables) are merged in so
 * learners still have the default building blocks available.
 */
export const tasksToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Starters",
      colour: "#0f766e",
      contents: [
        { kind: "label", text: "Load → Preprocess → Analyze → Output" },
        starter(
          {
            type: TASKS_BLOCK_TYPES.LOAD,
            fields: {
              DATASET: "/data/muenster_measurements_72h.csv",
              OUTPUT_VAR: "data",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.PREPROCESS,
            fields: {
              INPUT_VAR: "data",
              METHOD: "CLEAN_TYPES",
              COLUMN: "measurement_timestamp",
              TYPE: "DATETIME",
              OUTPUT_VAR: "clean_data",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.ANALYZE,
            fields: {
              INPUT_VAR: "clean_data",
              METHOD: "STATION_COMPARE",
              STATION_COL: "device_id",
              VALUE_COL: "temperature",
              OUTPUT_VAR: "station_stats",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.OUTPUT,
            fields: {
              INPUT_VAR: "station_stats",
              METHOD: "BAR",
              X_COL: "device_name",
              Y_COL: "deviation",
              TITLE: "Station deviation",
            },
          },
        ),
        { kind: "label", text: "Load → Analyze → Output (time series)" },
        starter(
          {
            type: TASKS_BLOCK_TYPES.LOAD,
            fields: {
              DATASET: "/data/muenster_measurements_72h.csv",
              OUTPUT_VAR: "data",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.OUTPUT,
            fields: {
              INPUT_VAR: "data",
              METHOD: "TIMESERIES",
              TIME_COL: "measurement_timestamp",
              VALUE_COL: "temperature",
              TITLE: "Temperature over time",
            },
          },
        ),
        { kind: "label", text: "Load → Preprocess → Analyze → Output (spatial)" },
        starter(
          {
            type: TASKS_BLOCK_TYPES.LOAD,
            fields: {
              DATASET: "/data/muenster_stations.geojson",
              OUTPUT_VAR: "stations",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.LOAD,
            fields: {
              DATASET: "/data/muenster_measurements_72h.csv",
              OUTPUT_VAR: "data",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.ANALYZE,
            fields: {
              INPUT_VAR: "data",
              METHOD: "STATION_COMPARE",
              STATION_COL: "device_id",
              VALUE_COL: "temperature",
              OUTPUT_VAR: "station_stats",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.ANALYZE,
            fields: {
              INPUT_VAR: "station_stats",
              METHOD: "SPATIAL_JOIN",
              LOCATION_VAR: "stations",
              KEY_COL: "device_id",
              OUTPUT_VAR: "station_map",
            },
          },
          {
            type: TASKS_BLOCK_TYPES.OUTPUT,
            fields: {
              INPUT_VAR: "station_map",
              METHOD: "LOCATION",
              X_COL: "x",
              Y_COL: "y",
              COLOR_COL: "deviation",
              TITLE: "Station locations",
            },
          },
        ),
      ],
    },
    {
      kind: "category",
      name: "Load",
      colour: "#0f766e",
      contents: [
        { kind: "block", type: TASKS_BLOCK_TYPES.LOAD },
      ],
    },
    {
      kind: "category",
      name: "Preprocess",
      colour: "#b45309",
      contents: [
        { kind: "block", type: TASKS_BLOCK_TYPES.PREPROCESS },
      ],
    },
    {
      kind: "category",
      name: "Analyze",
      colour: "#7c3aed",
      contents: [
        { kind: "block", type: TASKS_BLOCK_TYPES.ANALYZE },
      ],
    },
    {
      kind: "category",
      name: "Output",
      colour: "#be185d",
      contents: [
        { kind: "block", type: TASKS_BLOCK_TYPES.OUTPUT },
      ],
    },
    ...standardCategories,
  ],
};
