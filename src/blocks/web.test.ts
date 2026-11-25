// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { adviceFor } from './advice'
import { explainError, sourceOf } from './errors'
import { narrowKinds } from './fit'
import { generate } from './index'
import { blockText } from './program'
import { guessKind, WEB_EXAMPLES } from './web/examples'

const QUAKES = WEB_EXAMPLES[0].url
const CRANES = WEB_EXAMPLES.find((example) => example.id === 'kraniche_muenster')!.url

/** A dataset "welt": the web block (id web) with these fields, then the given steps (ids s1, s2, …). */
function program(fields: Record<string, unknown> = {}, ...steps: { type: string; fields?: Record<string, unknown> }[]) {
  const chain = [{ type: 'load_url', id: 'web', fields }, ...steps.map((step, i) => ({ ...step, id: `s${i + 1}` }))].reduceRight<object | undefined>(
    (next, block) => ({ block: { ...block, ...(next ? { next } : {}) } }),
    undefined,
  )
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', fields: { NAME: 'welt' }, inputs: { STEPS: chain } }] } },
    workspace,
  )
  return workspace
}
const text = (value: string): Snapshot => ({ art: 'text', text: value, anzahl: value.length })

describe('data from a web address', () => {
  it('starts with an example that works from the browser, and fetches its text', () => {
    const workspace = program()
    const block = workspace.getBlockById('web')!
    expect(block.getFieldValue('URL')).toBe(QUAKES)
    expect(block.getFieldValue('SOURCE')).toBe('Quelle: U.S. Geological Survey (USGS)')
    expect(generate(workspace).shown).toContain(`welt = hole_text("${QUAKES}")`)
  })

  it('writes a chosen example\'s address into the field; another address makes it an own one', () => {
    const block = program().getBlockById('web')!
    block.setFieldValue('kraniche_muenster', 'EXAMPLE')
    expect(block.getFieldValue('URL')).toBe(CRANES)
    expect(block.getFieldValue('SOURCE')).toBe('Quelle: GBIF – Global Biodiversity Information Facility')
    block.setFieldValue('  https://example.org/daten.csv ', 'URL')
    expect(block.getFieldValue('EXAMPLE')).toBe('own')
    expect(block.getFieldValue('URL')).toBe('https://example.org/daten.csv')
    expect(block.getFieldValue('SOURCE')).toBe('Quelle: example.org')
  })

  it('is named by its example, or its own address, in headings and messages', () => {
    expect(blockText(program().getBlockById('web')!)).toBe('hole die Daten von Erdbeben weltweit, letzte 7 Tage')
    expect(blockText(program({ EXAMPLE: 'own', URL: 'https://example.org/a.json' }).getBlockById('web')!)).toBe('hole die Daten von https://example.org/a.json')
  })

  it('keeps an own address when a program is loaded again', () => {
    const block = program({ EXAMPLE: 'own', URL: 'https://example.org/a.json' }).getBlockById('web')!
    expect(block.getFieldValue('EXAMPLE')).toBe('own')
    expect(block.getFieldValue('URL')).toBe('https://example.org/a.json')
  })

  it('warns and fetches nothing without a web address', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    expect(generate(program({ EXAMPLE: 'own', URL: 'meine Daten' })).shown).not.toContain('hole_text(')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('„meine Daten“ ist keine Webadresse'), 'url')
    warn.mockRestore()
  })

  it('knows what an address sends: the examples, and own addresses by their ending', () => {
    expect(guessKind(QUAKES)).toBe('geojson')
    // EMSC's "format=json" is GeoJSON: known as an example.
    expect(guessKind(WEB_EXAMPLES[1].url)).toBe('geojson')
    expect(guessKind(CRANES)).toBe('json')
    expect(guessKind('https://example.org/messung.CSV')).toBe('csv')
    expect(guessKind('https://example.org/api?format=csv&jahr=2025')).toBe('csv')
    expect(guessKind('https://example.org/orte.json#oben')).toBe('json')
    expect(guessKind('https://example.org/karte')).toBeNull()
    expect(sourceOf(program().getBlockById('web')!.getSurroundParent())).toBe('geojson')
  })

  it('makes rows of a list inside an object, like GBIF\'s "results", without advice to use a list', () => {
    const workspace = program({ EXAMPLE: 'kraniche_muenster' }, { type: 'step_read_json' }, { type: 'step_json_table' })
    expect(generate(workspace).shown).toContain('welt = pd.json_normalize(liste_in(welt))')
    const translated: Snapshot = { art: 'json', text: '{"count": 2, "results": [{"key": 1}, {"key": 2}]}', anzahl: 2 }
    const rows = (anzahl: number): Snapshot => ({ art: 'tabelle', spalten: ['key'], typen: {}, zeilen: [], anzahl })
    expect(adviceFor(workspace.getBlockById('s2')!, { s1: translated, s2: rows(2) })).toBeNull()
    // Without a list inside, still one row, and the advice.
    expect(adviceFor(workspace.getBlockById('s2')!, { s1: { ...translated, text: '{"name": "Kranich"}' }, s2: rows(1) })).toContain('hat nur 1 Zeile')
  })

  it('passes on plain JSON, not openSenseMap stations: the stations table doesn\'t fit under it', () => {
    const workspace = program({}, { type: 'step_read_json' })
    narrowKinds(workspace)
    expect(workspace.getBlockById('s1')!.nextConnection!.getCheck()).toEqual(['JSON'])
  })
})

describe('when a web address fails', () => {
  it('says there was no answer, and why that may be: wrong address, offline, or not allowed', () => {
    const problem = explainError('ConnectionError: Keine Antwort von https://example.org/a.json', program({ EXAMPLE: 'own', URL: 'https://example.org/a.json' }), {})
    expect(problem.blockId).toBe('web')
    expect(problem.text).toContain('Von „https://example.org/a.json“ kam keine Antwort')
    expect(problem.text).toContain('oder die Webseite erlaubt nicht, dass andere Seiten ihre Daten laden')
    expect(problem.text).toContain('„öffne die Datei …“ (unter „Eigene Daten“)')
  })

  it('names the error code: nothing there (404), or another one', () => {
    const workspace = program({ EXAMPLE: 'own', URL: 'https://example.org/weg.csv' })
    expect(explainError('ConnectionError: Antwort 404 von https://example.org/weg.csv', workspace, {}).text).toContain('gibt es nichts (Fehler 404)')
    expect(explainError('ConnectionError: Antwort 503 von https://example.org/weg.csv', workspace, {}).text).toContain('mit Fehler 503 geantwortet')
  })

  it('says when the address leads to a web page, not data', () => {
    const workspace = program({ EXAMPLE: 'own', URL: 'https://example.org/seite' }, { type: 'step_read_json' })
    const problem = explainError('JSONDecodeError: Expecting value: line 1 column 1', workspace, { web: text('<!DOCTYPE html><html>…') })
    expect(problem.blockId).toBe('s1')
    expect(problem.text).toContain('In „welt“ steht eine Webseite (HTML), keine Daten')
  })
})
