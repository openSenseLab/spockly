// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { adviceFor, allAdvice } from './advice'
import './index'

/** A dataset "formen" with the given steps, ids s0, s1, … */
function workspaceWith(...steps: { type: string; fields?: Record<string, unknown> }[]) {
  const chain = steps.reduceRight<object | undefined>(
    (next, step, i) => ({ block: { ...step, id: `s${i}`, ...(next ? { next } : {}) } }),
    undefined,
  )
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', fields: { NAME: 'formen' }, inputs: { STEPS: chain } }] } },
    workspace,
  )
  return workspace
}

const text: Snapshot = { art: 'text', text: '{"type": "FeatureCollection"}', anzahl: 30 }
const oneRow: Snapshot = { art: 'tabelle', spalten: ['type', 'features'], typen: {}, zeilen: [], anzahl: 1 }
const translated = (json: string): Snapshot => ({ art: 'json', text: json, anzahl: 2 })

describe('advice after a run that went through', () => {
  it('says why GeoJSON made a table of one row, and which block fits, with where to find it', () => {
    const workspace = workspaceWith({ type: 'load_file', fields: { FILE: 'parks.geojson' } }, { type: 'step_read_json' }, { type: 'step_json_table' })
    const snapshots = { s0: text, s1: translated('{\n  "type": "FeatureCollection",\n  "features": [\n'), s2: oneRow }
    const advice = adviceFor(workspace.getBlockById('s2')!, snapshots)
    expect(advice).toContain('„formen“ ist GeoJSON')
    expect(advice).toContain('„mache eine Tabelle aus GeoJSON: 1 Zeile pro Form“ (unter „Allgemeine Blöcke“)')
    expect(allAdvice(workspace, snapshots)).toEqual([{ blockId: 's2', text: advice }])
  })

  it('points a single openSenseMap station to the stations table', () => {
    const workspace = workspaceWith({ type: 'osem_box' }, { type: 'step_read_json' }, { type: 'step_json_table' })
    const advice = adviceFor(workspace.getBlockById('s2')!, { s0: text, s1: translated('{\n  "_id": "625c…",\n  "sensors": ['), s2: oneRow })
    expect(advice).toContain('„mache eine Tabelle aus den Stationen …“ (unter „openSenseMap“)')
  })

  it('points openSenseMap stations, read with the list block, to the stations block the measurements need', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' }, { type: 'step_read_json' }, { type: 'step_json_table' })
    const advice = adviceFor(workspace.getBlockById('s2')!, { s0: text, s1: translated('[\n  {\n    "_id": "625c…"'), s2: oneRow })
    expect(advice).toContain('Das hat geklappt: eine Zeile pro Station.')
    expect(advice).toContain('„mache eine Tabelle aus den Stationen …“ (unter „openSenseMap“)')
  })

  it('stays quiet for a list, and before the block ran', () => {
    const workspace = workspaceWith({ type: 'load_file', fields: { FILE: 'orte.json' } }, { type: 'step_read_json' }, { type: 'step_json_table' })
    const block = workspace.getBlockById('s2')!
    expect(adviceFor(block, { s0: text, s1: translated('[\n  {"ort": "Münster"}'), s2: oneRow })).toBeNull()
    expect(adviceFor(block, { s0: text, s1: translated('{"a": 1}') })).toBeNull()
  })
})
