import * as Blockly from "blockly";
import { pythonGenerator, Order } from "blockly/python";

pythonGenerator.forBlock["example_block"] = function (block) {
  const code = "example_code";
  return [code, Order.ATOMIC];
};
