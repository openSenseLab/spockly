import * as Blockly from "blockly";

const examples = [
  {
    type: "example_block",
    tooltip: "",
    helpUrl: "",
    message0: "Example Block %1",
    colour: 225,
    output: "String",

    args0: [
      {
        type: "input_value",
        name: "TEXT",
        check: "String",
      },
    ],
  },
];

Blockly.common.defineBlocksWithJsonArray(examples);
