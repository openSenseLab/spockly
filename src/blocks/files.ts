/**
 * Own data: "öffne die Datei …" reads a file the student picked (CSV, JSON,
 * GeoJSON) as text. The next steps then make data from it, the same steps
 * that read openSenseMap's answer.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { formatNumber, t } from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { addFile, decodeFile, hasFile } from './fileStore'
import { SOURCES, STEP, variableFor } from './program'

export const LOAD_FILE = 'load_file'
SOURCES.add(LOAD_FILE)

/** Larger files make every run slow (the file goes to Python each time). */
const MAX_BYTES = 20 * 1024 * 1024
const ACCEPT = '.csv,.tsv,.txt,.json,.geojson,text/csv,application/json,application/geo+json'
/** The block's own warning, apart from the dataset warnings of variableFor. */
const MISSING = 'file'

/** Shows the picked file's name; a click opens the browser's file picker. The value is the name in Python. */
export class FieldFile extends Blockly.Field<string> {
  override SERIALIZABLE = true

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldFile(options.value ?? '')
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return typeof value === 'string' ? value : null
  }

  protected override getText_(): string {
    return this.getValue() || t('file.pick')
  }

  protected override showEditor_() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > MAX_BYTES) {
        window.alert(t('file.tooLarge', { size: formatNumber(Math.round(file.size / 1024 / 1024)), max: MAX_BYTES / 1024 / 1024 }))
        return
      }
      const name = addFile(file.name, decodeFile(await file.arrayBuffer()))
      this.setValue(name)
      // The same name again (a changed file picked anew) changes no block, but the data: run again.
      useAppStore.getState().filesChanged()
    })
    input.click()
  }
}

Blockly.fieldRegistry.register('field_file', FieldFile)

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_FILE,
    message0: t('block.loadFile'),
    args0: [{ type: 'field_file', name: 'FILE', value: '' }],
    previousStatement: STEP,
    nextStatement: STEP,
    style: 'file_blocks',
    tooltip: t('block.loadFile.tooltip', { general: t('toolbox.general'), own: t('toolbox.ownData') }),
  },
])

pythonGenerator.forBlock[LOAD_FILE] = (block) => {
  const name = variableFor(block)
  if (!name) return ''
  const file = String(block.getFieldValue('FILE') ?? '')
  // A saved program comes back without its files: they stay only as long as the tab.
  block.setWarningText(!file ? t('block.loadFile.none') : hasFile(file) ? null : t('block.loadFile.missing', { file }), MISSING)
  if (!file) return ''
  return `${name} = open(${JSON.stringify(file)}, encoding="utf-8").read()\n`
}
