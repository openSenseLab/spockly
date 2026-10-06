import * as Blockly from "blockly";
import {
  TASKS_AGGREGATIONS,
  TASKS_ANALYZE_METHODS,
  TASKS_BLOCK_TYPES,
  TASKS_COLOR,
  TASKS_COLUMN_TYPES,
  TASKS_DATASETS,
  TASKS_OUTPUT_METHODS,
  TASKS_PREPROCESS_METHODS,
} from "./tasksConstants";
import {
  FieldTasksColumn,
  FieldTasksMethod,
  FieldTasksVariable,
} from "./tasksFields";

/**
 * "Tasks" branch (Branch D) block definitions.
 *
 * The Tasks branch abstracts data science into four predefined actionable step
 * categories — Load, Preprocess, Analyze, Output/Viz — each a single statement
 * block with dropdown selections for inputs and methods. Steps chain in a
 * user-defined order and pass data through **explicit named variables**.
 *
 * Each block exposes a `rebuildInputs_()` method that removes the column inputs
 * for the previously selected method and appends the ones relevant to the
 * currently selected method. This keeps the block compact and readable.
 */

/** A tasks block with the dynamic-input helpers added by this module. */
type TasksBlock = Blockly.Block & {
  dynamicInputNames: string[];
  rebuildInputs_: () => void;
  refreshColumnFields: () => void;
};

/** Human-readable labels for the dynamic column / extra inputs. */
const INPUT_LABELS: Record<string, string> = {
  COLUMN: "column",
  GROUP_COLS: "group by",
  VALUE_COL: "value",
  TIME_COL: "time",
  STATION_COL: "station",
  LOCATION_VAR: "locations",
  KEY_COL: "key",
  X_COL: "x",
  Y_COL: "y",
  COLOR_COL: "color",
  SUBSET: "subset",
  TYPE: "type",
  MIN: "min",
  MAX: "max",
  AGG: "aggregate",
  TITLE: "title",
  FILENAME: "filename",
};

/** Build the `[label, value]` option tuples for a method dropdown. */
function methodOptions(
  methods: readonly { label: string; value: string }[],
): [string, string][] {
  return methods.map((m) => [m.label, m.value]);
}

/** Look up the method definition for a block type + method value. */
function getMethodDef(block: TasksBlock, value: string) {
  switch (block.type) {
    case TASKS_BLOCK_TYPES.PREPROCESS:
      return (
        TASKS_PREPROCESS_METHODS.find((m) => m.value === value) ??
        TASKS_PREPROCESS_METHODS[0]
      );
    case TASKS_BLOCK_TYPES.ANALYZE:
      return (
        TASKS_ANALYZE_METHODS.find((m) => m.value === value) ??
        TASKS_ANALYZE_METHODS[0]
      );
    case TASKS_BLOCK_TYPES.OUTPUT:
      return (
        TASKS_OUTPUT_METHODS.find((m) => m.value === value) ??
        TASKS_OUTPUT_METHODS[0]
      );
    default:
      return { columns: [], extra: [] };
  }
}

/** Create the field for a non-column "extra" input (type, bounds, title, …). */
function createExtraField(name: string): Blockly.Field {
  switch (name) {
    case "TYPE":
      return new Blockly.FieldDropdown(
        TASKS_COLUMN_TYPES.map((o) => [o[0], o[1]]),
      );
    case "MIN":
      return new Blockly.FieldNumber(-30);
    case "MAX":
      return new Blockly.FieldNumber(50);
    case "AGG":
      return new Blockly.FieldDropdown(
        TASKS_AGGREGATIONS.map((o) => [o[0], o[1]]),
      );
    case "TITLE":
      return new Blockly.FieldTextInput("Title");
    case "FILENAME":
      return new Blockly.FieldTextInput("result.csv");
    default:
      return new Blockly.FieldTextInput("");
  }
}

/**
 * Rebuild the block's dynamic inputs to match the currently selected method.
 * Removes the previous method's column/extra inputs and appends the new ones.
 */
function rebuildInputs_(this: TasksBlock): void {
  const methodValue = this.getFieldValue("METHOD");
  const methodDef = getMethodDef(this, methodValue);

  for (const name of this.dynamicInputNames) {
    this.removeInput(name, true);
  }
  this.dynamicInputNames = [];

  for (const colName of methodDef.columns) {
    const input = this.appendDummyInput(colName);
    input.appendField(INPUT_LABELS[colName] ?? colName);
    const field =
      colName === "LOCATION_VAR"
        ? new FieldTasksVariable()
        : new FieldTasksColumn();
    input.appendField(field, colName);
    this.dynamicInputNames.push(colName);
  }

  for (const extraName of methodDef.extra) {
    const input = this.appendDummyInput(extraName);
    input.appendField(INPUT_LABELS[extraName] ?? extraName);
    input.appendField(createExtraField(extraName), extraName);
    this.dynamicInputNames.push(extraName);
  }
}

/** Refresh the column dropdowns after the input variable changes. */
function refreshColumnFields(this: TasksBlock): void {
  for (const name of this.dynamicInputNames) {
    const field = this.getField(name);
    if (field instanceof FieldTasksColumn) {
      field.refreshOptions();
    }
  }
}

// --- Block init functions ---

function loadInit(this: Blockly.Block): void {
  this.setColour(TASKS_COLOR);
  this.setTooltip("Load a dataset into a named variable.");
  this.setPreviousStatement(true);
  this.setNextStatement(true);
  this.appendDummyInput("DATASET_ROW")
    .appendField("load")
    .appendField(
      new Blockly.FieldDropdown(TASKS_DATASETS.map((o) => [o[0], o[1]])),
      "DATASET",
    );
  this.appendDummyInput("OUTPUT_ROW")
    .appendField("as")
    .appendField(new Blockly.FieldTextInput("data"), "OUTPUT_VAR");
}

function preprocessInit(this: TasksBlock): void {
  this.setColour(TASKS_COLOR);
  this.setTooltip("Preprocess a variable (clean, filter, group, …).");
  this.setPreviousStatement(true);
  this.setNextStatement(true);
  this.dynamicInputNames = [];
  this.appendDummyInput("INPUT_ROW")
    .appendField("preprocess")
    .appendField(new FieldTasksVariable(), "INPUT_VAR")
    .appendField("using")
    .appendField(
      new FieldTasksMethod(methodOptions(TASKS_PREPROCESS_METHODS)),
      "METHOD",
    );
  this.appendDummyInput("OUTPUT_ROW")
    .appendField("as")
    .appendField(new Blockly.FieldTextInput("clean_data"), "OUTPUT_VAR");
  this.rebuildInputs_();
}

function analyzeInit(this: TasksBlock): void {
  this.setColour(TASKS_COLOR);
  this.setTooltip("Analyze a variable (describe, compare, correlate, …).");
  this.setPreviousStatement(true);
  this.setNextStatement(true);
  this.dynamicInputNames = [];
  this.appendDummyInput("INPUT_ROW")
    .appendField("analyze")
    .appendField(new FieldTasksVariable(), "INPUT_VAR")
    .appendField("using")
    .appendField(
      new FieldTasksMethod(methodOptions(TASKS_ANALYZE_METHODS)),
      "METHOD",
    );
  this.appendDummyInput("OUTPUT_ROW")
    .appendField("as")
    .appendField(new Blockly.FieldTextInput("result"), "OUTPUT_VAR");
  this.rebuildInputs_();
}

function outputInit(this: TasksBlock): void {
  this.setColour(TASKS_COLOR);
  this.setTooltip("Generate an output or visualization from a variable.");
  this.setPreviousStatement(true);
  this.setNextStatement(true);
  this.dynamicInputNames = [];
  this.appendDummyInput("INPUT_ROW")
    .appendField("output")
    .appendField(new FieldTasksVariable(), "INPUT_VAR")
    .appendField("using")
    .appendField(
      new FieldTasksMethod(methodOptions(TASKS_OUTPUT_METHODS)),
      "METHOD",
    );
  this.rebuildInputs_();
}

Blockly.common.defineBlocks({
  [TASKS_BLOCK_TYPES.LOAD]: {
    init: loadInit,
  },
  [TASKS_BLOCK_TYPES.PREPROCESS]: {
    init: preprocessInit,
    rebuildInputs_: rebuildInputs_,
    refreshColumnFields: refreshColumnFields,
  },
  [TASKS_BLOCK_TYPES.ANALYZE]: {
    init: analyzeInit,
    rebuildInputs_: rebuildInputs_,
    refreshColumnFields: refreshColumnFields,
  },
  [TASKS_BLOCK_TYPES.OUTPUT]: {
    init: outputInit,
    rebuildInputs_: rebuildInputs_,
    refreshColumnFields: refreshColumnFields,
  },
});
