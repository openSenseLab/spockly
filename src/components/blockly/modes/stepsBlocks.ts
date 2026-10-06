import * as Blockly from "blockly";
import { UPLOAD_BUTTON_FIELD_TYPE } from "../blocks/fields/uploadField";
import { DS_OUTPUT_TYPES } from "./types";
import {
  AGGREGATIONS,
  COLUMN_TYPES,
  STEPS_BLOCK_TYPES,
  STEPS_COLOR,
  DATASETS,
  GEOJSON_SOURCES,
} from "./stepsConstants";

/**
 * "Data Flow" branch (Branch A) block definitions.
 *
 * These are **statement blocks** that stack vertically into a pipeline. The
 * dataframe flows implicitly through the variable `df` (and plots through
 * `plot`), so learners build a connected chain instead of a loose collection of
 * value blocks.
 *
 * - Data sources, transforms, observations, and visualizations are statement
 *   blocks (`previousStatement`/`nextStatement`, no `output`).
 * - `set` snapshots the current pipeline value (`df` or `plot`) into a named
 *   variable; `get` re-injects a named value (a value block).
 * - Column inputs use `check: "String"` with a shadow `text` block (prefilled
 *   placeholder) so learners drag a real block in to replace it.
 */

const stepsBlocks = [
  // --- Data sources (statement → df) ---
  {
    type: STEPS_BLOCK_TYPES.LOAD_CSV,
    tooltip: "Load a CSV file (local /data path or remote URL) into the dataframe.",
    helpUrl: "",
    message0: "load CSV %1",
    args0: [
      {
        type: "field_dropdown",
        name: "SOURCE",
        options: [...DATASETS],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.LOAD_GEOJSON,
    tooltip: "Load a GeoJSON file and flatten its features into a dataframe with x/y columns.",
    helpUrl: "",
    message0: "load GeoJSON %1",
    args0: [
      {
        type: "field_dropdown",
        name: "SOURCE",
        options: [...GEOJSON_SOURCES],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.UPLOAD_CSV,
    tooltip: "Upload a CSV file from your computer and load it into the dataframe.",
    helpUrl: "",
    message0: "upload CSV %1",
    args0: [
      {
        type: UPLOAD_BUTTON_FIELD_TYPE,
        name: "FILE",
        text: "Choose file…",
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Transformations (df → df) ---
  {
    type: STEPS_BLOCK_TYPES.CLEAN_TYPES,
    tooltip: "Convert a column to datetime or numeric (handles German decimal commas).",
    helpUrl: "",
    message0: "convert column %1 to %2",
    args0: [
      {
        type: "input_value",
        name: "COLUMN",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "measurement_timestamp" },
        },
      },
      {
        type: "field_dropdown",
        name: "TYPE",
        options: [...COLUMN_TYPES],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.CLEAN_MISSING,
    tooltip: "Drop rows with missing values in the dataframe (optionally per column).",
    helpUrl: "",
    message0: "drop rows with missing values in %1",
    args0: [
      {
        type: "input_value",
        name: "COLUMN",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.CLEAN_FILTER,
    tooltip: "Keep rows where a column falls within a plausible value range.",
    helpUrl: "",
    message0: "filter %1 between %2 and %3",
    args0: [
      {
        type: "input_value",
        name: "COLUMN",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "input_value",
        name: "MIN",
        check: "Number",
        shadow: {
          type: "math_number",
          fields: { NUM: -30 },
        },
      },
      {
        type: "input_value",
        name: "MAX",
        check: "Number",
        shadow: {
          type: "math_number",
          fields: { NUM: 50 },
        },
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.CLEAN_DEDUP,
    tooltip: "Remove duplicate rows based on a subset of columns.",
    helpUrl: "",
    message0: "remove duplicates (subset: %1)",
    args0: [
      {
        type: "input_value",
        name: "SUBSET",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_id, measurement_timestamp" },
        },
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_GROUPBY,
    tooltip: "Group by columns and aggregate a value column into a new dataframe.",
    helpUrl: "",
    message0: "group by %1, aggregate %2 (%3)",
    args0: [
      {
        type: "input_value",
        name: "GROUP_COLS",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_id, device_name" },
        },
      },
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "field_dropdown",
        name: "AGG",
        options: [...AGGREGATIONS],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Observations (df → df, then print) ---
  {
    type: STEPS_BLOCK_TYPES.ANALYZE_DESCRIBE,
    tooltip: "Compute summary statistics for the dataframe.",
    helpUrl: "",
    message0: "describe into %1",
    args0: [
      {
        type: "field_input",
        name: "VAR",
        text: "summary",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_INSPECT,
    tooltip: "Inspect the working table: row count, station count, date range, types, missing values.",
    helpUrl: "",
    message0: "inspect measurements",
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_COUNT_CATEGORIES,
    tooltip: "Count the values of a category column (e.g. temperature flags or heat notifications).",
    helpUrl: "",
    message0: "count categories in %1 into %2",
    args0: [
      {
        type: "input_value",
        name: "COLUMN",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "flag_temperature" },
        },
      },
      {
        type: "field_input",
        name: "VAR",
        text: "category_counts",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE,
    tooltip: "Summarize temperature by station and compare each station mean with the mean of all retained readings.",
    helpUrl: "",
    message0: "compare stations by %1 (value: %2) into %3",
    args0: [
      {
        type: "input_value",
        name: "STATION_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_id" },
        },
      },
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "field_input",
        name: "VAR",
        text: "station_stats",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_HOURLY,
    tooltip: "Average readings into hourly intervals (sorted chronologically).",
    helpUrl: "",
    message0: "average %1 into hourly intervals (time: %2) into %3",
    args0: [
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "input_value",
        name: "TIME_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "measurement_timestamp" },
        },
      },
      {
        type: "field_input",
        name: "VAR",
        text: "hourly",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_HOUR_OF_DAY,
    tooltip: "Summarize by hour of day (mean across all dates).",
    helpUrl: "",
    message0: "summarize %1 by hour of day (time: %2) into %3",
    args0: [
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "input_value",
        name: "TIME_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "measurement_timestamp" },
        },
      },
      {
        type: "field_input",
        name: "VAR",
        text: "hour_of_day",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.ANALYZE_CORRELATION,
    tooltip: "Compute the correlation matrix of numeric columns.",
    helpUrl: "",
    message0: "correlation into %1",
    args0: [
      {
        type: "field_input",
        name: "VAR",
        text: "correlation",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.SPATIAL_JOIN,
    tooltip: "Join station summaries to station locations on a key column (IDs matched as text).",
    helpUrl: "",
    message0: "join %1 with %2 on %3 into %4",
    args0: [
      {
        type: "input_value",
        name: "SUMMARY",
      },
      {
        type: "input_value",
        name: "LOCATIONS",
      },
      {
        type: "input_value",
        name: "KEY",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_id" },
        },
      },
      {
        type: "field_input",
        name: "VAR",
        text: "station_map",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Visualizations (df → plot) ---
  {
    type: STEPS_BLOCK_TYPES.VIZ_TIMESERIES,
    tooltip: "Plot a value column over a time column as a line chart.",
    helpUrl: "",
    message0: "time series: %1 over %2 titled %3",
    args0: [
      {
        type: "input_value",
        name: "TIME_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "measurement_timestamp" },
        },
      },
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Temperature over time",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.VIZ_BAR,
    tooltip: "Plot a bar chart of one column against another.",
    helpUrl: "",
    message0: "bar chart: %1 vs %2 titled %3",
    args0: [
      {
        type: "input_value",
        name: "X_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_name" },
        },
      },
      {
        type: "input_value",
        name: "Y_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "deviation" },
        },
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Bar chart",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.VIZ_SCATTER,
    tooltip: "Plot a scatter of one column against another, optionally colored by a value.",
    helpUrl: "",
    message0: "scatter: %1 vs %2 (color: %3) titled %4",
    args0: [
      {
        type: "input_value",
        name: "X_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "x" },
        },
      },
      {
        type: "input_value",
        name: "Y_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "y" },
        },
      },
      {
        type: "input_value",
        name: "COLOR_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "deviation" },
        },
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Scatter plot",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.VIZ_LOCATION,
    tooltip: "Plot station locations colored by a value (e.g. deviation) as a reliable coordinate map.",
    helpUrl: "",
    message0: "location map: %1 vs %2 (color: %3) titled %4",
    args0: [
      {
        type: "input_value",
        name: "X_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "x" },
        },
      },
      {
        type: "input_value",
        name: "Y_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "y" },
        },
      },
      {
        type: "input_value",
        name: "COLOR_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "deviation" },
        },
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Münster station locations",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.VIZ_HOURLY_COMPARE,
    tooltip: "Plot hourly reference and selected station curves.",
    helpUrl: "",
    message0: "hourly comparison: %1 over %2 (reference: %3) titled %4",
    args0: [
      {
        type: "input_value",
        name: "TIME_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "measurement_timestamp" },
        },
      },
      {
        type: "input_value",
        name: "VALUE_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "temperature" },
        },
      },
      {
        type: "input_value",
        name: "STATION_COL",
        check: DS_OUTPUT_TYPES.STRING,
        shadow: {
          type: "text",
          fields: { TEXT: "device_id" },
        },
      },
      {
        type: "field_input",
        name: "TITLE",
        text: "Hourly comparison",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.VIZ_SCATTER_TEMP_HUM,
    tooltip: "Plot a temperature/humidity scatter to inspect their relationship.",
    helpUrl: "",
    message0: "scatter temperature vs humidity titled %1",
    args0: [
      {
        type: "field_input",
        name: "TITLE",
        text: "Temperature vs humidity",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Exports (statement blocks) ---
  {
    type: STEPS_BLOCK_TYPES.EXPORT_CSV,
    tooltip: "Export the dataframe to a CSV file in the output directory.",
    helpUrl: "",
    message0: "export to file %1",
    args0: [
      {
        type: "field_input",
        name: "FILENAME",
        text: "result.csv",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.EXPORT_PLOT,
    tooltip: "Export the current plot to a PNG file in the output directory.",
    helpUrl: "",
    message0: "export plot to file %1",
    args0: [
      {
        type: "field_input",
        name: "FILENAME",
        text: "plot.png",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Print (statement block) ---
  {
    type: STEPS_BLOCK_TYPES.PRINT,
    tooltip: "Print a value to the console. Use this to observe a result.",
    helpUrl: "",
    message0: "print %1 %2",
    args0: [
      {
        type: "field_dropdown",
        name: "WHAT",
        options: [
          ["the dataframe (df)", "df"],
          ["the plot (plot)", "plot"],
          ["a named variable", "var"],
        ],
      },
      {
        type: "input_value",
        name: "VALUE",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  // --- Naming & reuse ---
  {
    type: STEPS_BLOCK_TYPES.SET,
    tooltip: "Snapshot the current pipeline value (dataframe or plot) into a named variable.",
    helpUrl: "",
    message0: "set %1 to %2",
    args0: [
      {
        type: "field_input",
        name: "VAR",
        text: "result",
      },
      {
        type: "field_dropdown",
        name: "WHAT",
        options: [
          ["dataframe (df)", "df"],
          ["plot (plot)", "plot"],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.GET,
    tooltip: "Re-inject a named variable as a value (e.g. into a merge or print block).",
    helpUrl: "",
    message0: "get %1",
    args0: [
      {
        type: "field_input",
        name: "VAR",
        text: "result",
      },
    ],
    output: null,
    colour: STEPS_COLOR,
  },

  {
    type: STEPS_BLOCK_TYPES.RESTORE,
    tooltip: "Restore a saved named dataframe as the working table (df).",
    helpUrl: "",
    message0: "restore %1 as the working table",
    args0: [
      {
        type: "field_input",
        name: "VAR",
        text: "data",
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: STEPS_COLOR,
  },
];

Blockly.common.defineBlocksWithJsonArray(stepsBlocks);
