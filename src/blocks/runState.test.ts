// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import './index'
import { ranAsItIs, signatures } from './runState'

const stack = (...blocks: object[]) =>
  blocks.reduceRight<object | undefined>((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), undefined)!

/** Sensors (a file, translated from CSV, a column made a number), their measurements, and a map of each. */
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
                    { type: 'step_convert_column', id: 'zahl', fields: { COLUMN: 'wert', TO: 'number' } },
                  ),
                },
              },
            },
            {
              type: 'spockly_dataset',
              fields: { NAME: 'orte' },
              inputs: { STEPS: { block: { type: 'osem_box', id: 'box' } } },
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

const ids = ['datei', 'csv', 'zahl', 'box', 'mess', 'tabelle', 'orte_zeigen']
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
    workspace.getBlockById('csv')!.nextConnection!.targetBlock()!.setFieldValue('date', 'TO')
    expect(current(workspace, then)).toEqual(['datei', 'csv', 'box', 'orte_zeigen'])
  })

  it('not the blocks after one that failed: they have no Zwischenstand', () => {
    const workspace = program()
    const { zahl: _zahl, mess: _mess, tabelle: _tabelle, ...reached } = allRan
    expect(current(workspace, signatures(workspace, 0), reached)).toEqual(['datei', 'csv', 'box', 'orte_zeigen'])
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
