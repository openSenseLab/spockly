/**
 * Block type names and option lists for the "Tasks" branch (Branch D).
 *
 * This branch abstracts data science into four predefined actionable step
 * categories — Load, Preprocess, Analyze, Output/Viz — each a single statement
 * block with dropdown selections for inputs and methods. Steps chain in a
 * user-defined order and pass data through explicit named variables.
 */

export const TASKS_BLOCK_TYPES = {
  LOAD: "dsr_load",
  PREPROCESS: "dsr_preprocess",
  ANALYZE: "dsr_analyze",
  OUTPUT: "dsr_output",
} as const;

export const TASKS_COLOR = 160;

/**
 * Data sources for the Load step.
 *
 * Curated for the workshop: only the verified local Münster dataset is exposed.
 * The GeoJSON source is flattened to x/y columns by the loader helper.
 */
export const TASKS_DATASETS = [
  ["Münster measurements (72h)", "/data/muenster_measurements_72h.csv"],
  ["Münster stations (GeoJSON)", "/data/muenster_stations.geojson"],
] as const;

/**
 * Preprocess methods. Each maps to a `_spockly_*` helper in `sharedHelpers`.
 * The `columns` array lists the column inputs the block should show for that
 * method (in order). `extra` lists any additional non-column inputs.
 */
export const TASKS_PREPROCESS_METHODS = [
  {
    label: "Convert column type",
    value: "CLEAN_TYPES",
    columns: ["COLUMN"],
    extra: ["TYPE"],
  },
  {
    label: "Drop rows with missing values",
    value: "CLEAN_MISSING",
    columns: ["COLUMN"],
    extra: [],
  },
  {
    label: "Filter to a value range",
    value: "CLEAN_FILTER",
    columns: ["COLUMN"],
    extra: ["MIN", "MAX"],
  },
  {
    label: "Remove duplicates",
    value: "CLEAN_DEDUP",
    columns: ["SUBSET"],
    extra: [],
  },
  {
    label: "Group by and aggregate",
    value: "GROUPBY",
    columns: ["GROUP_COLS", "VALUE_COL"],
    extra: ["AGG"],
  },
] as const;

/**
 * Analyze methods. Each maps to a `_spockly_*` helper in `sharedHelpers`.
 */
export const TASKS_ANALYZE_METHODS = [
  {
    label: "Summary statistics (describe)",
    value: "DESCRIBE",
    columns: [],
    extra: [],
  },
  {
    label: "Inspect the data",
    value: "INSPECT",
    columns: [],
    extra: [],
  },
  {
    label: "Count categories in a column",
    value: "COUNT_CATEGORIES",
    columns: ["COLUMN"],
    extra: [],
  },
  {
    label: "Compare stations",
    value: "STATION_COMPARE",
    columns: ["STATION_COL", "VALUE_COL"],
    extra: [],
  },
  {
    label: "Join with station locations",
    value: "SPATIAL_JOIN",
    columns: ["LOCATION_VAR", "KEY_COL"],
    extra: [],
  },
  {
    label: "Average into hourly intervals",
    value: "HOURLY",
    columns: ["VALUE_COL", "TIME_COL"],
    extra: [],
  },
  {
    label: "Summarize by hour of day",
    value: "HOUR_OF_DAY",
    columns: ["VALUE_COL", "TIME_COL"],
    extra: [],
  },
  {
    label: "Correlation matrix",
    value: "CORRELATION",
    columns: [],
    extra: [],
  },
] as const;

/**
 * Output/Viz methods. Each maps to a `_spockly_plot_*` helper or an export.
 * `kind` is "plot" (produces a figure) or "file" (writes a file).
 */
export const TASKS_OUTPUT_METHODS = [
  {
    label: "Time series line",
    value: "TIMESERIES",
    kind: "plot",
    columns: ["TIME_COL", "VALUE_COL"],
    extra: ["TITLE"],
  },
  {
    label: "Bar chart",
    value: "BAR",
    kind: "plot",
    columns: ["X_COL", "Y_COL"],
    extra: ["TITLE"],
  },
  {
    label: "Scatter plot",
    value: "SCATTER",
    kind: "plot",
    columns: ["X_COL", "Y_COL", "COLOR_COL"],
    extra: ["TITLE"],
  },
  {
    label: "Location map",
    value: "LOCATION",
    kind: "plot",
    columns: ["X_COL", "Y_COL", "COLOR_COL"],
    extra: ["TITLE"],
  },
  {
    label: "Hourly comparison",
    value: "HOURLY_COMPARE",
    kind: "plot",
    columns: ["TIME_COL", "VALUE_COL", "STATION_COL"],
    extra: ["TITLE"],
  },
  {
    label: "Export CSV",
    value: "EXPORT_CSV",
    kind: "file",
    columns: [],
    extra: ["FILENAME"],
  },
  {
    label: "Export plot",
    value: "EXPORT_PLOT",
    kind: "file",
    columns: [],
    extra: ["FILENAME"],
  },
] as const;

/** Column type conversions for the CLEAN_TYPES preprocess method. */
export const TASKS_COLUMN_TYPES = [
  ["Date/time (datetime)", "DATETIME"],
  ["Number (numeric)", "NUMERIC"],
] as const;

/** Aggregation functions for the GROUPBY preprocess method. */
export const TASKS_AGGREGATIONS = [
  ["Mean", "mean"],
  ["Minimum", "min"],
  ["Maximum", "max"],
  ["Count", "count"],
  ["Sum", "sum"],
] as const;
