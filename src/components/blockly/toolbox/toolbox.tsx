import * as Blockly from "blockly";
import { t } from "../../../i18n";
import "./toolbox.css";

export const standardToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: t("toolbox.logic"),
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
      name: t("toolbox.loops"),
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
      name: t("toolbox.math"),
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
      name: t("toolbox.text"),
      categorystyle: "text_category",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "text_join" },
        { kind: "block", type: "text_print" },
      ],
    },
    {
      kind: "category",
      name: t("toolbox.lists"),
      categorystyle: "list_category",
      contents: [
        { kind: "block", type: "lists_create_with" },
        { kind: "block", type: "lists_length" },
        { kind: "block", type: "lists_getIndex" },
      ],
    },
    {
      kind: "category",
      name: t("toolbox.variables"),
      categorystyle: "variable_category",
      custom: Blockly.VARIABLE_CATEGORY_NAME,
    },
    {
      kind: "category",
      name: t("toolbox.functions"),
      categorystyle: "procedure_category",
      custom: Blockly.PROCEDURE_CATEGORY_NAME,
    },
    {
      kind: "category",
      name: t("toolbox.examples"),
      cssConfig: {
        row: "blocklyToolboxCategory example_category",
      },
      categorystyle: "example_category",
      contents: [{ kind: "block", type: "example_block" }],
    },
  ],
};
