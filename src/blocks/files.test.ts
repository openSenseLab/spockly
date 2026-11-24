// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { explainError } from './errors'
import { addFile, decodeFile, pythonFiles, safeName } from './fileStore'
import { generate, toolbox } from './index'

/** One dataset "messung" with the given steps, ids s0, s1, … */
function program(...steps: { type: string; fields?: Record<string, unknown> }[]) {
  const chain = steps.reduceRight<object | undefined>(
    (next, step, i) => ({ block: { ...step, id: `s${i}`, ...(next ? { next } : {}) } }),
    undefined,
  )
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', fields: { NAME: 'messung' }, inputs: { STEPS: chain } }] } },
    workspace,
  )
  return workspace
}

describe('own data', () => {
  it('translates a picked CSV file into a list, German decimals (12,5) included, then makes a table of the list', () => {
    const name = addFile('Messung Klasse 9b.csv', 'zeit;temperatur\n2026-05-03 10:00;12,5\n')
    expect(name).toBe('Messung_Klasse_9b.csv')
    const { shown } = generate(program({ type: 'load_file', fields: { FILE: name } }, { type: 'step_translate_csv' }, { type: 'step_json_table' }))
    expect(shown).toContain('messung = open("Messung_Klasse_9b.csv", encoding="utf-8").read()\n')
    expect(shown).toContain(
      'messung = pd.read_csv(io.StringIO(messung), sep=None, engine="python", decimal=",").to_dict("records")\nmessung = pd.json_normalize(messung)',
    )
    expect(shown).toContain('import io')
    expect(pythonFiles()['Messung_Klasse_9b.csv']).toContain('12,5')
  })

  it('reads JSON with the same step as openSenseMap, then makes a table of a list', () => {
    const { shown } = generate(program({ type: 'load_file', fields: { FILE: 'orte.json' } }, { type: 'step_read_json' }, { type: 'step_json_table' }))
    expect(shown).toContain('messung = json.loads(messung)\nmessung = pd.json_normalize(messung)')
  })

  it('translates GeoJSON like any JSON, then makes a table: one row per feature, its details as columns, its whole shape in "form"', () => {
    const { shown } = generate(program({ type: 'load_file', fields: { FILE: 'baeume.geojson' } }, { type: 'step_read_json' }, { type: 'step_geojson_table' }))
    expect(shown).toContain(
      'messung = json.loads(messung)\n' +
        'objekte = messung["features"]\n' +
        'messung = pd.json_normalize([objekt["properties"] or {} for objekt in objekte])\n' +
        'messung["form"] = [objekt["geometry"] for objekt in objekte]',
    )
  })

  it('shows shapes on the map with the same zeige_karte, the shapes in place of latitude and longitude', () => {
    const workspace = program({ type: 'load_file', fields: { FILE: 'gebiete.geojson' } }, { type: 'step_read_json' }, { type: 'step_geojson_table' })
    Blockly.serialization.blocks.append({ type: 'view_shapes', fields: { DATASET: 'messung', SHAPE: 'form' } }, workspace)
    expect(generate(workspace).shown).toContain('zeige_karte(messung, form="form", farbe=None, titel="messung")')
  })

  it('warns on a block whose file is gone (files stay only as long as the tab)', () => {
    // Without a screen Blockly draws no warnings, so this watches the call.
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    const workspace = program({ type: 'load_file', fields: { FILE: 'weg.csv' } })
    generate(workspace)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('„weg.csv“ ist nicht mehr da'), 'file')
    warn.mockRestore()
  })

  it('makes names Python can open, and keeps clear of the app\'s own spockly.py', () => {
    expect(safeName('Wetter (Juni) 2026.csv')).toBe('Wetter_Juni_2026.csv')
    expect(safeName('spockly.py')).toBe('daten_spockly.py')
  })

  it('reads files from a German Excel (Windows-1252) without broken umlauts', () => {
    const bytes = new Uint8Array([0x4d, 0xfc, 0x6e, 0x73, 0x74, 0x65, 0x72]) // "Münster" in Windows-1252
    expect(decodeFile(bytes.buffer)).toBe('Münster')
    expect(decodeFile(new TextEncoder().encode('﻿Münster').buffer as ArrayBuffer)).toBe('Münster')
  })
})

describe('explaining errors with own data', () => {
  const text: Snapshot = { art: 'text', text: '{"type": "Feature"}', anzahl: 18 }

  it('says the file is gone', () => {
    const problem = explainError("FileNotFoundError: [Errno 44] No such file or directory: 'weg.csv'", program({ type: 'load_file', fields: { FILE: 'weg.csv' } }), {})
    expect(problem.text).toContain('Die Datei ist nicht mehr da')
  })

  it('says when text is no JSON, or no CSV', () => {
    const workspace = program({ type: 'load_file', fields: { FILE: 'a.csv' } }, { type: 'step_read_json' })
    expect(explainError('JSONDecodeError: Expecting value', workspace, { s0: text }).text).toContain('kein JSON')
    const csv = program({ type: 'load_file', fields: { FILE: 'a.json' } }, { type: 'step_translate_csv' })
    expect(explainError('ParserError: …', csv, { s0: text }).text).toContain('nicht als CSV lesen')
  })

  it('says when JSON is no GeoJSON', () => {
    const workspace = program({ type: 'load_file', fields: { FILE: 'a.geojson' } }, { type: 'step_read_json' }, { type: 'step_geojson_table' })
    const list: Snapshot = { art: 'json', text: '[]', anzahl: 3 }
    expect(explainError("KeyError: 'features'", workspace, { s0: text, s1: list }).text).toContain('kein GeoJSON')
  })
})

describe('toolbox', () => {
  type Entry = { kind: string; name?: string; type?: string; contents?: Entry[] }
  const types = (entry: Entry): string[] => (entry.type ? [entry.type] : (entry.contents ?? []).flatMap(types))
  const source = (name: string) => (toolbox.contents as Entry[]).find((c) => c.name === name)!

  const labels = (entry: Entry & { text?: string }) => (entry.contents as (Entry & { text?: string })[]).filter((e) => e.kind === 'label').map((e) => e.text)

  it('has one category per source with its own blocks, and one for the blocks every source uses', () => {
    expect(types(source('openSenseMap'))).toEqual(['osem_fetch', 'osem_table', 'osem_measurements'])
    expect(types(source('Eigene Daten'))).toEqual(['load_file'])
    expect(types(source('Allgemeine Blöcke'))).toEqual([
      'step_read_json',
      'step_translate_csv',
      'step_json_table',
      'step_geojson_table',
      'step_split_position',
      'step_convert_column',
    ])
    expect(types(source('Zeigen'))).toEqual(['view_table', 'view_map', 'view_shapes', 'view_chart'])
  })

  it('groups blocks by what they do, under headers that set no order', () => {
    expect(labels(source('openSenseMap'))).toEqual(['Stationen holen', 'Tabelle machen', 'Messwerte holen'])
    expect(labels(source('Eigene Daten'))).toEqual(['Datei öffnen'])
    expect(labels(source('Allgemeine Blöcke'))).toEqual(['Text übersetzen', 'Tabelle machen', 'Spalten bearbeiten'])
  })
})
