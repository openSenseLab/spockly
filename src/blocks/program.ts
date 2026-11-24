/**
 * The frame of a program: "Datensatz <name>" holds the steps that make one
 * dataset, top to bottom. Every step works on that dataset's variable, so the
 * Python reads like the blocks: one name, changed step by step. The name is
 * how other blocks ("zeige …", the measurements of a sensor table) say which
 * dataset they mean, since a program often has more than one.
 *
 * The code is generated twice: once as students see it, and once to run, with
 * a merke(…) line after each step that tells the app what the data looked
 * like there (the "Zwischenstand" shown when a block is clicked), and hints
 * for what the run would otherwise skip without a word: blocks outside a
 * dataset, an empty dataset, a dataset nothing shows.
 */
import * as Blockly from 'blockly'
import { pythonGenerator, type PythonGenerator } from 'blockly/python'

import { toPythonName } from '../core/names'
import { t } from '../i18n'

export const DATASET = 'spockly_dataset'
/**
 * What kind the data is between two steps. A step says what it takes from the
 * block above and what it leaves for the block below; Blockly lets only
 * fitting blocks snap together (e.g. no table before the text is translated).
 * "start" is the top of a dataset, where only blocks that get data fit.
 * "stations": JSON translated from openSenseMap's answer, which only the
 * stations table and the list table take (see narrowKinds in fit.ts).
 */
export const DATA = { start: 'Anfang', text: 'Text', json: 'JSON', stations: 'Stationen', list: 'Liste', table: 'Tabelle' } as const
export type DataKind = keyof typeof DATA
const DATA_CHECKS = new Set<string>(Object.values(DATA))

/** The kind a connection check stands for, or null for other checks (datasets, "zeige" blocks). */
export const kindOf = (check: string | undefined): DataKind | null =>
  (Object.keys(DATA) as DataKind[]).find((kind) => DATA[kind] === check) ?? null

/** A step's connections: the kinds it takes from above, the kind(s) it leaves below. */
export const stepShape = (takes: DataKind[], gives: DataKind | DataKind[]) => ({
  previousStatement: takes.map((kind) => DATA[kind]),
  nextStatement: Array.isArray(gives) ? gives.map((kind) => DATA[kind]) : DATA[gives],
})

/** A step (it belongs inside a dataset), not a dataset or a "zeige" block. */
export const isStep = (block: Blockly.Block) => block.previousConnection?.getCheck()?.some((check) => DATA_CHECKS.has(check)) ?? false

/** Datasets and "zeige" blocks go one under the other. */
export const PROGRAM = 'Programm'

/** Blocks that bring data (a file, a request); the other steps need data above them. */
export const SOURCES = new Set<string>()

Blockly.common.defineBlocksWithJsonArray([
  {
    type: DATASET,
    message0: t('block.dataset'),
    args0: [{ type: 'field_input', name: 'NAME', text: t('dataset.default'), spellcheck: false }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'STEPS', check: DATA.start }],
    previousStatement: PROGRAM,
    nextStatement: PROGRAM,
    style: 'dataset_blocks',
    tooltip: t('block.dataset.tooltip'),
  },
])

/** The dataset's name as written on the block, e.g. "Sensoren Münster". */
export const datasetNameOf = (block: Blockly.Block) => String(block.getFieldValue('NAME') ?? '').trim()

/** Its name in Python, e.g. "sensoren_muenster". */
export const pythonNameOf = (block: Blockly.Block) => toPythonName(datasetNameOf(block), 'daten')

export const datasetBlocks = (workspace: Blockly.Workspace) =>
  workspace.getAllBlocks(true).filter((b) => b.type === DATASET && b.isEnabled())

/** The dataset block a step sits in, or null. */
export function datasetOf(block: Blockly.Block): Blockly.Block | null {
  let parent = block.getSurroundParent()
  while (parent && parent.type !== DATASET) parent = parent.getSurroundParent()
  return parent
}

/** The steps inside a dataset, top to bottom. */
export function stepsOf(dataset: Blockly.Block): Blockly.Block[] {
  const steps: Blockly.Block[] = []
  for (let step = dataset.getInputTargetBlock('STEPS'); step; step = step.getNextBlock()) steps.push(step)
  return steps
}

/** The step above this one in its dataset (whose data this one works on), or null for the first. */
export function stepBefore(block: Blockly.Block): Blockly.Block | null {
  const above = block.getPreviousBlock()
  return above && above.type !== DATASET && datasetOf(block) ? above : null
}

/** The last step of the dataset with this name (its finished data), or null. */
export function lastStepOf(workspace: Blockly.Workspace, name: string): Blockly.Block | null {
  const dataset = datasetBlocks(workspace).find((d) => datasetNameOf(d) === name)
  return dataset ? (stepsOf(dataset).at(-1) ?? null) : null
}

/** The label of a block as students read it, e.g. "übersetze den JSON-Text für Python": its visible rows only. */
export function blockText(block: Blockly.Block): string {
  const text = block.inputList
    .filter((input) => input.isVisible())
    .flatMap((input) => input.fieldRow.map((field) => field.getText()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 70 ? `${text.slice(0, 69)}…` : text
}

/** The toolbox categories by name, for texts that say where to find a block: „(unter „Allgemeine Blöcke“)“. */
export const categoryNames = () => ({
  general: t('toolbox.general'),
  own: t('toolbox.ownData'),
  osem: t('toolbox.osem'),
  views: t('toolbox.views'),
})

/** "zeige …" blocks show data; they are no steps (they don't change it). */
export const isView = (block: Blockly.Block) => block.type.startsWith('view_')

/** All steps and "zeige …" blocks in the order the program runs them (Blockly generates top stacks top to bottom). */
export function blocksInRunOrder(workspace: Blockly.Workspace): Blockly.Block[] {
  const blocks: Blockly.Block[] = []
  for (const top of workspace.getTopBlocks(true)) {
    for (let block: Blockly.Block | null = top; block; block = block.getNextBlock()) {
      if (!block.isEnabled()) continue
      if (block.type === DATASET) blocks.push(...stepsOf(block).filter((s) => s.isEnabled()))
      else if (isView(block)) blocks.push(block)
    }
  }
  return blocks
}

/**
 * While generating the code to run: the merke(…) line after a block, so the
 * app knows the block finished (and what data it had). The first block
 * without one is the one that failed.
 */
export function traced(block: Blockly.Block, variable: string): string {
  if (!tracing) return ''
  needs(pythonGenerator, 'from spockly import merke')
  return `merke(${JSON.stringify(block.id)}, ${variable})\n`
}

/**
 * The Python variable of the dataset a step works on. Marks the block right
 * away, before any run, if it isn't in a "Datensatz", or if it needs data but
 * nothing above it brings any (e.g. "lies …" as the first block inside).
 */
export function variableFor(block: Blockly.Block): string | null {
  const dataset = datasetOf(block)
  const warning = !dataset
    ? t('block.notInDataset')
    : !SOURCES.has(block.type) && !stepBefore(block)
      ? t('block.nothingBefore', categoryNames())
      : null
  // With an id: without one, clearing it would clear the block's other warnings too (e.g. a run's error).
  block.setWarningText(warning, 'place')
  return dataset ? pythonNameOf(dataset) : null
}

/** Imports go to the top of the program once, however many blocks need them. */
export function needs(generator: PythonGenerator, ...imports: string[]) {
  // Blockly's own way for imports (finish() puts them first); the field is protected in its types only.
  const { definitions_ } = generator as unknown as { definitions_: Record<string, string> }
  for (const line of imports) definitions_[line] = line
}

/** Python for a value typed into a block: a number stays a number, anything else is text. */
export function literal(text: string): string {
  const trimmed = text.trim()
  if (/^-?\d+([.,]\d+)?$/.test(trimmed)) return trimmed.replace(',', '.')
  return JSON.stringify(text)
}

/** A column name as Python text, e.g. "value" → "value" in quotes. */
export const quoted = (name: string) => JSON.stringify(name)

let tracing = false

pythonGenerator.forBlock[DATASET] = (block, generator) => {
  const name = pythonNameOf(block)
  const steps = stepsOf(block)
  block.setWarningText(steps.length ? null : t('block.datasetEmpty', categoryNames()), 'empty')
  let code = `# ${t('code.dataset', { name: datasetNameOf(block) })}\n`
  for (const step of steps) {
    if (!step.isEnabled()) continue
    code += generator.blockToCode(step, true)
    if (tracing) {
      needs(generator, 'from spockly import merke')
      code += `merke(${JSON.stringify(step.id)}, ${name})\n`
    }
  }
  return `${code}\n`
}

/**
 * What the run skips without a word, said as hints for the results: blocks
 * outside any dataset (they don't run), an empty dataset, a finished dataset
 * that no block shows or uses.
 */
export function silentProblems(workspace: Blockly.Workspace): string[] {
  const hints: string[] = []
  const outside = workspace
    .getTopBlocks(true)
    .filter((top) => top.isEnabled() && top.type !== DATASET && isStep(top))
    .flatMap((top) => top.getDescendants(true).filter(isStep))
  if (outside.length) hints.push(t('hint.outside', { blocks: outside.map((b) => `„${blockText(b)}“`).join(', ') }))
  const named = new Set(
    workspace
      .getAllBlocks(false)
      .filter((b) => b.type !== DATASET && b.isEnabled())
      .map((b) => b.getFieldValue('DATASET')),
  )
  for (const dataset of datasetBlocks(workspace)) {
    const name = datasetNameOf(dataset)
    if (!stepsOf(dataset).length) hints.push(t('hint.datasetEmpty', { name, ...categoryNames() }))
    else if (!named.has(name)) hints.push(t('hint.notShown', { name, ...categoryNames() }))
  }
  return hints
}

/** The program as students see it, and the same with merke(…) lines and hints to run. */
export function generate(workspace: Blockly.Workspace): { shown: string; run: string } {
  tracing = false
  const shown = pythonGenerator.workspaceToCode(workspace).trim()
  tracing = true
  try {
    const run = pythonGenerator.workspaceToCode(workspace).trim()
    const hints = silentProblems(workspace).map((hint) => `hinweis(${JSON.stringify(hint)})`)
    if (!hints.length) return { shown, run }
    // First, so they show even if a step fails later.
    return { shown, run: `from spockly import hinweis\n${hints.join('\n')}\n\n${run}`.trim() }
  } finally {
    tracing = false
  }
}
