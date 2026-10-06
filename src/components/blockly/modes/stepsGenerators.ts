import type { Block } from "blockly";
import { type PythonGenerator, pythonGenerator, Order } from "blockly/python";
import { STEPS_BLOCK_TYPES } from "./stepsConstants";
import {
  ensureSpocklyHelpers,
  ensureMatplotlibImport,
  ensureNumpyImport,
  ensurePandasImport,
  escapePythonString,
  generateExportCsvCode,
  generateExportPlotCode,
  parseCommaSeparatedList,
  sanitizePythonIdentifier,
} from "./sharedHelpers";

/**
 * "Data Flow" branch (Branch A) Python generators.
 *
 * These are **statement blocks** that stack vertically. Each block reassigns the
 * implicit pipeline variable (`df` for dataframes, `plot` for plots), so the
 * dataframe flows through the chain without explicit value wiring.
 *
 * - Data sources / transforms / observations emit `df = ...`.
 * - Visualizations emit `plot = ...`.
 * - Exports / print emit statements.
 * - `set` snapshots `df`/`plot` into a named variable; `get` re-injects it.
 */

/** Read a value input as code, falling back to a default string literal. */
function valueCode(
  generator: PythonGenerator,
  block: Block,
  inputName: string,
  fallback: string,
): string {
  const code = generator.valueToCode(block, inputName, Order.NONE);
  return code || fallback;
}

// --- Data sources (statement → df) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.LOAD_CSV] = function (
  _block: Block,
  generator: PythonGenerator,
) {
  ensurePandasImport(generator);
  const source = _block.getFieldValue("SOURCE");
  const cleanSource = escapePythonString(source.trim());
  return `# Load CSV into the dataframe (separator detected)\n# (Obtain: bring data in)\ndf = pd.read_csv("${cleanSource}", sep=None, engine="python", encoding="utf-8")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.LOAD_GEOJSON] = function (
  _block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const source = _block.getFieldValue("SOURCE");
  const cleanSource = escapePythonString(source.trim());
  return `# Load GeoJSON and flatten features to x/y\n# (Obtain: bring spatial data in)\ndf = _spockly_load_geojson("${cleanSource}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.UPLOAD_CSV] = function (
  _block: Block,
  generator: PythonGenerator,
) {
  ensurePandasImport(generator);
  return `# Load your uploaded CSV\n# (Obtain: bring data in)\ndf = pd.read_csv("/data/uploaded.csv")\n`;
};

// --- Transformations (df → df) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.CLEAN_TYPES] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const column = valueCode(generator, block, "COLUMN", '"column"');
  const type = block.getFieldValue("TYPE");
  return `# Convert column ${column} to ${type}\n# (Scrub: fix data types)\ndf = _spockly_clean_types(df, ${column}, "${type}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.CLEAN_MISSING] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const column = valueCode(generator, block, "COLUMN", '"temperature"');
  return `# Drop rows with missing values in ${column}\n# (Scrub: clean the data)\ndf = _spockly_clean_missing(df, "DROP_NA_COLUMN", ${column})\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.CLEAN_FILTER] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const column = valueCode(generator, block, "COLUMN", '"column"');
  const min = valueCode(generator, block, "MIN", "-30");
  const max = valueCode(generator, block, "MAX", "50");
  return `# Keep rows where ${column} is between ${min} and ${max}\n# (Scrub: filter to plausible values)\ndf = _spockly_clean_filter(df, ${column}, ${min}, ${max})\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.CLEAN_DEDUP] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const subsetCode = valueCode(generator, block, "SUBSET", '""');
  const subset = parseCommaSeparatedList(subsetCode);
  return `# Remove duplicate rows (subset: ${subset})\n# (Scrub: deduplicate)\ndf = _spockly_clean_dedup(df, ${subset})\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_GROUPBY] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const groupColsCode = valueCode(generator, block, "GROUP_COLS", '"device_id"');
  const groupCols = parseCommaSeparatedList(groupColsCode);
  const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
  const agg = block.getFieldValue("AGG") || "mean";
  return `# Group by ${groupCols} and aggregate ${valueCol} (${agg})\n# (Explore: find patterns)\ndf = _spockly_groupby(df, ${groupCols}, ${valueCol}, "${agg}")\n`;
};

// --- Observations (df → df) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_DESCRIBE] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensurePandasImport(generator);
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "summary");
  return `# Summary statistics (kept separate from the working table)\n# (Explore: describe the data)\n${varName} = df.describe()\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_CORRELATION] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensurePandasImport(generator);
  ensureNumpyImport(generator);
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "correlation");
  return `# Correlation matrix of numeric columns (kept separate from the working table)\n# (Explore: find relationships)\n${varName} = df.select_dtypes(include=[np.number]).corr()\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_INSPECT] = function (
  _block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  return `# Inspect the working table\n# (Explore: understand the data)\n_spockly_inspect(df)\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_COUNT_CATEGORIES] =
  function (block: Block, generator: PythonGenerator) {
    ensureSpocklyHelpers(generator);
    ensurePandasImport(generator);
    const column = valueCode(generator, block, "COLUMN", '"flag_temperature"');
    const varName = sanitizePythonIdentifier(
      block.getFieldValue("VAR") || "category_counts",
    );
    return `# Count categories in ${column}\n# (Explore: inspect quality)\n${varName} = _spockly_count_categories(df, ${column})\n`;
  };

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_STATION_COMPARE] =
  function (block: Block, generator: PythonGenerator) {
    ensureSpocklyHelpers(generator);
    ensurePandasImport(generator);
    const stationCol = valueCode(generator, block, "STATION_COL", '"device_id"');
    const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
    const varName = sanitizePythonIdentifier(
      block.getFieldValue("VAR") || "station_stats",
    );
    return `# Compare stations with a reference\n# (Explore: find patterns)\n${varName} = _spockly_station_compare(df, ${stationCol}, ${valueCol})\n`;
  };

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_HOURLY] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
  const timeCol = valueCode(generator, block, "TIME_COL", '"measurement_timestamp"');
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "hourly");
  return `# Average readings into hourly intervals\n# (Explore: smooth variation)\n${varName} = _spockly_hourly(df, ${valueCol}, ${timeCol})\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.ANALYZE_HOUR_OF_DAY] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
  const timeCol = valueCode(generator, block, "TIME_COL", '"measurement_timestamp"');
  const varName = sanitizePythonIdentifier(
    block.getFieldValue("VAR") || "hour_of_day",
  );
  return `# Summarize by hour of day\n# (Explore: find the daily cycle)\n${varName} = _spockly_hour_of_day(df, ${valueCol}, ${timeCol})\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.SPATIAL_JOIN] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const summary = valueCode(generator, block, "SUMMARY", "station_stats");
  const locations = valueCode(generator, block, "LOCATIONS", "stations");
  const key = valueCode(generator, block, "KEY", '"device_id"');
  const varName = sanitizePythonIdentifier(
    block.getFieldValue("VAR") || "station_map",
  );
  return `# Join station summaries to locations (IDs matched as text)\n# (Explore: combine datasets)\n${varName} = _spockly_spatial_join(${summary}, ${locations}, ${key})\n`;
};

// --- Visualizations (df → plot) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_TIMESERIES] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const timeCol = valueCode(generator, block, "TIME_COL", '"measurement_timestamp"');
  const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
  const title = escapePythonString(block.getFieldValue("TITLE") || "Time series");
  return `# Time series: ${valueCol} over ${timeCol}\n# (Interpret: visualize the trend)\nplot = _spockly_plot_timeseries(df, ${timeCol}, ${valueCol}, "${title}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_BAR] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const xCol = valueCode(generator, block, "X_COL", '"device_name"');
  const yCol = valueCode(generator, block, "Y_COL", '"deviation"');
  const title = escapePythonString(block.getFieldValue("TITLE") || "Bar chart");
  return `# Bar chart: ${xCol} vs ${yCol}\n# (Interpret: compare categories)\nplot = _spockly_plot_bar(df, ${xCol}, ${yCol}, "${title}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_SCATTER] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const xCol = valueCode(generator, block, "X_COL", '"x"');
  const yCol = valueCode(generator, block, "Y_COL", '"y"');
  const colorCol = valueCode(generator, block, "COLOR_COL", '""');
  const title = escapePythonString(block.getFieldValue("TITLE") || "Scatter plot");
  return `# Scatter: ${xCol} vs ${yCol}\n# (Interpret: see relationships)\nplot = _spockly_plot_scatter(df, ${xCol}, ${yCol}, ${colorCol}, "${title}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_LOCATION] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const xCol = valueCode(generator, block, "X_COL", '"x"');
  const yCol = valueCode(generator, block, "Y_COL", '"y"');
  const colorCol = valueCode(generator, block, "COLOR_COL", '"deviation"');
  const title = escapePythonString(
    block.getFieldValue("TITLE") || "Münster station locations",
  );
  return `# Location map: ${xCol} vs ${yCol} colored by ${colorCol}\n# (Interpret: see where the hotspots are)\nplot = _spockly_plot_location(df, ${xCol}, ${yCol}, ${colorCol}, "${title}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_HOURLY_COMPARE] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const timeCol = valueCode(generator, block, "TIME_COL", '"measurement_timestamp"');
  const valueCol = valueCode(generator, block, "VALUE_COL", '"temperature"');
  const stationCol = valueCode(generator, block, "STATION_COL", '"device_id"');
  const title = escapePythonString(block.getFieldValue("TITLE") || "Hourly comparison");
  return `# Hourly comparison: ${valueCol} over ${timeCol}\n# (Interpret: compare over time)\nplot = _spockly_plot_hourly_compare(df, ${timeCol}, ${valueCol}, ${stationCol}, "${title}")\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.VIZ_SCATTER_TEMP_HUM] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const title = escapePythonString(block.getFieldValue("TITLE") || "Temperature vs humidity");
  return `# Scatter temperature vs humidity\n# (Interpret: see relationships)\nplot = _spockly_plot_scatter_temp_hum(df, "${title}")\n`;
};

// --- Exports (statement blocks) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.EXPORT_CSV] = function (
  block: Block,
  generator: PythonGenerator,
) {
  const filename = block.getFieldValue("FILENAME") || "result.csv";
  return generateExportCsvCode(generator, "df", filename);
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.EXPORT_PLOT] = function (
  block: Block,
  generator: PythonGenerator,
) {
  const filename = block.getFieldValue("FILENAME") || "plot.png";
  return generateExportPlotCode(generator, "plot", filename);
};

// --- Print (statement block) ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.PRINT] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  const what = block.getFieldValue("WHAT") || "df";
  let value: string;
  if (what === "plot") {
    value = "plot";
  } else if (what === "var") {
    value = valueCode(generator, block, "VALUE", '""');
  } else {
    value = "df";
  }
  return `# Observe the result\n# (Interpret: look at what the data says)\n_spockly_print(${value})\n`;
};

// --- Naming & reuse ---

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.SET] = function (
  block: Block,
) {
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "result");
  const what = block.getFieldValue("WHAT") || "df";
  const value = what === "plot" ? "plot" : "df";
  // Snapshot an independent copy so later mutations of the working table do not
  // change the saved value.
  const copyExpr = what === "plot" ? value : `${value}.copy()`;
  return `${varName} = ${copyExpr}\n`;
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.GET] = function (
  block: Block,
) {
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "result");
  return [varName, Order.ATOMIC];
};

pythonGenerator.forBlock[STEPS_BLOCK_TYPES.RESTORE] = function (
  block: Block,
) {
  const varName = sanitizePythonIdentifier(block.getFieldValue("VAR") || "data");
  return `# Restore a saved dataframe as the working table\n# (Explore: reuse a saved result)\ndf = ${varName}.copy()\n`;
};
