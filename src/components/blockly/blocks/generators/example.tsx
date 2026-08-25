import { pythonGenerator, Order } from "blockly/python";

pythonGenerator.forBlock["example_block"] = function () {
  const code = "example_code";
  return [code, Order.ATOMIC];
};
