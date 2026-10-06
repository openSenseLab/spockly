import type { Block } from "blockly";
import { type PythonGenerator, pythonGenerator } from "blockly/python";
import { UNIFIED_BLOCK_TYPES } from "./unifiedConstants";
import {
  generateAnalysisCode,
  generateHeatIslandsUnifiedCode,
  generateLoadCode,
  generateVisualizationCode,
  generateWorkshopStarterCode,
} from "./unifiedHelpers";
import { sanitizePythonIdentifier } from "./sharedHelpers";

/**
 * "Unified block" branch (Branch C) Python generators.
 *
 * These are monolithic statement blocks that emit a full analysis workflow.
 */

function getBlockVarName(block: Block): string {
  const fieldText = block.getField("VAR")?.getText();
  if (fieldText) {
    return fieldText;
  }
  return block.getFieldValue("VAR") || "df";
}

pythonGenerator.forBlock[UNIFIED_BLOCK_TYPES.EXPLORE_DATASET] = function (
  block: Block,
  generator: PythonGenerator,
) {
  const datasetUrl = block.getFieldValue("DATASET_URL");
  const varName = sanitizePythonIdentifier(getBlockVarName(block));
  const action = block.getFieldValue("ACTION");
  const chartType = block.getFieldValue("CHART_TYPE");
  const title = block.getFieldValue("TITLE") || "Dataset Distribution";

  const loadCode = generateLoadCode(generator, datasetUrl, varName);
  const analysisCode = generateAnalysisCode(generator, action, varName);
  const vizCode = generateVisualizationCode(
    generator,
    chartType,
    title,
    varName,
  );

  return [
    `# ========================================`,
    `# Unified block: Explore Dataset (${varName})`,
    `# ========================================`,
    loadCode,
    analysisCode,
    vizCode,
  ].join("\n");
};

pythonGenerator.forBlock[UNIFIED_BLOCK_TYPES.HEAT_ISLANDS_UNIFIED] =
  function (_block: Block, generator: PythonGenerator) {
    return generateHeatIslandsUnifiedCode(generator);
  };

pythonGenerator.forBlock[UNIFIED_BLOCK_TYPES.WORKSHOP_STARTER] = function (
  block: Block,
  generator: PythonGenerator,
) {
  const dataset = block.getFieldValue("DATASET") || "/data/muenster_measurements_72h.csv";
  const preprocess = block.getFieldValue("PREPROCESS") || "CLEAN_SENSOR";
  const analysis = block.getFieldValue("ANALYSIS") || "HOURLY_MEAN";
  const output = block.getFieldValue("OUTPUT") || "TIMESERIES";
  const locationDataset = block.getFieldValue("LOCATION_DATASET") || "/data/muenster_stations.geojson";
  const title = block.getFieldValue("TITLE") || "Münster temperature investigation";
  return generateWorkshopStarterCode(
    generator,
    output,
    title,
    dataset,
    locationDataset,
    preprocess,
    analysis,
  );
};
