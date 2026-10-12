import * as Blockly from "blockly";

import { t } from "../../../i18n";

const examples = [
  {
    type: "example_block",
    tooltip: "",
    helpUrl: "",
    message0: t("block.example"),
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
