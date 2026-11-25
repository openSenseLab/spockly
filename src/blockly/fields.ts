import * as Blockly from 'blockly'

import { getMessages } from '../i18n'
import { choiceAt, describePath, parsePath, parseSelection, tableChoices, valueChoices } from '../journal/extract'
import { useKernelStore } from '../kernel/kernel'
import { CATEGORICAL } from '../components/outputs/palette'
import { getEditorContext } from './context'
import { isGisFile, toIdentifier } from './python'
import { openValuePicker, parseValues } from './valuePicker'
import { selectionValue } from './selection'
import { mergeValues, valuesInWorkspace } from './values'

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

  /** Label for a saved value that is not among the options (yet). */
  protected labelFor(value: string) {
    return value
  }

  override getOptions(): Blockly.MenuOption[] {
    const options = this.computeOptions()
    const value = this.getValue()
    if (value && !options.some(([, id]) => id === value)) options.unshift([this.labelFor(value), value])
    return options.length ? options : [['…', '']]
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null
  }
}

/** Datasets of the data cells (journal), plus those loaded or saved in the same workspace. */
export const knownDatasets = (workspace: Blockly.Workspace | null | undefined) => {
  const names = new Set(getEditorContext().datasetNames(useKernelStore.getState().schemas))
  for (const block of workspace?.getAllBlocks(false) ?? []) {
    if (block.type.startsWith('spk_load_') || block.type === 'spk_save' || TAKE_DATASET_BLOCKS.includes(block.type)) {
      const name = String(block.getFieldValue('NAME') ?? '').trim()
      if (name) names.add(name)
    }
  }
  return [...names].map(toIdentifier).filter((name, i, all) => name && all.indexOf(name) === i)
}

export class FieldDataset extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldDataset(options.value)
  }

  protected computeOptions(): Option[] {
    return knownDatasets(this.getSourceBlock()?.workspace).map((name) => [name, name])
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
    const column = selectionValue(block, 'COLUMN')
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
  const dataset = root?.type === 'spk_pipeline' ? toIdentifier(selectionValue(root, 'DATASET')) : ''
  const own = schemas[dataset]?.find((field) => field.name === column)?.values
  if (own) return own
  for (const fields of Object.values(schemas)) {
    const values = fields.find((field) => field.name === column)?.values
    if (values) return values
  }
  return []
}

/** Blocks that create a dataset from a part of another one. */
export const TAKE_DATASET_BLOCKS = ['spk_take_table', 'spk_take_columns']

/** JSON structure of the dataset chosen in the same block (known after the data block ran). */
const structureOf = (block: Blockly.Block | null) => {
  const dataset = toIdentifier(String(block?.getFieldValue('DATASET') ?? ''))
  return useKernelStore.getState().structures[dataset]
}

const pathLabel = (path: string[]) => {
  const t = getMessages().blocks
  return describePath(path, t.eachItem, t.wholeFile)
}

/** A list (or object) inside a JSON dataset, stored as {"path": [...], "shape": "records"}. */
export class FieldJsonTable extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldJsonTable(options.value)
  }

  protected computeOptions(): Option[] {
    const structure = structureOf(this.getSourceBlock())
    if (!structure) return []
    return tableChoices(structure).flatMap((choice): Option[] =>
      choice.kind === 'table' ? [[pathLabel(choice.selection.path), JSON.stringify(choice.selection)]] : [],
    )
  }

  protected override labelFor(value: string) {
    const selection = parseSelection(value)
    return selection ? pathLabel(selection.path) : value
  }
}

/** A single value inside a JSON dataset, stored as a JSON list of keys. */
export class FieldJsonValue extends DynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldJsonValue(options.value)
  }

  protected computeOptions(): Option[] {
    const structure = structureOf(this.getSourceBlock())
    if (!structure) return []
    return valueChoices(structure).flatMap((choice): Option[] =>
      choice.kind === 'value' ? [[pathLabel(choice.path), JSON.stringify(choice.path)]] : [],
    )
  }

  protected override labelFor(value: string) {
    const path = parsePath(value)
    return path ? pathLabel(path) : value
  }
}

/** Columns a "take" block can keep: fields of the chosen JSON list, or the columns of the dataset. */
const columnsToPick = (block: Blockly.Block | null): string[] => {
  if (!block) return []
  if (block.type === 'spk_take_table') {
    const structure = structureOf(block)
    const selection = parseSelection(String(block.getFieldValue('PATH') ?? ''))
    const choice = structure && selection ? choiceAt(structure, selection.path) : null
    return choice?.kind === 'table' ? choice.columns : []
  }
  const dataset = toIdentifier(String(block.getFieldValue('DATASET') ?? ''))
  return useKernelStore.getState().schemas[dataset]?.map((field) => field.name) ?? []
}

/** Several columns to keep, stored as a JSON array; empty = all columns. */
export class FieldPickColumns extends Blockly.Field<string> {
  override SERIALIZABLE = true
  CURSOR = 'pointer'

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldPickColumns(options.value ?? '[]')
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' ? newValue : null
  }

  protected override getText_() {
    const columns = parseValues(this.getValue() ?? '').map(String)
    if (!columns.length) return getMessages().blocks.allColumns
    const shown = columns.slice(0, 3).join(', ')
    return columns.length > 3 ? `${shown} +${columns.length - 3}` : shown
  }

  protected override showEditor_() {
    openValuePicker({
      column: '',
      title: getMessages().picker.columnsTitle,
      options: columnsToPick(this.getSourceBlock()),
      selected: parseValues(this.getValue() ?? ''),
      done: (values) => this.setValue(JSON.stringify(values.map(String))),
    })
  }
}

/** Values from the data cells (journal) plus those taken in the same workspace (lab). */
export const knownValues = (workspace: Blockly.Workspace | null | undefined) =>
  mergeValues(getEditorContext().values(), valuesInWorkspace(workspace))

/** Colours offered first: the chart palette, then grey and black. Any other colour via the picker. */
const SWATCHES = [...CATEGORICAL, '#9a9893', '#3f3f3c']

/** A coloured swatch; clicking it opens a small palette (plus the browser's colour picker). */
export class FieldColour extends Blockly.Field<string> {
  override SERIALIZABLE = true
  CURSOR = 'pointer'

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldColour(options.value)
  }

  constructor(value?: string) {
    super(value ?? CATEGORICAL[0])
  }

  protected override doClassValidation_(newValue?: string): string | null {
    return typeof newValue === 'string' && /^#[0-9a-f]{6}$/i.test(newValue) ? newValue.toLowerCase() : null
  }

  // The swatch carries the colour; the text stays empty.
  protected override getText_() {
    return ''
  }

  protected override render_() {
    super.render_()
    this.size_ = new Blockly.utils.Size(28, 18)
    this.borderRect_?.setAttribute('width', '28')
    this.borderRect_?.setAttribute('height', '18')
    this.applyColour()
  }

  override applyColour() {
    if (!this.borderRect_) return
    this.borderRect_.style.fill = this.getValue() ?? CATEGORICAL[0]
    this.borderRect_.style.fillOpacity = '1'
  }

  protected override doValueUpdate_(newValue: string) {
    super.doValueUpdate_(newValue)
    this.applyColour()
  }

  protected override showEditor_() {
    const content = Blockly.DropDownDiv.getContentDiv()
    content.replaceChildren()
    const grid = document.createElement('div')
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,22px);gap:6px;padding:8px'
    const choose = (colour: string) => {
      this.setValue(colour)
      Blockly.DropDownDiv.hideIfOwner(this as Blockly.Field)
    }
    for (const colour of SWATCHES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.title = colour
      button.setAttribute('aria-label', colour)
      const selected = colour === this.getValue()
      button.style.cssText = `width:22px;height:22px;border-radius:6px;cursor:pointer;background:${colour};border:2px solid ${selected ? '#1d1d1b' : 'white'};box-shadow:0 0 0 1px #d0d0c9`
      button.addEventListener('click', () => choose(colour))
      grid.append(button)
    }
    const picker = document.createElement('input')
    picker.type = 'color'
    picker.value = this.getValue() ?? CATEGORICAL[0]
    picker.title = getMessages().blocks.otherColour
    picker.style.cssText = 'width:22px;height:22px;padding:0;border:none;cursor:pointer;background:none'
    picker.addEventListener('change', () => choose(picker.value))
    grid.append(picker)
    content.append(grid)
    Blockly.DropDownDiv.setColour('#ffffff', '#d0d0c9')
    Blockly.DropDownDiv.showPositionedByField(this as Blockly.Field, () => content.replaceChildren())
  }
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
Blockly.fieldRegistry.register('field_spk_json_table', FieldJsonTable)
Blockly.fieldRegistry.register('field_spk_json_value', FieldJsonValue)
Blockly.fieldRegistry.register('field_spk_pick_columns', FieldPickColumns)
Blockly.fieldRegistry.register('field_spk_file', FieldFile)
Blockly.fieldRegistry.register('field_spk_colour', FieldColour)
Blockly.fieldRegistry.register('field_spk_layer', FieldLayer)
Blockly.fieldRegistry.register('field_spk_values', FieldValues)
Blockly.fieldRegistry.register('field_spk_dataset_column', FieldDatasetColumn)
