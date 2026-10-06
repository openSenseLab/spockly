import * as Blockly from "blockly";
import { useAppStore } from "../../../../store/useAppStore";

/** Registered field type name used in block JSON definitions. */
export const UPLOAD_BUTTON_FIELD_TYPE = "field_upload_button";

let fileInput: HTMLInputElement | null = null;

/** Lazily create a single hidden file input used by every upload button field. */
const getFileInput = (): HTMLInputElement => {
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
  }
  return fileInput;
};

/**
 * A clickable "button" field for Blockly 13, which has no built-in
 * `field_button` type. Clicking it opens a file picker, stores the CSV content
 * in the Zustand store, and updates the field's label to the chosen filename.
 */
export class FieldUploadButton extends Blockly.Field<string> {
  EDITABLE = false;
  SERIALIZABLE = false;
  maxDisplayLength = Infinity;

  constructor(value?: string) {
    super(value ?? "Choose file…");
  }

  static fromJson(
    options: Blockly.FieldConfig & { text?: string },
  ): FieldUploadButton {
    return new FieldUploadButton(options.text ?? "Choose file…");
  }

  initView(): void {
    this.createBorderRect_();
    this.createTextElement_();
    this.fieldGroup_?.classList.add("blocklyFieldUploadButton");
  }

  isClickable(): boolean {
    return this.enabled_ && !!this.sourceBlock_ && this.sourceBlock_.isEditable();
  }

  showEditor_(): void {
    const input = getFileInput();
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const csv = typeof reader.result === "string" ? reader.result : null;
        useAppStore.getState().setUploadedCsv(csv);
        this.setValue(file.name);
      };
      reader.readAsText(file);
      input.value = "";
    };
    input.click();
  }

  protected doClassValidation_(newValue?: any): string | null {
    return newValue == null ? null : String(newValue);
  }
}

Blockly.fieldRegistry.register(UPLOAD_BUTTON_FIELD_TYPE, FieldUploadButton);
