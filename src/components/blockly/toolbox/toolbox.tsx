import * as Blockly from "blockly";
import "./toolbox.css";

/**
 * Standard Blockly categories kept available to every branch.
 *
 * Curated for the workshop: only the categories learners actually need for the
 * Münster investigation are exposed. Loops, Lists, Functions, and the undefined
 * example block are hidden to reduce clutter and avoid undefined behaviour.
 * Text and Math remain available because column/value inputs rely on them.
 */
export const standardCategories = [
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
    name: "Variables",
    categorystyle: "variable_category",
    custom: Blockly.VARIABLE_CATEGORY_NAME,
  },
];
