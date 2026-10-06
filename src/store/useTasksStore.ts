import { create } from "zustand";
import type { DataPreview } from "../hooks/usePythonRunner";

/**
 * Tasks-mode state.
 *
 * The "Tasks" branch abstracts data science into four predefined actionable
 * step categories (Load, Preprocess, Analyze, Output/Viz), each a single block
 * with dropdown selections for inputs and methods. Steps chain in a user-defined
 * order and pass data through **explicit named variables**.
 *
 * This store holds the dynamic options that the tasks blocks' dropdowns need:
 *  - `tasksVariables`: the ordered list of named outputs produced by the tasks
 *    steps currently in the workspace (derived from the block chain).
 *  - `tasksVariableColumns`: for each named variable, the list of columns the
 *    loaded dataframe actually has. Populated from the Python worker after a run
 *    (the worker reports a `csvPreview` for every DataFrame in scope).
 */

type TasksState = {
  /** Ordered named outputs produced by tasks steps in the workspace. */
  tasksVariables: string[];
  /** Variable name → column names (from the loaded dataframe). */
  tasksVariableColumns: Record<string, string[]>;
  setTasksVariables: (variables: string[]) => void;
  setTasksVariableColumns: (columns: Record<string, string[]>) => void;
  resetTasks: () => void;
};

/**
 * Parse the header row of a CSV preview string into column names.
 *
 * The worker's `csvPreview` is `df.head(100).to_csv(index=False)`, so the first
 * line is the comma-separated header. We reuse the same quote-aware parsing that
 * `DataView` uses so column names containing commas (e.g. station names) survive.
 */
export function columnsFromPreview(preview: DataPreview): string[] {
  const csv = preview.csvPreview;
  if (!csv) {
    return [];
  }
  const firstLine = csv.split("\n")[0];
  if (!firstLine) {
    return [];
  }
  return parseCsvLine(firstLine).map((cell) => cell.trim());
}

/** Parse a single CSV line into cells, handling quoted fields with commas. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasksVariables: [],
  tasksVariableColumns: {},
  setTasksVariables: (tasksVariables) => set({ tasksVariables }),
  setTasksVariableColumns: (tasksVariableColumns) =>
    set({ tasksVariableColumns }),
  resetTasks: () =>
    set({ tasksVariables: [], tasksVariableColumns: {} }),
}));
