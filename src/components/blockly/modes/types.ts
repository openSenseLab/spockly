/**
 * The three pedagogical "branches" (pitches) of the data-science block system.
 *
 * They are conceptually separate alternatives (like git branches) but live in one
 * runnable project so experts can switch between them in the same tool.
 */
export type DsMode = "steps" | "unified" | "tasks";

export const DS_MODES: { value: DsMode; label: string; description: string }[] = [
  {
    value: "steps",
    label: "Steps",
    description:
      "Workflow-step blocks: a sequential chain of statement blocks. Each step transforms the working table (df) or plot, so you build the investigation one step at a time.",
  },
  {
    value: "unified",
    label: "Unified block",
    description:
      "A single block runs a complete investigation and keeps the named results inspectable. A guided starting point.",
  },
  {
    value: "tasks",
    label: "Tasks",
    description:
      "Task-based blocks: abstract data science into four predefined actionable tasks — Load, Preprocess, Analyze, Output/Viz — each a single block with dropdown selections for inputs and methods, chained in any order.",
  },
];

/** Blockly output type names used by the data-science blocks. */
export const DS_OUTPUT_TYPES = {
  DATAFRAME: "DataFrame",
  PLOT: "Plot",
  STRING: "String",
} as const;
