import * as Blockly from 'blockly'

import type { ColumnMeta } from '../../core/types'
import { formatNumber, t } from '../../i18n'
import '../fields/columnDropdown'
import { columnsFor, FieldColumnDropdown, tableFor } from '../fields/columnDropdown'
import { fireStateChange } from '../setup'
import { actualValue, compareGuess, isQuantity, type Quantity } from './compare'

export const PREDICT = 'predict_value'

Blockly.Msg.SPOCKLY_PREDICT_LINE1 = t('block.predict.line1')
Blockly.Msg.SPOCKLY_PREDICT_LINE2 = t('block.predict.line2')
Blockly.Msg.SPOCKLY_PREDICT_LINE3 = t('block.predict.line3')
Blockly.Msg.SPOCKLY_PREDICT_TOOLTIP = t('block.predict.tooltip')

/** State the block keeps besides its fields; saved via saveExtraState. */
export type PredictBlock = Blockly.Block & { revealed: boolean }

/** Both button texts get the same width: an image field can't be resized later. */
const BUTTON_WIDTH = Math.round(Math.max(t('block.predict.reveal').length, t('block.predict.hide').length) * 7.4 + 28)

/** A pill-shaped button with text, drawn as an image so it is easy to tap. */
function buttonImage(text: string) {
  const width = BUTTON_WIDTH
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="26">` +
    `<rect x="1" y="1" width="${width - 2}" height="24" rx="12" fill="rgba(255,255,255,0.22)" stroke="white"/>` +
    `<text x="${width / 2}" y="17.5" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="white">${text}</text>` +
    `</svg>`
  return { src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width }
}

const REVEAL = buttonImage(t('block.predict.reveal'))
const HIDE = buttonImage(t('block.predict.hide'))

const unitOf = (block: Blockly.Block): string => {
  const column = columnsFor(block)?.find((c: ColumnMeta) => c.name === block.getFieldValue('COLUMN'))
  return column?.unit ?? ''
}

/** Text after revealing: real value and how far off the guess was. */
function resultText(block: PredictBlock): string {
  if (!block.revealed) return ''
  const table = tableFor(block)
  if (!table) return t('block.predict.waiting')
  const quantity = block.getFieldValue('QUANTITY')
  const actual = isQuantity(quantity) ? actualValue(table, block.getFieldValue('COLUMN'), quantity) : null
  if (actual === null) return t('block.predict.noValue')
  const unit = unitOf(block)
  const withUnit = (n: number) => (unit ? `${formatNumber(n)} ${unit}` : formatNumber(n))
  const { difference, verdict } = compareGuess(Number(block.getFieldValue('GUESS')), actual)
  const how =
    verdict === 'close'
      ? t('block.predict.close')
      : t(verdict === 'high' ? 'block.predict.tooHigh' : 'block.predict.tooLow', {
          by: withUnit(Math.abs(difference)),
        })
  return t('block.predict.result', { actual: withUnit(actual), how })
}

/** The "Warum?" line only makes sense once the real value is shown. */
function showReasonRow(block: PredictBlock) {
  const row = block.getInput('REASON_ROW')
  if (!row || row.isVisible() === block.revealed) return
  row.setVisible(block.revealed)
  if (block instanceof Blockly.BlockSvg) block.queueRender()
}

/**
 * Updates unit, button, result and the "Warum?" line. Called after compiling and whenever data
 * arrives; changes to these labels are display only, so no events are fired.
 */
export function refreshPrediction(block: PredictBlock) {
  Blockly.Events.disable()
  try {
    const column = block.getField('COLUMN')
    if (column instanceof FieldColumnDropdown) column.refresh()
    block.setFieldValue(unitOf(block), 'UNIT')
    const button = block.getField('REVEAL') as Blockly.FieldImage | null
    const image = block.revealed ? HIDE : REVEAL
    if (button && button.getValue() !== image.src) button.setValue(image.src)
    block.setFieldValue(resultText(block), 'RESULT')
    showReasonRow(block)
  } finally {
    Blockly.Events.enable()
  }
}

/** Reveals or hides the real value; recorded as an undoable change. */
export function setRevealed(block: PredictBlock, revealed: boolean) {
  if (block.revealed === revealed) return
  const before = JSON.stringify({ revealed: block.revealed })
  block.revealed = revealed
  fireStateChange(block, before, JSON.stringify({ revealed }))
  refreshPrediction(block)
}

const STATE_EXTENSION = 'predict_value_state'

Blockly.Extensions.registerMutator(
  STATE_EXTENSION,
  {
    saveExtraState(this: PredictBlock) {
      return { revealed: this.revealed }
    },
    loadExtraState(this: PredictBlock, state: { revealed?: boolean }) {
      this.revealed = state?.revealed === true
    },
  },
  function (this: PredictBlock) {
    this.revealed = false
    // Long explanations are shortened on the block; editing shows the full text.
    const reason = this.getField('REASON')
    if (reason) reason.maxDisplayLength = 36
    this.getInput('REASON_ROW')?.setVisible(false)
    const button = this.getField('REVEAL') as Blockly.FieldImage | null
    button?.setOnClickHandler((field) => {
      const block = field.getSourceBlock() as PredictBlock | null
      if (block && !block.isInFlyout) setRevealed(block, !block.revealed)
    })
  },
)

const quantityOptions: [string, Quantity][] = [
  [t('block.predict.max'), 'max'],
  [t('block.predict.min'), 'min'],
  [t('block.predict.mean'), 'mean'],
]

Blockly.common.defineBlocksWithJsonArray([
  {
    type: PREDICT,
    message0: '%{BKY_SPOCKLY_PREDICT_LINE1}',
    args0: [
      { type: 'field_dropdown', name: 'QUANTITY', options: quantityOptions },
      { type: 'field_column_dropdown', name: 'COLUMN', columns: 'measurements' },
    ],
    message1: '%{BKY_SPOCKLY_PREDICT_LINE2}',
    args1: [
      { type: 'field_number', name: 'GUESS', value: 0 },
      { type: 'field_label', name: 'UNIT', text: '' },
    ],
    message2: '%1 %2',
    args2: [
      { type: 'field_image', name: 'REVEAL', src: REVEAL.src, width: REVEAL.width, height: 26, alt: t('block.predict.reveal') },
      { type: 'field_label', name: 'RESULT', text: '' },
    ],
    // Shown after revealing: the student explains the difference in one sentence.
    message3: '%{BKY_SPOCKLY_PREDICT_LINE3} %2',
    args3: [
      { type: 'field_input', name: 'REASON', text: '', spellcheck: true },
      { type: 'input_dummy', name: 'REASON_ROW' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'predict_blocks',
    tooltip: '%{BKY_SPOCKLY_PREDICT_TOOLTIP}',
    mutator: STATE_EXTENSION,
  },
])
