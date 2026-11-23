import * as Blockly from 'blockly'

import { getMessages } from '../i18n'
import { useKernelStore } from '../kernel/kernel'
import { getEditorContext } from './context'
import { toIdentifier } from './python'
import { columnsForBlock } from './schema'

type Option = [string, string]

/**
 * A dropdown whose options are computed on demand (datasets, columns) and that
 * accepts any saved value, so a journal can be loaded before Python has told
 * us which columns exist.
 */
abstract class DynamicDropdown extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(() => [['', '']])
    if (value) this.setValue(value)
  }

  protected abstract computeOptions(): Option[]

  override getOptions(): Blockly.MenuOption[] {
    const options = this.computeOptions()
    const value = this.getValue()
    if (value && !options.some(([, id]) => id === value)) options.unshift([value, value])
    return options.length ? options : [['…', '']]
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null
  }
}

export class FieldDataset extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldDataset(options.value)
  }

  protected computeOptions(): Option[] {
    const names = new Set(getEditorContext().datasetNames(useKernelStore.getState().schemas))
    // Datasets loaded or saved in this same workspace are always available.
    for (const block of this.getSourceBlock()?.workspace.getAllBlocks(false) ?? []) {
      if (block.type.startsWith('spk_load_') || block.type === 'spk_save') {
        const name = String(block.getFieldValue('NAME') ?? '').trim()
        if (name) names.add(name)
      }
    }
    return [...names].map((name) => [name, name])
  }
}

export class FieldColumn extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldColumn(options.value)
  }

  protected computeOptions(): Option[] {
    return columnsForBlock(this.getSourceBlock()).map((column) => [column, column])
  }
}

/** Column dropdown with a leading "(none)" entry, e.g. for optional chart colours. */
export class FieldOptionalColumn extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldOptionalColumn(options.value)
  }

  protected computeOptions(): Option[] {
    return [
      [getMessages().blocks.none, ''],
      ...columnsForBlock(this.getSourceBlock()).map((column): Option => [column, column]),
    ]
  }
}

/** Map layer source: the pipeline's current data or another dataset. */
export class FieldLayerSource extends FieldDataset {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldLayerSource(options.value)
  }

  protected computeOptions(): Option[] {
    return [[getMessages().blocks.currentData, ''], ...super.computeOptions()]
  }
}

/** Columns of the dataset selected in the same block (e.g. "mean of pm10 from stations"). */
export class FieldDatasetColumn extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldDatasetColumn(options.value)
  }

  protected computeOptions(): Option[] {
    const dataset = String(this.getSourceBlock()?.getFieldValue('DATASET') ?? '')
    const columns = useKernelStore.getState().schemas[toIdentifier(dataset)] ?? []
    return [
      [getMessages().blocks.none, ''],
      ...columns.filter((c) => c.name !== 'geometry').map((c): Option => [c.name, c.name]),
    ]
  }
}

const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Shows the chosen file name; clicking opens the browser's file picker. The file is kept in the journal. */
export class FieldFile extends Blockly.Field<string> {
  override SERIALIZABLE = true
  CURSOR = 'pointer'

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldFile(options.value ?? '')
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null
  }

  protected override getText_() {
    return this.getValue() || getMessages().blocks.chooseFile
  }

  protected override showEditor_() {
    const input = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: '.csv,.tsv,.txt,.geojson,.json',
    })
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_BYTES) {
        window.alert(getMessages().blocks.fileTooLarge)
        return
      }
      getEditorContext().addFile(file.name, await file.text())
      const block = this.getSourceBlock()
      const name = block?.getField('NAME')
      if (name && /^data\d*$/.test(String(name.getValue()))) {
        name.setValue(file.name.replace(/\.[^.]+$/, '').replace(/\W+/g, '_').toLowerCase() || 'data')
      }
      this.setValue(file.name)
    }
    input.click()
  }
}

Blockly.fieldRegistry.register('field_spk_dataset', FieldDataset)
Blockly.fieldRegistry.register('field_spk_file', FieldFile)
Blockly.fieldRegistry.register('field_spk_layer_source', FieldLayerSource)
Blockly.fieldRegistry.register('field_spk_dataset_column', FieldDatasetColumn)
Blockly.fieldRegistry.register('field_spk_column', FieldColumn)
Blockly.fieldRegistry.register('field_spk_optional_column', FieldOptionalColumn)
