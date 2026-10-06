import type { Block } from "blockly";
import { type PythonGenerator, pythonGenerator } from "blockly/python";
import { TASKS_BLOCK_TYPES } from "./tasksConstants";
import {
  ensureSpocklyHelpers,
  ensureMatplotlibImport,
  ensureNumpyImport,
  ensurePandasImport,
  escapePythonString,
  generateExportCsvCode,
  generateExportPlotCode,
  sanitizePythonIdentifier,
} from "./sharedHelpers";

/**
 * "Tasks" branch (Branch D) Python generators.
 *
 * Each tasks block reads its input variable, applies the selected method, and
 * assigns the result to its output variable. Steps chain in a user-defined order
 * and pass data through explicit named variables.
 *
 * The generators reuse the `_spockly_*` helper functions registered by
 * `ensureSpocklyHelpers`, so no Python helpers need to be reimplemented.
 */

/** Read a field value as a Python string literal, falling back to a default. */
function fieldString(
  block: Block,
  name: string,
  fallback: string,
): string {
  const value = block.getFieldValue(name);
  return value ? escapePythonString(String(value)) : fallback;
}

/** Read a field value as a raw Python expression (e.g. a number). */
function fieldRaw(block: Block, name: string, fallback: string): string {
  const value = block.getFieldValue(name);
  return value !== null && value !== undefined && value !== ""
    ? String(value)
    : fallback;
}

/** Read a column dropdown value as a Python string literal. */
function columnString(block: Block, name: string, fallback: string): string {
  const value = block.getFieldValue(name);
  return value ? escapePythonString(String(value)) : fallback;
}

// --- Load ---

pythonGenerator.forBlock[TASKS_BLOCK_TYPES.LOAD] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensurePandasImport(generator);
  const dataset = block.getFieldValue("DATASET");
  const outputVar = sanitizePythonIdentifier(
    block.getFieldValue("OUTPUT_VAR") || "data",
  );

  if (dataset.endsWith(".geojson")) {
    ensureSpocklyHelpers(generator);
    return [
      `# Load GeoJSON into '${outputVar}'`,
      `${outputVar} = _spockly_load_geojson("${escapePythonString(dataset)}")`,
      `print(f"Loaded '${outputVar}': {len(${outputVar})} features")`,
      "",
    ].join("\n");
  }

  return [
    `# Load CSV into '${outputVar}'`,
    `${outputVar} = pd.read_csv("${escapePythonString(dataset)}")`,
    `print(f"Loaded '${outputVar}': {len(${outputVar})} rows, {len(${outputVar}.columns)} columns")`,
    "",
  ].join("\n");
};

// --- Preprocess ---

pythonGenerator.forBlock[TASKS_BLOCK_TYPES.PREPROCESS] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const inputVar = sanitizePythonIdentifier(
    block.getFieldValue("INPUT_VAR") || "data",
  );
  const outputVar = sanitizePythonIdentifier(
    block.getFieldValue("OUTPUT_VAR") || "clean_data",
  );
  const method = block.getFieldValue("METHOD");

  switch (method) {
    case "CLEAN_TYPES": {
      const column = columnString(block, "COLUMN", "measurement_timestamp");
      const type = block.getFieldValue("TYPE") || "DATETIME";
      return [
        `# Convert column ${column} to ${type}`,
        `${outputVar} = _spockly_clean_types(${inputVar}, "${column}", "${type}")`,
        "",
      ].join("\n");
    }
    case "CLEAN_MISSING": {
      const column = columnString(block, "COLUMN", "temperature");
      return [
        `# Drop rows with missing values in ${column}`,
        `${outputVar} = _spockly_clean_missing(${inputVar}, "DROP_NA_COLUMN", "${column}")`,
        "",
      ].join("\n");
    }
    case "CLEAN_FILTER": {
      const column = columnString(block, "COLUMN", "temperature");
      const min = fieldRaw(block, "MIN", "-30");
      const max = fieldRaw(block, "MAX", "50");
      return [
        `# Keep rows where ${column} is between ${min} and ${max}`,
        `${outputVar} = _spockly_clean_filter(${inputVar}, "${column}", ${min}, ${max})`,
        "",
      ].join("\n");
    }
    case "CLEAN_DEDUP": {
      const subset = columnString(block, "SUBSET", "device_id, measurement_timestamp");
      const subsetList = subset
        .split(",")
        .map((s) => `"${s.trim()}"`)
        .filter((s) => s !== '""')
        .join(", ");
      return [
        `# Remove duplicate rows (subset: ${subset})`,
        `${outputVar} = _spockly_clean_dedup(${inputVar}, [${subsetList}])`,
        "",
      ].join("\n");
    }
    case "GROUPBY": {
      const groupCols = columnString(block, "GROUP_COLS", "device_id");
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      const agg = block.getFieldValue("AGG") || "mean";
      const groupList = groupCols
        .split(",")
        .map((s) => `"${s.trim()}"`)
        .filter((s) => s !== '""')
        .join(", ");
      return [
        `# Group by [${groupList}] and aggregate ${valueCol} (${agg})`,
        `${outputVar} = _spockly_groupby(${inputVar}, [${groupList}], "${valueCol}", "${agg}")`,
        "",
      ].join("\n");
    }
    default:
      return `# Unknown preprocess method '${method}'\n`;
  }
};

// --- Analyze ---

pythonGenerator.forBlock[TASKS_BLOCK_TYPES.ANALYZE] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensurePandasImport(generator);
  const inputVar = sanitizePythonIdentifier(
    block.getFieldValue("INPUT_VAR") || "data",
  );
  const outputVar = sanitizePythonIdentifier(
    block.getFieldValue("OUTPUT_VAR") || "result",
  );
  const method = block.getFieldValue("METHOD");

  switch (method) {
    case "DESCRIBE":
      return [
        `# Summary statistics`,
        `${outputVar} = ${inputVar}.describe()`,
        "",
      ].join("\n");
    case "INSPECT":
      return [
        `# Inspect the data`,
        `${outputVar} = _spockly_inspect(${inputVar})`,
        "",
      ].join("\n");
    case "COUNT_CATEGORIES": {
      const column = columnString(block, "COLUMN", "flag_temperature");
      return [
        `# Count categories in ${column}`,
        `${outputVar} = _spockly_count_categories(${inputVar}, "${column}")`,
        "",
      ].join("\n");
    }
    case "STATION_COMPARE": {
      const stationCol = columnString(block, "STATION_COL", "device_id");
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      return [
        `# Compare stations with a reference`,
        `${outputVar} = _spockly_station_compare(${inputVar}, "${stationCol}", "${valueCol}")`,
        "",
      ].join("\n");
    }
    case "SPATIAL_JOIN": {
      const locationVar = sanitizePythonIdentifier(
        block.getFieldValue("LOCATION_VAR") || "stations",
      );
      const keyCol = columnString(block, "KEY_COL", "device_id");
      return [
        `# Join station summaries with their location data`,
        `${outputVar} = _spockly_spatial_join(${inputVar}, ${locationVar}, "${keyCol}")`,
        "",
      ].join("\n");
    }
    case "HOURLY": {
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      const timeCol = columnString(block, "TIME_COL", "measurement_timestamp");
      return [
        `# Average readings into hourly intervals`,
        `${outputVar} = _spockly_hourly(${inputVar}, "${valueCol}", "${timeCol}")`,
        "",
      ].join("\n");
    }
    case "HOUR_OF_DAY": {
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      const timeCol = columnString(block, "TIME_COL", "measurement_timestamp");
      return [
        `# Summarize by hour of day`,
        `${outputVar} = _spockly_hour_of_day(${inputVar}, "${valueCol}", "${timeCol}")`,
        "",
      ].join("\n");
    }
    case "CORRELATION": {
      ensureNumpyImport(generator);
      return [
        `# Correlation matrix of numeric columns`,
        `${outputVar} = ${inputVar}.select_dtypes(include=[np.number]).corr()`,
        "",
      ].join("\n");
    }
    default:
      return `# Unknown analyze method '${method}'\n`;
  }
};

// --- Output / Viz ---

pythonGenerator.forBlock[TASKS_BLOCK_TYPES.OUTPUT] = function (
  block: Block,
  generator: PythonGenerator,
) {
  ensureSpocklyHelpers(generator);
  ensureMatplotlibImport(generator);
  const inputVar = sanitizePythonIdentifier(
    block.getFieldValue("INPUT_VAR") || "data",
  );
  const method = block.getFieldValue("METHOD");

  switch (method) {
    case "TIMESERIES": {
      const timeCol = columnString(block, "TIME_COL", "measurement_timestamp");
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      const title = fieldString(block, "TITLE", "Time series");
      return [
        `# Time series: ${valueCol} over ${timeCol}`,
        `plot = _spockly_plot_timeseries(${inputVar}, "${timeCol}", "${valueCol}", "${title}")`,
        "",
      ].join("\n");
    }
    case "BAR": {
      const xCol = columnString(block, "X_COL", "device_name");
      const yCol = columnString(block, "Y_COL", "deviation");
      const title = fieldString(block, "TITLE", "Bar chart");
      return [
        `# Bar chart: ${xCol} vs ${yCol}`,
        `plot = _spockly_plot_bar(${inputVar}, "${xCol}", "${yCol}", "${title}")`,
        "",
      ].join("\n");
    }
    case "SCATTER": {
      const xCol = columnString(block, "X_COL", "x");
      const yCol = columnString(block, "Y_COL", "y");
      const colorCol = columnString(block, "COLOR_COL", "");
      const title = fieldString(block, "TITLE", "Scatter plot");
      return [
        `# Scatter: ${xCol} vs ${yCol}`,
        `plot = _spockly_plot_scatter(${inputVar}, "${xCol}", "${yCol}", "${colorCol}", "${title}")`,
        "",
      ].join("\n");
    }
    case "LOCATION": {
      const xCol = columnString(block, "X_COL", "x");
      const yCol = columnString(block, "Y_COL", "y");
      const colorCol = columnString(block, "COLOR_COL", "deviation");
      const title = fieldString(block, "TITLE", "Münster station locations");
      return [
        `# Location map: ${xCol} vs ${yCol} colored by ${colorCol}`,
        `plot = _spockly_plot_location(${inputVar}, "${xCol}", "${yCol}", "${colorCol}", "${title}")`,
        "",
      ].join("\n");
    }
    case "HOURLY_COMPARE": {
      const timeCol = columnString(block, "TIME_COL", "measurement_timestamp");
      const valueCol = columnString(block, "VALUE_COL", "temperature");
      const stationCol = columnString(block, "STATION_COL", "device_id");
      const title = fieldString(block, "TITLE", "Hourly comparison");
      return [
        `# Hourly comparison: ${valueCol} over ${timeCol}`,
        `plot = _spockly_plot_hourly_compare(${inputVar}, "${timeCol}", "${valueCol}", "${stationCol}", "${title}")`,
        "",
      ].join("\n");
    }
    case "EXPORT_CSV": {
      const filename = block.getFieldValue("FILENAME") || "result.csv";
      return generateExportCsvCode(generator, inputVar, filename);
    }
    case "EXPORT_PLOT": {
      const filename = block.getFieldValue("FILENAME") || "plot.png";
      return generateExportPlotCode(generator, "plot", filename);
    }
    default:
      return `# Unknown output method '${method}'\n`;
  }
};
