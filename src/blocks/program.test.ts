// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import { generate } from './index'

/** Blocks one under the other, each the `next` of the one above. */
const stack = (...blocks: object[]) =>
  blocks.reduceRight<object | undefined>((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), undefined)!

/** A "Datensatz" block with these steps inside. */
const dataset = (id: string, name: string, ...steps: object[]) => ({
  type: 'spockly_dataset',
  id,
  fields: { NAME: name },
  ...(steps.length ? { inputs: { STEPS: { block: stack(...steps) } } } : {}),
})

const state = (...blocks: object[]) => ({ blocks: { languageVersion: 0, blocks } })

/** The openSenseMap example: sensors in Münster-Mitte → their measurements → map and time chart. */
const program = state(
  stack(
    dataset(
      'sensoren',
      'Sensoren',
      { type: 'osem_boxes', id: 'boxen', fields: { AREA: 'muenster-mitte', OUTDOOR: true } },
      { type: 'step_read_json', id: 'json' },
      { type: 'osem_table', id: 'tabelle', fields: { ROWS: 'sensor' } },
      { type: 'step_split_position', id: 'lage', fields: { COLUMN: 'koordinaten', FIRST: 'lon', SECOND: 'lat' } },
    ),
    dataset(
      'messwerte',
      'messwerte',
      { type: 'osem_measurements', id: 'messungen', fields: { DATASET: 'Sensoren', PERIOD: '1d' } },
      { type: 'step_convert_column', id: 'zahl', fields: { COLUMN: 'value', TO: 'number' } },
      { type: 'step_convert_column', id: 'datum', fields: { COLUMN: 'createdAt', TO: 'date' } },
    ),
    { type: 'view_map', fields: { DATASET: 'messwerte', LAT: 'lat', LON: 'lon', COLOUR: 'value' } },
    { type: 'view_chart', id: 'verlauf', fields: { DATASET: 'messwerte', TIME: 'createdAt', VALUE: 'value', GROUP: 'station_name' } },
  ),
)

function load(state: object) {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, workspace)
  return workspace
}

describe('generate', () => {
  const { shown, run } = generate(load(program))

  it('writes one Python step per block, on the dataset named on the block', () => {
    expect(shown).toContain('# Datensatz „Sensoren“\n')
    expect(shown).toContain(
      'sensoren = open_url("https://api.opensensemap.org/boxes?bbox=7.5897085%2C51.9205942%2C7.6647924%2C51.989764&format=json&exposure=outdoor").read()',
    )
    expect(shown).toContain('sensoren = json.loads(sensoren)')
    expect(shown).toContain('sensoren = pd.json_normalize(sensoren, record_path="sensors", record_prefix="sensor_",')
    expect(shown).toContain('teile = sensoren["koordinaten"].map(in_teile)\nsensoren["lon"] = teile.str[0]\nsensoren["lat"] = teile.str[1]\n')
  })

  it('hides the loop over the rows in one block, but shows it in Python', () => {
    expect(shown).toContain('for _, zeile in aktiv.head(50).iterrows():')
    expect(shown).toContain('messwerte = pd.concat(teile, ignore_index=True) if teile else pd.DataFrame()')
    expect(shown).toContain('messwerte["value"] = pd.to_numeric(messwerte["value"], errors="coerce")')
  })

  it('asks only stations that measured in the period, since openSenseMap lists its long-silent ones first', () => {
    expect(shown).toContain('zuletzt = pd.to_datetime(sensoren["station_lastMeasurementAt"], utc=True, errors="coerce")\naktiv = sensoren[zuletzt >= von]\n')
  })

  it('explains an empty result with a hinweis(…) for the results', () => {
    expect(shown).toContain('from spockly import hinweis')
    expect(shown).toMatch(/if len\(sensoren\) == 0:\n {4}hinweis\("0 Messwerte: „Sensoren“ hat hier keine Zeilen mehr\./)
    expect(shown).toMatch(/elif len\(aktiv\) == 0:\n {4}hinweis\("0 Messwerte: Keine Station in „Sensoren“ hat im Zeitraum „letzte 24 Stunden“ gemessen\./)
    expect(shown).toMatch(/if len\(aktiv\) > 0 and len\(messwerte\) == 0:\n {4}hinweis\("0 Messwerte: /)
    // Decided before the loop: the result may replace the very dataset the rows come from.
    expect(shown.indexOf('elif len(aktiv) == 0:')).toBeLessThan(shown.indexOf('for _, zeile in aktiv'))
  })

  it('asks fewer sensors for longer periods', () => {
    const week = JSON.parse(JSON.stringify(program).replace('"PERIOD":"1d"', '"PERIOD":"7d"'))
    const code = generate(load(week)).shown
    expect(code).toContain('von = bis - timedelta(days=7)')
    expect(code).toContain('for _, zeile in aktiv.head(10).iterrows():')
  })

  it('warns at once on a step outside a dataset, or on an empty dataset', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    generate(load(state({ type: 'step_read_json' })))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('steckt in keinem „Datensatz“'), 'place')
    warn.mockClear()
    generate(load(state(dataset('leer', 'leer'))))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Dieser Datensatz ist noch leer'), 'empty')
    warn.mockRestore()
  })

  it('says in the results what would otherwise do nothing without a word', () => {
    // A student's first try: the blocks next to the dataset, not inside it, and nothing to show it.
    const { shown, run } = generate(
      load(state(dataset('sensoren', 'sensoren'), { ...stack({ type: 'load_file', fields: { FILE: 'a.csv' } }, { type: 'step_translate_csv' }), x: 0, y: 200 })),
    )
    expect(run).toMatch(/^from spockly import hinweis\n/)
    expect(run).toContain('hinweis("Diese Blöcke wurden nicht ausgeführt, weil sie in keinem „Datensatz“ stecken: „öffne die Datei a.csv“, „übersetze den CSV-Text für Python')
    expect(run).toContain('hinweis("Der Datensatz „sensoren“ ist leer')
    expect(shown).not.toContain('hinweis')

    const notShown = generate(load(state(dataset('d', 'orte', { type: 'load_file', fields: { FILE: 'a.csv' } })))).run
    expect(notShown).toContain('hinweis("Der Datensatz „orte“ ist fertig, aber kein Block zeigt ihn.')
    // The sensors of the example aren't shown, but the measurements use them: no hint.
    expect(generate(load(program)).run).not.toContain('hinweis("Der Datensatz')
  })

  it('shows data with the zeige_… functions, after the datasets', () => {
    expect(shown).toContain('zeige_karte(messwerte, breite="lat", laenge="lon", farbe="value", titel="messwerte")')
    expect(shown.indexOf('zeige_karte(messwerte')).toBeGreaterThan(shown.indexOf('messwerte = pd.concat'))
    expect(shown).toContain('from spockly import zeige_karte')
  })

  it('imports each module once, at the top', () => {
    expect(shown.match(/^import pandas as pd$/gm)).toHaveLength(1)
    expect(shown.indexOf('import pandas as pd')).toBeLessThan(shown.indexOf('# Datensatz'))
  })

  it('runs the same code with a merke(…) after each step, for the Zwischenstand', () => {
    expect(shown).not.toContain('merke(')
    expect(run).toContain('sensoren = json.loads(sensoren)\nmerke("json", sensoren)')
    expect(run).toContain('merke("datum", messwerte)')
    // Also after each "zeige …" block: then a failed one is known too.
    expect(run).toMatch(/^zeige_zeitverlauf\(.*\nmerke\("verlauf", messwerte\)$/m)
    expect(run.replace(/^merke\(.*\n?/gm, '').replace('from spockly import merke\n', '').trim()).toBe(shown)
  })

})
