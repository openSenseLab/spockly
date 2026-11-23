import * as Blockly from 'blockly'

import { getMessages } from '../i18n'
import { useKernelStore } from '../kernel/kernel'
import { getEditorContext } from './context'
import { isGisFile, toIdentifier } from './python'
import { openValuePicker, parseValues } from './valuePicker'
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

/** Layers of a multi-layer GIS file (zip with several Shapefiles, GeoPackage), known after one run. */
export class FieldLayer extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldLayer(options.value)
  }

  protected computeOptions(): Option[] {
    const block = this.getSourceBlock()
    const source = String(block?.getFieldValue('FILE') ?? block?.getFieldValue('URL') ?? '')
    const layers = useKernelStore.getState().layers[source] ?? []
    return [[getMessages().blocks.firstLayer, ''], ...layers.map((layer): Option => [layer, layer])]
  }
}

/**
 * Several values of a column (for "is one of"). Shows a short summary; clicking opens
 * a picker with the column's actual values. Stored as a JSON array.
 */
export class FieldValues extends Blockly.Field<string> {
  override SERIALIZABLE = true
  CURSOR = 'pointer'

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldValues(options.value ?? '[]')
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null
  }

  protected override getText_() {
    const values = parseValues(this.getValue() ?? '')
    if (!values.length) return getMessages().blocks.chooseValues
    const shown = values.slice(0, 2).map(String).join(', ')
    return values.length > 2 ? `${shown} +${values.length - 2}` : shown
  }

  protected override showEditor_() {
    const block = this.getSourceBlock()
    const column = String(block?.getFieldValue('COLUMN') ?? '')
    openValuePicker({
      column,
      options: valuesForColumn(block, column),
      selected: parseValues(this.getValue() ?? ''),
      done: (values) => this.setValue(JSON.stringify(values)),
    })
  }
}

/** Distinct values of a column: from the pipeline's dataset, otherwise any dataset with that column. */
const valuesForColumn = (block: Blockly.Block | null, column: string) => {
  const schemas = useKernelStore.getState().schemas
  const root = block?.getRootBlock()
  const dataset = root?.type === 'spk_pipeline' ? toIdentifier(String(root.getFieldValue('DATASET') ?? '')) : ''
  const own = schemas[dataset]?.find((field) => field.name === column)?.values
  if (own) return own
  for (const fields of Object.values(schemas)) {
    const values = fields.find((field) => field.name === column)?.values
    if (values) return values
  }
  return []
}

const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Text formats are kept as text; GIS containers (zip, GeoPackage, …) as base64 with a marker. */
const readUpload = (file: File) =>
  isGisFile(file.name) && !/\.(kml|gml|gpx)$/i.test(file.name)
    ? new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(`base64:${String(reader.result).split(',', 2)[1] ?? ''}`)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    : file.text()

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
      accept: '.csv,.tsv,.txt,.geojson,.json,.zip,.fgb,.gpkg,.kml,.gml,.gpx',
    })
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_BYTES) {
        window.alert(getMessages().blocks.fileTooLarge)
        return
      }
      getEditorContext().addFile(file.name, await readUpload(file))
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
Blockly.fieldRegistry.register('field_spk_layer', FieldLayer)
Blockly.fieldRegistry.register('field_spk_values', FieldValues)
Blockly.fieldRegistry.register('field_spk_layer_source', FieldLayerSource)
Blockly.fieldRegistry.register('field_spk_dataset_column', FieldDatasetColumn)
Blockly.fieldRegistry.register('field_spk_column', FieldColumn)
Blockly.fieldRegistry.register('field_spk_optional_column', FieldOptionalColumn)
