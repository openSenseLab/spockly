import { STEPS_BLOCK_TYPES } from "./stepsConstants";
import { standardCategories } from "../toolbox/toolbox";

/**
 * A single block in a starter chain. `next` is nested by the `starter` helper.
 */
type StarterBlock = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
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

/** A `get` value block that re-injects a named variable into an input. */
function getBlock(varName: string): Record<string, unknown> {
  return {
    block: {
      type: STEPS_BLOCK_TYPES.GET,
      fields: { VAR: varName },
    },
  };
}

/** A shadow text block pre-filled with a column name. */
function textShadow(text: string): Record<string, unknown> {
  return {
    shadow: {
      type: "text",
      fields: { TEXT: text },
    },
  };
}

/** A shadow number block pre-filled with a value. */
function numberShadow(num: number): Record<string, unknown> {
  return {
    shadow: {
      type: "math_number",
      fields: { NUM: num },
    },
  };
}

/**
 * Toolbox for the "Data Flow" branch (Branch A).
 *
 * Organized by the data-science conceptual model:
 * Data → Transform → Observe → Visualize → Export → Print.
 *
 * The standard Blockly categories (Logic, Math, Text, etc.) are merged in so
 * learners still have the default building blocks available.
 *
 * The "Starters" category contains a complete, runnable example for every block,
 * grouped by the stage it belongs to. Drag one in, run it, and inspect the result.
 */
export const stepsToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Starters",
      colour: "#0f766e",
      contents: [
        { kind: "label", text: "Data sources" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_GEOJSON, fields: { SOURCE: "/data/muenster_stations.geojson" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.UPLOAD_CSV },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),

        { kind: "label", text: "Transformations" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_TYPES, inputs: { COLUMN: textShadow("measurement_timestamp") }, fields: { TYPE: "DATETIME" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_MISSING, inputs: { COLUMN: textShadow("temperature") } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_FILTER, inputs: { COLUMN: textShadow("temperature"), MIN: numberShadow(-30), MAX: numberShadow(50) } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_DEDUP, inputs: { SUBSET: textShadow("device_id, measurement_timestamp") } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_GROUPBY, inputs: { GROUP_COLS: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { AGG: "mean" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
        ),

        { kind: "label", text: "Observations" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_DESCRIBE, fields: { VAR: "summary" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("summary") } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_INSPECT },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_COUNT_CATEGORIES, inputs: { COLUMN: textShadow("flag_temperature") }, fields: { VAR: "category_counts" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("category_counts") } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE, inputs: { STATION_COL: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("station_stats") } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_HOURLY, inputs: { VALUE_COL: textShadow("temperature"), TIME_COL: textShadow("measurement_timestamp") }, fields: { VAR: "hourly" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("hourly") } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_HOUR_OF_DAY, inputs: { VALUE_COL: textShadow("temperature"), TIME_COL: textShadow("measurement_timestamp") }, fields: { VAR: "hour_of_day" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("hour_of_day") } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_CORRELATION, fields: { VAR: "correlation" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("correlation") } },
        ),

        { kind: "label", text: "Spatial" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_GEOJSON, fields: { SOURCE: "/data/muenster_stations.geojson" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "stations", WHAT: "df" } },
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE, inputs: { STATION_COL: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.SPATIAL_JOIN, inputs: { SUMMARY: getBlock("station_stats"), LOCATIONS: getBlock("stations"), KEY: textShadow("device_id") }, fields: { VAR: "station_map" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "var" }, inputs: { VALUE: getBlock("station_map") } },
        ),

        { kind: "label", text: "Visualizations" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.VIZ_TIMESERIES, inputs: { TIME_COL: textShadow("measurement_timestamp"), VALUE_COL: textShadow("temperature") }, fields: { TITLE: "Temperature over time" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "muenster_timeseries.png" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE, inputs: { STATION_COL: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.RESTORE, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.VIZ_BAR, inputs: { X_COL: textShadow("device_name"), Y_COL: textShadow("deviation") }, fields: { TITLE: "Station deviation" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "muenster_deviation.png" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE, inputs: { STATION_COL: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.RESTORE, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.VIZ_SCATTER, inputs: { X_COL: textShadow("mean"), Y_COL: textShadow("count"), COLOR_COL: textShadow("deviation") }, fields: { TITLE: "Mean vs count" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "mean_vs_count.png" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_GEOJSON, fields: { SOURCE: "/data/muenster_stations.geojson" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "stations", WHAT: "df" } },
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE, inputs: { STATION_COL: textShadow("device_id"), VALUE_COL: textShadow("temperature") }, fields: { VAR: "station_stats" } },
          { type: STEPS_BLOCK_TYPES.SPATIAL_JOIN, inputs: { SUMMARY: getBlock("station_stats"), LOCATIONS: getBlock("stations"), KEY: textShadow("device_id") }, fields: { VAR: "station_map" } },
          { type: STEPS_BLOCK_TYPES.RESTORE, fields: { VAR: "station_map" } },
          { type: STEPS_BLOCK_TYPES.VIZ_LOCATION, inputs: { X_COL: textShadow("x"), Y_COL: textShadow("y"), COLOR_COL: textShadow("deviation") }, fields: { TITLE: "Station locations" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "muenster_station_map.png" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.VIZ_HOURLY_COMPARE, inputs: { TIME_COL: textShadow("measurement_timestamp"), VALUE_COL: textShadow("temperature"), STATION_COL: textShadow("device_id") }, fields: { TITLE: "Hourly comparison" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "hourly_comparison.png" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.VIZ_SCATTER_TEMP_HUM, fields: { TITLE: "Temperature vs humidity" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "temp_vs_humidity.png" } },
        ),

        { kind: "label", text: "Exports" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_CSV, fields: { FILENAME: "measurements.csv" } },
        ),
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.VIZ_TIMESERIES, inputs: { TIME_COL: textShadow("measurement_timestamp"), VALUE_COL: textShadow("temperature") }, fields: { TITLE: "Temperature over time" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "muenster_timeseries.png" } },
        ),

        { kind: "label", text: "Print" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "df" } },
        ),

        { kind: "label", text: "Naming & reuse" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.SET, fields: { VAR: "data", WHAT: "df" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_MISSING, inputs: { COLUMN: textShadow("temperature") } },
          { type: STEPS_BLOCK_TYPES.RESTORE, fields: { VAR: "data" } },
          { type: STEPS_BLOCK_TYPES.PRINT, fields: { WHAT: "df" } },
        ),

        { kind: "label", text: "Complete workflow" },
        starter(
          { type: STEPS_BLOCK_TYPES.LOAD_CSV, fields: { SOURCE: "/data/muenster_measurements_72h.csv" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_TYPES, inputs: { COLUMN: textShadow("measurement_timestamp") }, fields: { TYPE: "DATETIME" } },
          { type: STEPS_BLOCK_TYPES.CLEAN_FILTER, inputs: { COLUMN: textShadow("temperature"), MIN: numberShadow(-30), MAX: numberShadow(50) } },
          { type: STEPS_BLOCK_TYPES.VIZ_TIMESERIES, inputs: { TIME_COL: textShadow("measurement_timestamp"), VALUE_COL: textShadow("temperature") }, fields: { TITLE: "Temperature over time" } },
          { type: STEPS_BLOCK_TYPES.EXPORT_PLOT, fields: { FILENAME: "plot.png" } },
        ),
      ],
    },
    {
      kind: "category",
      name: "Data",
      colour: "#0d9488",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.LOAD_CSV },
        { kind: "block", type: STEPS_BLOCK_TYPES.LOAD_GEOJSON },
        { kind: "block", type: STEPS_BLOCK_TYPES.UPLOAD_CSV },
      ],
    },
    {
      kind: "category",
      name: "Transform",
      colour: "#0284c7",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.CLEAN_TYPES },
        { kind: "block", type: STEPS_BLOCK_TYPES.CLEAN_MISSING },
        { kind: "block", type: STEPS_BLOCK_TYPES.CLEAN_FILTER },
        { kind: "block", type: STEPS_BLOCK_TYPES.CLEAN_DEDUP },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_GROUPBY },
        { kind: "block", type: STEPS_BLOCK_TYPES.SPATIAL_JOIN },
      ],
    },
    {
      kind: "category",
      name: "Observe",
      colour: "#7c3aed",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_DESCRIBE },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_INSPECT },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_COUNT_CATEGORIES },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_HOURLY },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_HOUR_OF_DAY },
        { kind: "block", type: STEPS_BLOCK_TYPES.ANALYZE_CORRELATION },
      ],
    },
    {
      kind: "category",
      name: "Visualize",
      colour: "#ea580c",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_TIMESERIES },
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_BAR },
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_SCATTER },
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_SCATTER_TEMP_HUM },
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_HOURLY_COMPARE },
        { kind: "block", type: STEPS_BLOCK_TYPES.VIZ_LOCATION },
      ],
    },
    {
      kind: "category",
      name: "Export",
      colour: "#16a34a",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.EXPORT_CSV },
        { kind: "block", type: STEPS_BLOCK_TYPES.EXPORT_PLOT },
      ],
    },
    {
      kind: "category",
      name: "Print",
      colour: "#64748b",
      contents: [{ kind: "block", type: STEPS_BLOCK_TYPES.PRINT }],
    },
    {
      kind: "category",
      name: "Naming",
      colour: "#9333ea",
      contents: [
        { kind: "block", type: STEPS_BLOCK_TYPES.SET },
        { kind: "block", type: STEPS_BLOCK_TYPES.GET },
        { kind: "block", type: STEPS_BLOCK_TYPES.RESTORE },
      ],
    },
    ...standardCategories,
  ],
};
