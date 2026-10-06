/**
 * Block type names and option lists for the "Unified block" branch (Branch C).
 *
 * This branch keeps the all-in-one monolithic blocks as a demo / starting point.
 * It teaches the big picture rather than the internal data-flow relationships.
 */

export const UNIFIED_BLOCK_TYPES = {
  EXPLORE_DATASET: "dst_explore_dataset",
  HEAT_ISLANDS_UNIFIED: "dst_heat_islands_unified",
  WORKSHOP_STARTER: "dst_workshop_starter",
} as const;

export const UNIFIED_COLOR = 210;

/**
 * CSV data sources. Local files are served from the Vite `public/data` folder.
 *
 * Curated for the workshop: only the verified local Münster dataset is exposed.
 * Remote URLs are hidden because they are untested in the browser runtime.
 */
export const UNIFIED_DATASETS = [
  ["Münster measurements (72h)", "/data/muenster_measurements_72h.csv"],
] as const;

export const UNIFIED_LOCATION_DATASETS = [
  ["Münster station locations", "/data/muenster_stations.geojson"],
] as const;

export const UNIFIED_PREPROCESSING_ACTIONS = [
  ["Clean sensor types, missing values, and duplicates", "CLEAN_SENSOR"],
  ["Drop missing values only", "CLEAN_MISSING"],
  ["Keep the raw rows", "NONE"],
] as const;

export const UNIFIED_STARTER_ANALYSES = [
  ["Average readings over time", "HOURLY_MEAN"],
  ["Compare stations to the city mean", "STATION_COMPARE"],
  ["Join station results to locations", "SPATIAL_JOIN"],
] as const;

export const UNIFIED_STARTER_OUTPUTS = [
  ["Time series plot", "TIMESERIES"],
  ["Station deviation plot + CSV", "DEVIATION"],
  ["Location map + CSV", "LOCATION"],
] as const;

/**
 * Generic analysis actions for the unified blocks.
 *
 * Curated for the workshop: the generic "Merge two datasets" action is removed
 * because it referenced an undefined `_other` variable and would crash.
 */
export const UNIFIED_ANALYSIS_ACTIONS = [
  ["Summary statistics (describe)", "SUMMARY_STATS"],
  ["Preview first 5 rows (head)", "PREVIEW_HEAD"],
  ["Dataset structure & types (info)", "DATA_INFO"],
  ["Correlation matrix (corr)", "CORRELATION"],
  ["Row & column dimensions (shape)", "SHAPE"],
  ["Group by and aggregate", "GROUPBY"],
] as const;

/**
 * Generic visualization types for the unified blocks.
 *
 * Curated for the workshop: the generic "Spatial scatter map" is removed because
 * it guessed spatial columns by numeric position (`iloc[:, 0..2]`), which is
 * unreliable. Use the dedicated location plot in the Data Flow branch instead.
 */
export const UNIFIED_VISUALIZATION_TYPES = [
  ["Histogram of numeric features", "HIST"],
  ["Box plot of distributions", "BOX"],
  ["Line chart", "LINE"],
  ["Bar chart (first 10 rows)", "BAR"],
  ["Time series line", "TIMESERIES"],
  ["Scatter plot", "SCATTER"],
] as const;

