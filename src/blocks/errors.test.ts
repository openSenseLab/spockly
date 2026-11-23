// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { explainError } from './errors'
import './index'

/** A dataset with the given steps, ids s0, s1, … */
function workspaceWith(...steps: { type: string; fields?: Record<string, unknown> }[]) {
  const chain = steps.reduceRight<object | undefined>(
    (next, step, i) => ({ block: { ...step, id: `s${i}`, ...(next ? { next } : {}) } }),
    undefined,
  )
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', fields: { NAME: 'sensoren' }, inputs: { STEPS: chain } }] } },
    workspace,
  )
  return workspace
}

const text: Snapshot = { art: 'text', text: '[{"_id": "a"}]', anzahl: 14 }
const table: Snapshot = { art: 'tabelle', spalten: ['sensor_id'], typen: { sensor_id: 'object' }, zeilen: [], anzahl: 0 }

describe('explainError', () => {
  it('finds the block that failed and says the data is still text (the JSON step is missing)', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' })
    Blockly.serialization.blocks.append({ type: 'view_table', id: 'tabelle', fields: { DATASET: 'sensoren' } }, workspace)
    const problem = explainError('Traceback …\nNotImplementedError', workspace, { s0: text })
    expect(problem.blockId).toBe('tabelle')
    // openSenseMap answers JSON: only the block for that, and where to find it.
    expect(problem.text).toBe(
      '„sensoren“ ist noch Text, so wie er ankam, und zeigen lässt sich erst eine Tabelle. Übersetz ihn zuerst mit „übersetze den JSON-Text für Python“ (unter „Allgemeine Blöcke“): im Datensatz „sensoren“ unten dazu.',
    )
  })

  it('suggests the block that fits the file, with its category', () => {
    const csv = workspaceWith({ type: 'load_file', fields: { FILE: 'messung.csv' } })
    Blockly.serialization.blocks.append({ type: 'view_table', fields: { DATASET: 'sensoren' } }, csv)
    expect(explainError("AttributeError: 'str' object has no attribute 'columns'", csv, { s0: text }).text).toContain(
      'Übersetz ihn zuerst mit „übersetze den CSV-Text für Python“ (unter „Allgemeine Blöcke“)',
    )
    const geojson = workspaceWith({ type: 'load_file', fields: { FILE: 'parks.geojson' } }, { type: 'step_read_json' })
    Blockly.serialization.blocks.append({ type: 'view_table', id: 'tabelle', fields: { DATASET: 'sensoren' } }, geojson)
    expect(explainError("AttributeError: 'dict' object has no attribute 'columns'", geojson, { s0: text, s1: { art: 'json', text: '{}', anzahl: 2 } }).text).toContain(
      'Mach zuerst eine Tabelle daraus, mit „mache eine Tabelle aus GeoJSON …“ (unter „Allgemeine Blöcke“)',
    )
  })

  it('names a missing column', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' }, { type: 'step_read_json' }, { type: 'osem_table' }, { type: 'step_convert_column', fields: { COLUMN: 'titel', TO: 'number' } })
    const problem = explainError("Traceback …\nKeyError: 'titel'", workspace, { s0: text, s1: { art: 'json', text: '[]', anzahl: 1 }, s2: table })
    expect(problem.blockId).toBe('s3')
    expect(problem.text).toBe('In „sensoren“ gibt es hier keine Spalte „titel“. Klick auf den Block davor und schau im Zwischenstand, welche Spalten es gibt.')
  })

  it('finds a failed "zeige …" block and says why: JSON is no table yet (Python: \'list\' object has no attribute \'columns\')', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' }, { type: 'step_read_json' })
    Blockly.serialization.blocks.append({ type: 'view_map', id: 'karte', fields: { DATASET: 'sensoren' } }, workspace)
    const problem = explainError("Traceback …\nAttributeError: 'list' object has no attribute 'columns'", workspace, {
      s0: text,
      s1: { art: 'json', text: '[]', anzahl: 1 },
    })
    expect(problem.blockId).toBe('karte')
    expect(problem.text).toContain('„sensoren“ ist übersetzt (Listen und Einträge), aber noch keine Tabelle')
  })

  it('names a missing column of a "zeige …" block, with the columns there are', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' })
    Blockly.serialization.blocks.append({ type: 'view_map', id: 'karte', fields: { DATASET: 'sensoren' } }, workspace)
    const problem = explainError("KeyError: 'Diese Spalte gibt es nicht: lat. Vorhanden: name, ort'", workspace, { s0: table })
    expect(problem.text).toBe('Im Block ist die Spalte „lat“ gewählt, aber „sensoren“ hat keine Spalte mit diesem Namen. Wähl im Block eine Spalte, die es gibt: name, ort.')
  })

  it('explains kinds of Python errors anywhere, and gives a tip for unknown ones', () => {
    const workspace = workspaceWith({ type: 'osem_measurements' }, { type: 'step_convert_column', fields: { COLUMN: 'zeit', TO: 'date' } })
    const date = explainError('DateParseError: Unknown datetime string format, unable to parse: gestern', workspace, { s0: table })
    expect(date.text).toContain('sehen nicht wie ein Datum aus')
    const unknown = explainError('ZeroDivisionError: division by zero', workspace, { s0: table })
    expect(unknown.text).toBe(
      'Python meldet: „division by zero“. So findest du die Ursache: Klick auf den Block davor und schau im Zwischenstand, wie die Daten an dieser Stelle aussehen. Passen sie zu dem, was dieser Block braucht?',
    )
  })

  it('passes on the message of a "zeige …" block, which spockly.py already writes in German', () => {
    const workspace = workspaceWith({ type: 'osem_boxes' })
    const problem = explainError("Traceback …\nKeyError: 'Diese Spalte gibt es nicht: lat. Vorhanden: name'", workspace, { s0: text })
    expect(problem).toEqual({ blockId: null, text: 'Diese Spalte gibt es nicht: lat. Vorhanden: name' })
  })
})

describe('a map block that doesn\'t fit the data', () => {
  // As Python reports it: the traceback repeats the line of spockly.py that raised the error.
  const traceback = (missing: string, there: string) =>
    'Traceback (most recent call last):\n' +
    '  File "/spockly.py", line 57, in _pruefe_spalten\n' +
    "    raise KeyError(f\"Diese Spalte gibt es nicht: {', '.join(fehlen)}. Vorhanden: {', '.join(map(str, daten.columns))}\")\n" +
    `KeyError: 'Diese Spalte gibt es nicht: ${missing}. Vorhanden: ${there}'`
  const shapes: Snapshot = {
    art: 'tabelle',
    spalten: ['name', 'form'],
    typen: { name: 'str', form: 'object' },
    zeilen: [['Park', { type: 'Polygon', coordinates: [[[7.6, 51.9], [7.7, 51.9], [7.7, 52], [7.6, 51.9]]] }]],
    anzahl: 1,
  }

  function workspaceShowing(view: string, fields: Record<string, unknown>) {
    const workspace = workspaceWith({ type: 'load_file', fields: { FILE: 'parks.geojson' } })
    Blockly.serialization.blocks.append({ type: view, id: 'karte', fields: { DATASET: 'sensoren', ...fields } }, workspace)
    return workspace
  }

  it('names the missing columns from Python\'s message, not from the source line in the traceback', () => {
    const problem = explainError(traceback('lat', 'name, ort'), workspaceShowing('view_map', { LAT: 'lat', LON: 'lon' }), { s0: table })
    expect(problem.text).toBe('Im Block ist die Spalte „lat“ gewählt, aber „sensoren“ hat keine Spalte mit diesem Namen. Wähl im Block eine Spalte, die es gibt: name, ort.')
  })

  it('points shapes on the point map to the shapes map, with where to find it', () => {
    const problem = explainError(traceback('lat, lon', 'name, form'), workspaceShowing('view_map', { LAT: 'lat', LON: 'lon' }), { s0: shapes })
    expect(problem.blockId).toBe('karte')
    expect(problem.text).toContain('sondern ganze Formen (Punkte, Linien, Flächen) in der Spalte „form“')
    expect(problem.text).toContain('„zeige … auf der Karte – Formen aus …“ (unter „Zeigen“)')
  })

  it('points the shapes map on data without shapes to the point map', () => {
    const problem = explainError(traceback('form', 'sensor_id'), workspaceShowing('view_shapes', { SHAPE: 'form' }), { s0: table })
    expect(problem.text).toContain('hat keine Spalte mit ganzen Formen')
    expect(problem.text).toContain('„zeige … auf der Karte – Breitengrad … Längengrad …“ (unter „Zeigen“)')
  })
})
