import * as Blockly from "blockly";
import { pythonGenerator } from "blockly/python";

pythonGenerator.forBlock["example_block"] = function (block) {
  const code = "example_code";
  return [code, pythonGenerator.ORDER_ATOMIC];
};
