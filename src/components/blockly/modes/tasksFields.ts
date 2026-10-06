import * as Blockly from "blockly";
import { useTasksStore } from "../../../store/useTasksStore";

/**
 * Custom dynamic dropdown fields for the "Tasks" branch (Branch D).
 *
 * The Tasks branch abstracts data science into four predefined step categories
 * (Load, Preprocess, Analyze, Output/Viz). Each block exposes dropdowns for its
 * inputs and method. Two of those dropdowns are **dynamic**:
 *
 *  - `FieldTasksVariable` lists the named outputs produced by the tasks steps
 *    currently in the workspace (derived from the block chain).
 *  - `FieldTasksColumn` lists the columns of the selected input variable, as
 *    reported by the Python worker after a run.
 *
 * `FieldTasksMethod` is a static dropdown that, on change, rebuilds the block's
 * inputs so only the column inputs relevant to the selected method are shown.
 */

export const TASKS_VARIABLE_FIELD_TYPE = "field_tasks_variable";
export const TASKS_COLUMN_FIELD_TYPE = "field_tasks_column";
export const TASKS_METHOD_FIELD_TYPE = "field_tasks_method";

/** A tasks block with the dynamic-input helpers added by `tasksBlocks`. */
type TasksBlock = Blockly.Block & {
  rebuildInputs_?: () => void;
  refreshColumnFields?: () => void;
};

/** Fallback option shown when a dynamic dropdown has no entries yet. */
const NO_OPTIONS: [string, string][] = [["(none)", ""]];

/**
 * Dropdown of named tasks variables (outputs of Load/Preprocess/Analyze steps).
 *
 * Options are generated from `useTasksStore.tasksVariables`. The field
 * subscribes to the store so the list stays in sync as steps are added/renamed,
 * while preserving the current selection if it is still valid.
 */
export class FieldTasksVariable extends Blockly.FieldDropdown {
  private unsubscribe?: () => void;
  private refreshing = false;

  constructor(value?: string) {
    super(() => {
      const vars = useTasksStore.getState().tasksVariables;
      return vars.length ? vars.map((v) => [v, v]) : NO_OPTIONS;
    });
    if (value !== undefined) {
      this.setValue(value);
    }
  }

  static fromJson(
    options: Blockly.FieldDropdownFromJsonConfig,
  ): FieldTasksVariable {
    return new FieldTasksVariable(options.options?.[0]?.[1] as string);
  }

  /**
   * Accept any string value, even if it is not currently in the option list.
   * This lets starter blocks carry preset variable names (e.g. `data`,
   * `clean_data`) before the workspace has been populated, and preserves them
   * once the dynamic list refreshes.
   */
  protected doClassValidation_(newValue: string): string | null {
    return typeof newValue === "string" ? newValue : null;
  }

  initModel(): void {
    super.initModel();
    this.subscribe();
    this.refreshOptions();
  }

  private subscribe(): void {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = useTasksStore.subscribe((state, prevState) => {
      if (state.tasksVariables !== prevState.tasksVariables) {
        this.refreshOptions();
      }
    });
  }

  private refreshOptions(): void {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      const current = this.getValue();
      const vars = useTasksStore.getState().tasksVariables;
      const options: [string, string][] = vars.length
        ? vars.map((v) => [v, v])
        : NO_OPTIONS;
      this.setOptions(options);
      // Preserve the current value even if it is not yet in the option list.
      // This lets starter blocks carry preset variable names (e.g. `data`,
      // `clean_data`, `station_stats`) before the workspace has been populated,
      // and keeps them once the dynamic list refreshes.
      if (current) {
        this.setValue(current, false);
      }
    } finally {
      this.refreshing = false;
    }
  }

  protected doValueUpdate_(newValue: string): void {
    super.doValueUpdate_(newValue);
    if (this.refreshing) {
      return;
    }
    const block = this.getSourceBlock() as TasksBlock | null;
    if (block && typeof block.refreshColumnFields === "function") {
      block.refreshColumnFields();
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    super.dispose();
  }
}

/**
 * Dropdown of columns for the block's selected input variable.
 *
 * Options are generated from `useTasksStore.tasksVariableColumns[INPUT_VAR]`.
 * The field subscribes to the store so the list refreshes after a run, and the
 * block calls `refreshOptions()` when the input variable changes.
 */
export class FieldTasksColumn extends Blockly.FieldDropdown {
  private unsubscribe?: () => void;
  private refreshing = false;

  constructor(value?: string) {
    // Pass a non-empty placeholder to `super` so the menu generator is not
    // invoked (and therefore does not access `this`) during construction. The
    // dynamic generator is installed right after `super` returns, once `this`
    // is fully initialized.
    super(NO_OPTIONS);
    this.setOptions(() => this.getColumnOptions());
    if (value !== undefined) {
      this.setValue(value);
    }
  }

  static fromJson(
    options: Blockly.FieldDropdownFromJsonConfig,
  ): FieldTasksColumn {
    return new FieldTasksColumn(options.options?.[0]?.[1] as string);
  }

  /**
   * Accept any string value, even if it is not currently in the option list.
   * This lets starter blocks carry preset column names (e.g.
   * `measurement_timestamp`, `device_id`) before the data has been loaded, and
   * preserves them once the dynamic list refreshes after a run.
   */
  protected doClassValidation_(newValue: string): string | null {
    return typeof newValue === "string" ? newValue : null;
  }

  private getColumnOptions(): [string, string][] {
    const block = this.getSourceBlock();
    const inputVar = block?.getFieldValue("INPUT_VAR");
    const columns = inputVar
      ? (useTasksStore.getState().tasksVariableColumns[inputVar] ?? [])
      : [];
    return columns.length ? columns.map((c) => [c, c]) : NO_OPTIONS;
  }

  initModel(): void {
    super.initModel();
    this.subscribe();
    this.refreshOptions();
  }

  private subscribe(): void {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = useTasksStore.subscribe((state, prevState) => {
      if (state.tasksVariableColumns !== prevState.tasksVariableColumns) {
        this.refreshOptions();
      }
    });
  }

  refreshOptions(): void {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      const current = this.getValue();
      const options = this.getColumnOptions();
      this.setOptions(options);
      // Preserve the current value even if it is not yet in the option list.
      // This lets starter blocks carry preset column names (e.g.
      // `measurement_timestamp`, `device_id`) before the data has been loaded,
      // and keeps them once the dynamic list refreshes after a run.
      if (current) {
        this.setValue(current, false);
      }
    } finally {
      this.refreshing = false;
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    super.dispose();
  }
}

/**
 * Static dropdown of methods for a tasks block.
 *
 * On value change it asks the block to rebuild its inputs so only the column
 * inputs relevant to the selected method are shown.
 */
export class FieldTasksMethod extends Blockly.FieldDropdown {
  constructor(options: [string, string][], value?: string) {
    super(options.length ? options : NO_OPTIONS);
    if (value !== undefined) {
      this.setValue(value);
    }
  }

  static fromJson(
    options: Blockly.FieldDropdownFromJsonConfig,
  ): FieldTasksMethod {
    const opts = (options.options ?? []).filter(
      (o): o is [string, string] =>
        Array.isArray(o) &&
        typeof o[0] === "string" &&
        typeof o[1] === "string",
    );
    return new FieldTasksMethod(opts, opts[0]?.[1]);
  }

  protected doValueUpdate_(newValue: string): void {
    super.doValueUpdate_(newValue);
    const block = this.getSourceBlock() as TasksBlock | null;
    if (block && typeof block.rebuildInputs_ === "function") {
      block.rebuildInputs_();
    }
  }
}

Blockly.fieldRegistry.register(TASKS_VARIABLE_FIELD_TYPE, FieldTasksVariable);
Blockly.fieldRegistry.register(TASKS_COLUMN_FIELD_TYPE, FieldTasksColumn);
Blockly.fieldRegistry.register(TASKS_METHOD_FIELD_TYPE, FieldTasksMethod);
