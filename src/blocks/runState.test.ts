// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import './index'
import { FAILED_CLASS, markFailure, ranAsItIs, signatures, unchangedSinceRun } from './runState'

const stack = (...blocks: object[]) =>
  blocks.reduceRight<object | undefined>((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), undefined)!

/** Sensors (a file, translated from CSV, made a table, a column made a number), their measurements, and a map of each. */
function program() {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    {
      blocks: {
        languageVersion: 0,
        blocks: [
          stack(
            {
              type: 'spockly_dataset',
              fields: { NAME: 'sensoren' },
              inputs: {
                STEPS: {
                  block: stack(
                    { type: 'load_file', id: 'datei', fields: { FILE: 'a.csv' } },
                    { type: 'step_translate_csv', id: 'csv' },
                    { type: 'step_json_table', id: 'liste' },
                    { type: 'step_convert_column', id: 'zahl', fields: { COLUMN: 'wert', TO: 'number' } },
                  ),
                },
              },
            },
            {
              type: 'spockly_dataset',
              fields: { NAME: 'orte' },
              inputs: { STEPS: { block: { type: 'osem_fetch', id: 'box' } } },
            },
            {
              type: 'spockly_dataset',
              fields: { NAME: 'messwerte' },
              inputs: { STEPS: { block: { type: 'osem_measurements', id: 'mess', fields: { DATASET: 'sensoren', PERIOD: '1d' } } } },
            },
            { type: 'view_table', id: 'tabelle', fields: { DATASET: 'sensoren' } },
            { type: 'view_table', id: 'orte_zeigen', fields: { DATASET: 'orte' } },
          ),
        ],
      },
    },
    workspace,
  )
  return workspace
}

const ids = ['datei', 'csv', 'liste', 'zahl', 'box', 'mess', 'tabelle', 'orte_zeigen']
const ran: Snapshot = { art: 'text', text: '', anzahl: 0 }
const allRan = Object.fromEntries(ids.map((id) => [id, ran]))
/** The blocks whose result from the run is still what the blocks say. */
const current = (workspace: Blockly.Workspace, ranThen: Record<string, string>, snapshots = allRan, files = 0) =>
  ids.filter((id) => ranAsItIs(workspace.getBlockById(id)!, ranThen, snapshots, files))

describe('which blocks the last run covered', () => {
  it('all of them, right after a run that went through', () => {
    const workspace = program()
    expect(current(workspace, signatures(workspace, 0))).toEqual(ids)
  })

  it('not a changed step, nor what depends on it: the steps below, a dataset made from it, its "zeige …"', () => {
    const workspace = program()
    const then = signatures(workspace, 0)
    workspace.getBlockById('zahl')!.setFieldValue('date', 'TO')
    expect(current(workspace, then)).toEqual(['datei', 'csv', 'liste', 'box', 'orte_zeigen'])
  })

  it('not the blocks after one that failed: they have no Zwischenstand', () => {
    const workspace = program()
    const { zahl: _zahl, mess: _mess, tabelle: _tabelle, ...reached } = allRan
    expect(current(workspace, signatures(workspace, 0), reached)).toEqual(['datei', 'csv', 'liste', 'box', 'orte_zeigen'])
  })

  it('not a file picked again under the same name, nor what comes from it', () => {
    const workspace = program()
    expect(current(workspace, signatures(workspace, 0), allRan, 1)).toEqual(['box', 'orte_zeigen'])
  })

  it('not a new block', () => {
    const workspace = program()
    const then = signatures(workspace, 0)
    const added = Blockly.serialization.blocks.append({ type: 'view_table', fields: { DATASET: 'orte' } }, workspace)
    expect(ranAsItIs(added, then, { ...allRan, [added.id]: ran }, 0)).toBe(false)
  })
})

describe('the block a run failed at', () => {
  it('stays the failed block until it, or a step above it, changes', () => {
    const workspace = program()
    const then = signatures(workspace, 0)
    const zahl = workspace.getBlockById('zahl')!
    expect(unchangedSinceRun(zahl, then, 0)).toBe(true)
    workspace.getBlockById('liste')!.dispose(true)
    expect(unchangedSinceRun(zahl, then, 0)).toBe(false)
    expect(unchangedSinceRun(zahl, null, 0)).toBe(false)
  })

  it('is drawn red, says why in its warning and on hover, and lets go once it is changed', () => {
    // Blockly measures text on a canvas, which jsdom lacks (and says so, at length).
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
    const div = document.body.appendChild(document.createElement('div'))
    const workspace = Blockly.inject(div, {})
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(program()), workspace)
    const then = signatures(workspace, 0)
    const zahl = workspace.getBlockById('zahl') as Blockly.BlockSvg
    const own = Blockly.Tooltip.getTooltipOfObject(zahl)
    const failure = { blockId: 'zahl', text: 'Die Spalte „wert“ gibt es nicht.' }

    expect(markFailure(workspace, failure, then, 0)).toBe(zahl)
    expect(zahl.getSvgRoot().classList.contains(FAILED_CLASS)).toBe(true)
    expect(zahl.getIcon(Blockly.icons.WarningIcon.TYPE)).toBeDefined()
    expect(Blockly.Tooltip.getTooltipOfObject(zahl)).toBe('Hier ist der Lauf stehen geblieben:\nDie Spalte „wert“ gibt es nicht.')
    // Marked already: not new again (the canvas opens the warning only once).
    expect(markFailure(workspace, failure, then, 0)).toBeNull()

    zahl.setFieldValue('date', 'TO')
    markFailure(workspace, failure, then, 0)
    expect(zahl.getSvgRoot().classList.contains(FAILED_CLASS)).toBe(false)
    expect(zahl.getIcon(Blockly.icons.WarningIcon.TYPE)).toBeUndefined()
    expect(Blockly.Tooltip.getTooltipOfObject(zahl)).toBe(own)
    workspace.dispose()
  })
})
