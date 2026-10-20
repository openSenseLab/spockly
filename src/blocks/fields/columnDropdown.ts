/**
 * A dropdown of the columns of the data above a block. Unlike Blockly's
 * FieldDropdown it keeps a chosen column that isn't in the list right now —
 * e.g. while a saved workspace is still loading its data, or after the data
 * changed — so the choice isn't lost; the block can then warn about it.
 */
import * as Blockly from 'blockly'

import type { ColumnMeta, DataTable } from '../../core/types'
import { pick, t } from '../../i18n'

/** Gives the data a block works on (null while not loaded). The app registers it. */
type TableProvider = (block: Blockly.Block) => DataTable | null

let provideTable: TableProvider = () => null

export function setTableProvider(provider: TableProvider) {
  provideTable = provider
}

export const tableFor = (block: Blockly.Block) => provideTable(block)
export const columnsFor = (block: Blockly.Block): ColumnMeta[] | null => provideTable(block)?.columns ?? null

const NO_COLUMN = ''

export class FieldColumnDropdown extends Blockly.FieldDropdown {
  /** The last value set, kept even if it isn't one of the current options. */
  private kept: string = NO_COLUMN

  constructor(filter: (column: ColumnMeta) => boolean = () => true) {
    super(function (this: Blockly.FieldDropdown): Blockly.MenuOption[] {
      const field = this as FieldColumnDropdown
      const block = field.getSourceBlock()
      const columns = (block && columnsFor(block))?.filter(filter) ?? []
      const options: Blockly.MenuOption[] = columns.map((c) => [pick(c.label) ?? c.name, c.name])
      if (field.kept && !columns.some((c) => c.name === field.kept)) {
        options.push([`${field.kept} ⚠`, field.kept])
      }
      // Nothing chosen yet (or reset): say so instead of showing a column.
      if (!field.kept && options.length) options.unshift([t('field.chooseColumn'), NO_COLUMN])
      if (options.length) return options
      // Data is there, but none of its columns fit this block.
      const loaded = !!block && columnsFor(block) !== null
      return [[t(loaded ? 'field.noFittingColumns' : 'field.noColumns'), NO_COLUMN]]
    })
  }

  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { columns?: 'measurements' }) {
    // Measurements only: coordinates, ids and codes are numbers too, but their
    // highest value or mean isn't a meaningful question.
    return new FieldColumnDropdown(
      options.columns === 'measurements'
        ? (c) => c.dataType === 'number' && c.semanticType === 'measurement'
        : undefined,
    )
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

  /**
   * Re-reads the columns (e.g. once the data has arrived) and updates the
   * shown text, so a kept "T2M ⚠" becomes "Temperatur (Mittel)".
   */
  refresh() {
    this.doValueUpdate_(this.getValue() ?? NO_COLUMN)
    this.forceRerender()
  }
}

Blockly.fieldRegistry.register('field_column_dropdown', FieldColumnDropdown)
