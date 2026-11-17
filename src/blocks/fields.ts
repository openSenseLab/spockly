/**
 * Dropdowns for dataset and column names. Unlike Blockly's FieldDropdown they
 * keep a value that isn't in the list right now – a dataset defined further
 * down that hasn't loaded yet, or a column known only after the next run – so
 * a choice is never lost.
 */
import * as Blockly from 'blockly'

import { columnsOf, type Snapshot } from '../core/fromPython'
import { isGeometry } from '../core/geometry'
import { t } from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { datasetBlocks, datasetNameOf, lastStepOf, stepBefore } from './program'

class FieldKeptDropdown extends Blockly.FieldDropdown {
  /** The last value set, kept even if it isn't one of the current options. */
  kept = ''

  constructor(
    choices: (block: Blockly.Block | null) => string[],
    empty: (block: Blockly.Block | null) => string,
    initial = '',
    /** An option that is always there, at the end, e.g. "no column". */
    always?: [label: string, value: string],
    /** Whether the list is known for sure, so a kept value not in it is missing (not just not loaded yet). */
    known: (block: Blockly.Block | null) => boolean = () => false,
  ) {
    super(function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
      const field = this as FieldKeptDropdown
      const block = field.getSourceBlock()
      const names = choices(block)
      const options: Blockly.MenuOption[] = names.map((name) => [name, name])
      if (field.kept && !names.includes(field.kept) && field.kept !== always?.[1]) {
        options.push([known(block) ? t('field.missing', { name: field.kept }) : field.kept, field.kept])
      }
      if (always) options.push(always)
      return options.length ? options : [[empty(field.getSourceBlock()), '']]
    })
    this.kept = initial
    // An empty start is "no column" where there is one, not the first column offered.
    if (initial || always) this.setValue(initial)
  }

  protected override doClassValidation_(newValue?: string): string | null {
    if (typeof newValue !== 'string') return null
    this.kept = newValue
    return newValue
  }

  protected override doValueUpdate_(newValue: string) {
    // Rebuild the option list so it contains the value just accepted.
    this.getOptions(false)
    super.doValueUpdate_(newValue)
  }

  /** Shows the label for what is known now (after a run: "value – fehlt"), without changing the value. */
  refreshLabel() {
    const before = this.getText()
    this.doValueUpdate_(this.getValue() ?? '')
    if (this.getText() !== before) this.forceRerender()
  }
}

/** Updates the labels of all dataset and column dropdowns, e.g. after a run brought new columns. */
export function refreshFieldLabels(workspace: Blockly.Workspace) {
  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      for (const field of input.fieldRow) if (field instanceof FieldKeptDropdown) field.refreshLabel()
    }
  }
}

/** A column list is known once the data before the block was a table in a run. */
const columnsKnown = (block: Blockly.Block | null) => columnsFor(block).length > 0

/** All dataset names on the canvas, in order. */
const datasetNames = (block: Blockly.Block | null) =>
  block ? datasetBlocks(block.workspace).map((d) => datasetNameOf(d)).filter(Boolean) : []

/**
 * The columns of the data a block works on, from the last run: inside a
 * dataset, the data after the step above; a block that names a dataset
 * (DATASET field), that dataset's data after its last step.
 */
function snapshotFor(block: Blockly.Block | null): Snapshot | undefined {
  if (!block) return undefined
  const named = block.getFieldValue('DATASET')
  const source = typeof named === 'string' && named ? lastStepOf(block.workspace, named) : stepBefore(block)
  return source ? useAppStore.getState().snapshots[source.id] : undefined
}

export const columnsFor = (block: Blockly.Block | null): string[] => columnsOf(snapshotFor(block)) ?? []

/**
 * A value of several parts, as "teile die Spalte … auf" splits it: a list like
 * a position [longitude, latitude], or text with a comma or semicolon in it.
 */
const hasParts = (value: unknown) =>
  (Array.isArray(value) && value.length >= 2 && value.every((part) => part === null || typeof part !== 'object')) ||
  (typeof value === 'string' && /[,;]/.test(value))

/** The columns (in the rows of the last run) that pass a test of their pandas type and their filled values. */
function columnsWhere(block: Blockly.Block | null, test: (dtype: string, filled: unknown[], name: string) => boolean): string[] {
  const snapshot = snapshotFor(block)
  if (snapshot?.art !== 'tabelle') return []
  return snapshot.spalten.filter((name, i) => {
    const filled = snapshot.zeilen.map((row) => row[i]).filter((v) => v !== null && v !== undefined)
    return test(snapshot.typen[name] ?? 'object', filled, name)
  })
}

/** Only the columns whose values have several parts; the others can't be split. */
export const splitColumnsFor = (block: Blockly.Block | null) =>
  columnsWhere(block, (_, filled) => filled.length > 0 && filled.every(hasParts))

/** Only the columns that hold whole shapes (GeoJSON geometries: points, lines, areas), for the shapes map. */
export const shapeColumnsFor = (block: Blockly.Block | null) =>
  columnsWhere(block, (_, filled) => filled.length > 0 && filled.every(isGeometry))

/** Numbers as pandas keeps them, as in core/fromPython. Text like "12.5" isn't one until „mach aus … eine Zahl“. */
const isNumberType = (dtype: string) => /^(u?int|float|Int|UInt|Float)/.test(dtype)

/**
 * The map colours by numbers only: the number columns, without the two that
 * place the points (colouring by latitude only repeats the map).
 */
export function colourColumnsFor(block: Blockly.Block | null): string[] {
  const position = [block?.getFieldValue('LAT'), block?.getFieldValue('LON')]
  return columnsWhere(block, (dtype) => isNumberType(dtype)).filter((name) => !position.includes(name))
}

export class FieldDataset extends FieldKeptDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldDataset(datasetNames, () => t('field.noDatasets'), options.value)
  }
}

export class FieldColumn extends FieldKeptDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldColumn(columnsFor, () => t('field.runFirst'), options.value, undefined, columnsKnown)
  }
}

/** Dates as pandas keeps them. Text like "2026-05-03T10:00" isn't one until „mach aus … ein Datum“. */
const isDateType = (dtype: string) => /^datetime64/.test(dtype)

/** The time chart's time: date columns. */
export const timeColumnsFor = (block: Blockly.Block | null) => columnsWhere(block, isDateType)

/** The time chart's value: number columns. */
export const valueColumnsFor = (block: Blockly.Block | null) => columnsWhere(block, isNumberType)

/** Longer text, or a link, is a description, not the name of a group. */
const MAX_GROUP_TEXT = 40

/**
 * "one line per …": columns of short names or yes/no that repeat, like
 * station_name or sensor_title. Not numbers, dates, lists, descriptions or
 * links; not a column with the same value everywhere (that's one line anyway).
 */
export function groupColumnsFor(block: Blockly.Block | null): string[] {
  const snapshot = snapshotFor(block)
  if (snapshot?.art !== 'tabelle') return []
  return columnsWhere(block, (dtype, filled, name) => {
    if (isNumberType(dtype) || isDateType(dtype) || !filled.length) return false
    const short = filled.every(
      (v) =>
        typeof v === 'boolean' ||
        // Not a link, nor a date still kept as text ("2026-11-11T09:00:00Z").
        (typeof v === 'string' && v.length <= MAX_GROUP_TEXT && !/^https?:/.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v)),
    )
    if (!short) return false
    // Counted in all rows by Python; the first rows alone often come from one station only.
    const distinct = snapshot.verschieden?.[name]
    if (distinct === undefined) return new Set(filled).size < filled.length
    return distinct >= 2 && distinct < snapshot.anzahl
  })
}

/**
 * A column dropdown that offers only the columns `choices` lets through.
 * Ran, and a table, but nothing fits: it says so (`none`), not "run first".
 */
const columnField = (choices: (block: Blockly.Block | null) => string[], none: string, always?: [string, string]) =>
  class extends FieldKeptDropdown {
    static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
      return new this(choices, (block) => (columnsFor(block).length ? t(none) : t('field.runFirst')), options.value, always, columnsKnown)
    }
  }

/** The value of "no column": all points in one colour, one line for all rows. */
export const NO_COLUMN = ''

Blockly.fieldRegistry.register('field_dataset', FieldDataset)
/** Menu values that change the choice rather than being one: tick or untick a column, or choose none. */
const TOGGLE = '\u0001'
const NONE_CHOSEN = '\u0002'

/** The columns chosen, from the field's value: a JSON list, or "" for none. */
export function chosenColumns(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return []
  try {
    const list: unknown = JSON.parse(value)
    return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return []
  }
}

/**
 * Columns to tick, any number of them, e.g. what the map shows when pointing
 * at a place. Each choice in the menu ticks or unticks one column; the block
 * shows the ticked ones. The value is a JSON list, "" for none.
 */
export class FieldColumns extends Blockly.FieldDropdown {
  constructor(value = '') {
    super(function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
      const field = this as FieldColumns
      const chosen = chosenColumns(field.getValue())
      const names = columnsFor(field.getSourceBlock())
      // First the choice as it is (Blockly shows the option of the current value), then a line per column.
      const current: Blockly.MenuOption = [chosen.length ? chosen.join(', ') : t('field.columns.none'), field.getValue() ?? '']
      const columns = [...new Set([...names, ...chosen])].map((name): Blockly.MenuOption => [
        `${chosen.includes(name) ? '☑' : '☐'} ${name}`,
        TOGGLE + name,
      ])
      const none: Blockly.MenuOption = [names.length ? t('field.columns.clear') : t('field.runFirst'), NONE_CHOSEN]
      return [current, ...columns, none]
    })
    this.setValue(value)
  }

  static override fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldColumns(options.value ?? '')
  }

  protected override doClassValidation_(newValue?: string): string | null {
    if (typeof newValue !== 'string') return null
    if (newValue === NONE_CHOSEN) return ''
    if (newValue.startsWith(TOGGLE)) {
      const name = newValue.slice(TOGGLE.length)
      const chosen = chosenColumns(this.getValue())
      const next = chosen.includes(name) ? chosen.filter((c) => c !== name) : [...chosen, name]
      return next.length ? JSON.stringify(next) : ''
    }
    return newValue === '' || chosenColumns(newValue).length ? newValue : null
  }

  protected override doValueUpdate_(newValue: string) {
    // The menu's first option is the value itself: build it for the new value before Blockly looks for it.
    this.value_ = newValue
    this.getOptions(false)
    super.doValueUpdate_(newValue)
  }
}

Blockly.fieldRegistry.register('field_column', FieldColumn)
Blockly.fieldRegistry.register('field_columns', FieldColumns)
Blockly.fieldRegistry.register('field_split_column', columnField(splitColumnsFor, 'field.noSplit'))
Blockly.fieldRegistry.register('field_colour_column', columnField(colourColumnsFor, 'field.noNumbers', [t('field.noColour'), NO_COLUMN]))
Blockly.fieldRegistry.register('field_shape_column', columnField(shapeColumnsFor, 'field.noShapes'))
Blockly.fieldRegistry.register('field_time_column', columnField(timeColumnsFor, 'field.noDates'))
Blockly.fieldRegistry.register('field_value_column', columnField(valueColumnsFor, 'field.noNumbers'))
Blockly.fieldRegistry.register('field_group_column', columnField(groupColumnsFor, 'field.noGroups', [t('field.noGroup'), NO_COLUMN]))
