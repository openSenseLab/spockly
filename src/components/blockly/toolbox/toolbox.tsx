import * as Blockly from "blockly";
import "./toolbox.css";

export const standardToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Logic",
      categorystyle: "logic_category",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      categorystyle: "loop_category",
      contents: [
        { kind: "block", type: "controls_repeat_ext" },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for" },
        { kind: "block", type: "controls_forEach" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_single" },
        { kind: "block", type: "math_round" },
      ],
    },
    {
      kind: "category",
      name: "Text",
      categorystyle: "text_category",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "text_join" },
        { kind: "block", type: "text_print" },
      ],
    },
    {
      kind: "category",
      name: "Lists",
      categorystyle: "list_category",
      contents: [
        { kind: "block", type: "lists_create_with" },
        { kind: "block", type: "lists_length" },
        { kind: "block", type: "lists_getIndex" },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      categorystyle: "variable_category",
      custom: Blockly.VARIABLE_CATEGORY_NAME,
    },
    {
      kind: "category",
      name: "Functions",
      categorystyle: "procedure_category",
      custom: Blockly.PROCEDURE_CATEGORY_NAME,
    },
    {
      kind: "category",
      name: "Examples",
      cssConfig: {
        row: "blocklyToolboxCategory example_category",
      },
      categorystyle: "example_category",
      contents: [{ kind: "block", type: "example_block" }],
    },
  ],
};
