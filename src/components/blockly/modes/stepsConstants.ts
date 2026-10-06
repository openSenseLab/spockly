/**
 * Block type names and option lists for the "Data Flow" branch (Branch A).
 *
 * This branch teaches the pipeline mental model: data flows through connected
 * value blocks, and learners deliberately choose to observe output via `dsf_print`.
 */

export const STEPS_BLOCK_TYPES = {
  // Data sources (value → DataFrame)
  LOAD_CSV: "dsf_load_csv",
  LOAD_GEOJSON: "dsf_load_geojson",
  UPLOAD_CSV: "dsf_upload_csv",

  // Transformations (DataFrame → DataFrame)
  CLEAN_TYPES: "dsf_clean_types",
  CLEAN_MISSING: "dsf_clean_missing",
  CLEAN_FILTER: "dsf_clean_filter",
  CLEAN_DEDUP: "dsf_clean_dedup",
  ANALYZE_GROUPBY: "dsf_analyze_groupby",

  // Observations (DataFrame → DataFrame value, then print)
  ANALYZE_DESCRIBE: "dsf_analyze_describe",
  ANALYZE_CORRELATION: "dsf_analyze_correlation",
  ANALYZE_INSPECT: "dsf_analyze_inspect",
  ANALYZE_COUNT_CATEGORIES: "dsf_analyze_count_categories",
  ANALYZE_STATION_COMPARE: "dsf_analyze_station_compare",
  ANALYZE_HOURLY: "dsf_analyze_hourly",
  ANALYZE_HOUR_OF_DAY: "dsf_analyze_hour_of_day",
  SPATIAL_JOIN: "dsf_spatial_join",

  // Visualizations (DataFrame → Plot)
  VIZ_TIMESERIES: "dsf_viz_timeseries",
  VIZ_BAR: "dsf_viz_bar",
  VIZ_SCATTER: "dsf_viz_scatter",
  VIZ_LOCATION: "dsf_viz_location",
  VIZ_HOURLY_COMPARE: "dsf_viz_hourly_compare",
  VIZ_SCATTER_TEMP_HUM: "dsf_viz_scatter_temp_hum",

  // Exports (statement blocks)
  EXPORT_CSV: "dsf_export_csv",
  EXPORT_PLOT: "dsf_export_plot",

  // Print (statement block)
  PRINT: "dsf_print",

  // Naming & reuse (statement + value)
  SET: "dsf_set",
  GET: "dsf_get",
  RESTORE: "dsf_restore",
} as const;

export const STEPS_COLOR = 230;

/**
 * CSV data sources. Local files are served from the Vite `public/data` folder.
 *
 * Curated for the workshop: only the verified local Münster dataset is exposed.
 * Remote URLs (Iris, Penguins, Tips, openSenseMap) are hidden because they are
 * untested in the browser runtime and distract from the investigation.
 */
export const DATASETS = [
  ["Münster measurements (72h)", "/data/muenster_measurements_72h.csv"],
] as const;

/** GeoJSON data sources (spatial data). */
export const GEOJSON_SOURCES = [
  ["Münster stations", "/data/muenster_stations.geojson"],
] as const;

/** Column type conversions for the CLEAN_TYPES block. */
export const COLUMN_TYPES = [
  ["Date/time (datetime)", "DATETIME"],
  ["Number (numeric)", "NUMERIC"],
] as const;

/** Aggregation functions for the ANALYZE_GROUPBY block. */
export const AGGREGATIONS = [
  ["Mean", "mean"],
  ["Minimum", "min"],
  ["Maximum", "max"],
  ["Count", "count"],
  ["Sum", "sum"],
] as const;
