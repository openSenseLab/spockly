// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import { narrowKinds, reasonForDrop, whyNotFit } from './fit'
import './index'

const workspace = () => new Blockly.Workspace()
const block = (ws: Blockly.Workspace, type: string) => ws.newBlock(type)
/** Whether Blockly lets `lower` snap under `upper`. */
const snaps = (ws: Blockly.Workspace, upper: Blockly.Connection, lower: Blockly.Block) =>
  ws.connectionChecker.canConnect(upper, lower.previousConnection, false)

describe('which blocks fit together', () => {
  it('lets a program be built in the order the data needs: get, translate, make a table, change columns', () => {
    const ws = workspace()
    const order = ['osem_fetch', 'step_read_json', 'osem_table', 'step_split_position', 'step_convert_column']
    const blocks = order.map((type) => block(ws, type))
    const dataset = block(ws, 'spockly_dataset')
    expect(snaps(ws, dataset.getInput('STEPS')!.connection!, blocks[0])).toBe(true)
    for (let i = 1; i < blocks.length; i++) expect(snaps(ws, blocks[i - 1].nextConnection!, blocks[i])).toBe(true)
    // CSV and GeoJSON have their own way to a table.
    expect(snaps(ws, block(ws, 'step_translate_csv').nextConnection!, block(ws, 'step_json_table'))).toBe(true)
    expect(snaps(ws, block(ws, 'step_read_json').nextConnection!, block(ws, 'step_geojson_table'))).toBe(true)
  })

  it('refuses what can\'t work, and says why, with the block that fits and where to find it', () => {
    const ws = workspace()
    const osem = block(ws, 'osem_fetch')
    const table = block(ws, 'osem_table')
    expect(snaps(ws, osem.nextConnection!, table)).toBe(false)
    expect(whyNotFit(osem.nextConnection!, table)).toContain('Dort ist es noch Text. Übersetz ihn zuerst mit „übersetze den JSON-Text …“ oder „übersetze den CSV-Text …“ (unter „Allgemeine Blöcke“)')

    const json = block(ws, 'step_read_json')
    const split = block(ws, 'step_split_position')
    expect(snaps(ws, json.nextConnection!, split)).toBe(false)
    expect(whyNotFit(json.nextConnection!, split)).toContain('Hier ist es übersetzt, aber noch keine Tabelle')

    const csv = block(ws, 'step_translate_csv')
    expect(whyNotFit(csv.nextConnection!, block(ws, 'step_geojson_table'))).toContain('Dafür passt „mache eine Tabelle aus der Liste“')
    expect(whyNotFit(table.nextConnection!, block(ws, 'step_read_json'))).toContain('Übersetzen kann man nur Text')
  })

  it('keeps blocks that get data at the top of a dataset, and the other steps below them', () => {
    const ws = workspace()
    const top = block(ws, 'spockly_dataset').getInput('STEPS')!.connection!
    expect(whyNotFit(top, block(ws, 'step_read_json'))).toContain('kann nicht oben in einem Datensatz stehen')
    expect(whyNotFit(block(ws, 'step_convert_column').nextConnection!, block(ws, 'load_file'))).toContain('gehört darum ganz oben in einen Datensatz')
  })

  it('sends the measurements to a dataset of their own, made from the rows they name', () => {
    const ws = workspace()
    const measurements = block(ws, 'osem_measurements')
    measurements.setFieldValue('sensors', 'DATASET')
    const split = block(ws, 'step_split_position')
    expect(snaps(ws, split.nextConnection!, measurements)).toBe(false)
    expect(whyNotFit(split.nextConnection!, measurements)).toBe(
      'Dieser Block macht einen neuen Datensatz aus den Zeilen von „sensors“. Darum steht er ganz oben in einem eigenen Datensatz: Zieh einen neuen „Datensatz“-Block (unter „Datensatz“) auf die Arbeitsfläche und steck diesen Block dort ganz oben hinein.',
    )
    expect(snaps(ws, block(ws, 'spockly_dataset').getInput('STEPS')!.connection!, measurements)).toBe(true)
  })

  it('keeps "zeige …" blocks below datasets, not inside', () => {
    const ws = workspace()
    expect(whyNotFit(block(ws, 'osem_table').nextConnection!, block(ws, 'view_map'))).toContain('gehört darum nicht in einen Datensatz, sondern darunter')
    expect(whyNotFit(block(ws, 'spockly_dataset').nextConnection!, block(ws, 'step_read_json'))).toContain('gehört in einen Datensatz hinein')
  })

  it('says nothing for blocks that fit', () => {
    const ws = workspace()
    expect(whyNotFit(block(ws, 'osem_fetch').nextConnection!, block(ws, 'step_read_json'))).toBeNull()
  })
})

describe('which spot a drop meant', () => {
  it('means the free spot at the end, even if a filled spot in between is a little nearer', () => {
    // Dropped a little high: nearest is under the first block (taken already), the free end just below.
    const spots = [
      { distance: 12, free: false, own: true, reason: 'not under the first block' },
      { distance: 40, free: true, own: true, reason: 'not under the last block' },
    ]
    expect(reasonForDrop(spots)).toBe('not under the last block')
  })

  it('says nothing if the meant spot fits: the block was just dropped too far away to snap', () => {
    expect(reasonForDrop([{ distance: 12, free: false, own: true, reason: 'in between' }, { distance: 50, free: true, own: true, reason: null }])).toBeNull()
  })

  it("means a place of the blocks' own kind: a step goes into a dataset, not below it", () => {
    const spots = [
      { distance: 20, free: true, own: false, reason: 'goes inside a dataset' },
      { distance: 46, free: true, own: true, reason: 'no table yet' },
    ]
    expect(reasonForDrop(spots)).toBe('no table yet')
  })

  it('takes the nearest spot in between when there is no free spot', () => {
    expect(reasonForDrop([{ distance: 30, free: false, own: true, reason: 'far' }, { distance: 10, free: false, own: true, reason: 'near' }])).toBe('near')
    expect(reasonForDrop([])).toBeNull()
  })
})

describe('JSON from openSenseMap, or from a file', () => {
  /** A dataset: the source, then "übersetze den JSON-Text" (id json), kinds narrowed as on the canvas. */
  function translated(source: string) {
    const ws = workspace()
    Blockly.serialization.workspaces.load(
      { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', inputs: { STEPS: { block: { type: source, next: { block: { type: 'step_read_json', id: 'json' } } } } } }] } },
      ws,
    )
    narrowKinds(ws)
    return { ws, json: ws.getBlockById('json')! }
  }

  it('takes the stations table only under openSenseMap', () => {
    const osem = translated('osem_fetch')
    expect(snaps(osem.ws, osem.json.nextConnection!, block(osem.ws, 'osem_table'))).toBe(true)
    const file = translated('load_file')
    const stations = block(file.ws, 'osem_table')
    expect(snaps(file.ws, file.json.nextConnection!, stations)).toBe(false)
    expect(whyNotFit(file.json.nextConnection!, stations)).toContain('Er ist nur für Stationen der openSenseMap. Für eine Datei nimm „mache eine Tabelle aus der Liste …“ oder bei GeoJSON „mache eine Tabelle aus GeoJSON …“')
  })

  it('takes the GeoJSON table only under a file, the list table under both', () => {
    const osem = translated('osem_fetch')
    const geojson = block(osem.ws, 'step_geojson_table')
    expect(snaps(osem.ws, osem.json.nextConnection!, geojson)).toBe(false)
    expect(whyNotFit(osem.json.nextConnection!, geojson)).toContain('Hier sind Stationen der openSenseMap, kein GeoJSON')
    expect(snaps(osem.ws, osem.json.nextConnection!, block(osem.ws, 'step_json_table'))).toBe(true)
    const file = translated('load_file')
    expect(snaps(file.ws, file.json.nextConnection!, block(file.ws, 'step_geojson_table'))).toBe(true)
    expect(snaps(file.ws, file.json.nextConnection!, block(file.ws, 'step_json_table'))).toBe(true)
  })

  it('pushes the stations table aside when its JSON turns out to come from a file', () => {
    const ws = workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'spockly_dataset', inputs: { STEPS: { block: { type: 'load_file', next: { block: { type: 'step_read_json', id: 'json', next: { block: { type: 'osem_table', id: 'tabelle' } } } } } } } }],
        },
      },
      ws,
    )
    narrowKinds(ws)
    expect(ws.getBlockById('tabelle')!.getPreviousBlock()).toBeNull()
  })
})
