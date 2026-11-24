// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { explainError } from './errors'
import { boxStatus, DEFAULT_BOX } from './osem'
import { generate } from './index'
import { daysBetween, parseBbox, parseDay, rowsFor } from './osem/presets'

/** A dataset "station" with the given steps (ids s0, s1, …), and optionally more top-level blocks. */
function workspaceWith(steps: { type: string; fields?: Record<string, unknown>; inputs?: object; extraState?: object }[], ...others: object[]) {
  const chain = steps.reduceRight<object | undefined>(
    (next, step, i) => ({ block: { ...step, id: `s${i}`, ...(next ? { next } : {}) } }),
    undefined,
  )
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: [{ type: 'spockly_dataset', fields: { NAME: 'station' }, inputs: { STEPS: chain } }, ...others] } },
    workspace,
  )
  return workspace
}

const ID = '625c512a18aca4001cadae87'

/** The openSenseMap block (id s0): by these station IDs, one row each. */
const byIds = (...ids: string[]) => ({
  type: 'osem_fetch',
  extraState: { stations: ids.length },
  fields: Object.fromEntries(ids.map((id, i) => [`BOX${i}`, id])),
})
/** The openSenseMap block (id s0), fetching an area. */
const byArea = (fields: Record<string, unknown> = {}) => ({ type: 'osem_fetch', fields: { MODE: 'area', ...fields } })
type FetchBlock = Blockly.Block & { setStations(count: number): void }
const visible = (block: Blockly.Block) => block.inputList.filter((input) => input.isVisible()).map((input) => input.name)
const OTHER = 'aaaaaaaaaaaaaaaaaaaaaaaa'

describe('fetching stations: one or more by their ID, or an area, in one block', () => {
  it('fetches each station by its ID, into one list, as JSON text', () => {
    const { shown } = generate(workspaceWith([byIds(ID, OTHER)]))
    expect(shown).toContain('station = []\n')
    expect(shown).toContain(`for station_id in ["${ID}","${OTHER}"]:\n`)
    expect(shown).toContain('    antwort = json.load(open_url(f"https://api.opensensemap.org/boxes/{station_id}?format=json"))\n')
    expect(shown).toContain('        station.append(antwort)\n')
    expect(shown).toContain('station = json.dumps(station)')
  })

  it('starts with one station in Münster, so a new block works at once', () => {
    const { shown } = generate(workspaceWith([{ type: 'osem_fetch' }]))
    expect(shown).toContain(`["${DEFAULT_BOX}"]`)
  })

  it('fetches the stations in an area: a preset, only outdoor ones if ticked, or a rectangle typed in', () => {
    expect(generate(workspaceWith([byArea({ PRESET: 'muenster-mitte', OUTDOOR: true })])).shown).toContain(
      'station = open_url("https://api.opensensemap.org/boxes?bbox=7.5897085%2C51.9205942%2C7.6647924%2C51.989764&format=json&exposure=outdoor").read()',
    )
    // Pasted from a bounding box finder, as it gives it.
    const own = byArea({ PRESET: 'custom', BBOX: '-105.342407,39.351290,-104.392090,39.972911', OUTDOOR: false })
    const { shown } = generate(workspaceWith([own]))
    expect(shown).toContain(
      'station = open_url("https://api.opensensemap.org/boxes?bbox=-105.342407%2C39.35129%2C-104.39209%2C39.972911&format=json").read()',
    )
    expect(shown).not.toContain('station_id')
  })

  it('shows only the rows of the chosen way: the IDs with + and −, or the area', () => {
    const block = workspaceWith([byIds(ID, OTHER)]).getBlockById('s0')!
    expect(visible(block)).toEqual(['TITLE', 'ID0', 'STATUSROW0', 'ID1', 'STATUSROW1', 'BUTTONS'])
    block.setFieldValue('area', 'MODE')
    expect(visible(block)).toEqual(['TITLE', 'AREA', 'BBOX_ROW', 'BBOX_LINE', 'OUTDOOR_ROW'])
  })

  it('writes a chosen area\'s bounding box into the field, says what it understood, and takes a pasted one as an own area', () => {
    const block = workspaceWith([byArea()]).getBlockById('s0')!
    block.setFieldValue('muenster', 'PRESET')
    expect(block.getFieldValue('BBOX')).toBe('7.4737853,51.8401448,7.7743634,52.0600251')
    expect(block.getFieldValue('BBOX_INFO')).toBe('→ Länge 7,4738 bis 7,7744 · Breite 51,8401 bis 52,06')
    expect(block.getFieldValue('PRESET')).toBe('muenster')
    block.setFieldValue('-105.342407,39.351290,-104.392090,39.972911', 'BBOX')
    expect(block.getFieldValue('PRESET')).toBe('custom')
    expect(block.getFieldValue('BBOX_INFO')).toBe('→ Länge -105,3424 bis -104,3921 · Breite 39,3513 bis 39,9729')
  })

  it('warns about a bounding box it can\'t read, and fetches nothing', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    const workspace = workspaceWith([byArea({ PRESET: 'custom', BBOX: '7.59, 51.92, 7.66' })])
    expect(generate(workspace).shown).not.toContain('open_url(')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Hier stehen 3 Zahlen. Eine Bounding Box sind vier, Länge zuerst'), 'bbox')
    expect(workspace.getBlockById('s0')!.getFieldValue('BBOX_INFO')).toBe('✕ nicht verstanden: siehe Warnung')
    warn.mockRestore()
  })

  it('gets more station rows with +, fewer with −, and keeps them when saved', () => {
    const block = workspaceWith([byIds(ID)]).getBlockById('s0') as FetchBlock
    block.setStations(3)
    expect(block.getField('BOX2')).not.toBeNull()
    block.setFieldValue(OTHER, 'BOX2')
    const saved = Blockly.serialization.blocks.save(block)!
    expect(saved.extraState).toEqual({ stations: 3 })
    expect(saved.fields).toMatchObject({ BOX0: ID, BOX2: OTHER })
    block.setStations(1)
    expect(block.getField('BOX1')).toBeNull()
    expect(block.getFieldValue('BOX0')).toBe(ID)
  })

  it('says whether the station measures, and since when not', () => {
    const now = Date.parse('2026-11-16T14:00:00Z')
    expect(boxStatus({ name: 'Fresno Station', lastMeasurementAt: '2026-11-16T13:44:30.354Z' }, now)).toEqual({
      text: '● „Fresno Station“ misst gerade',
      warning: null,
    })
    const offline = boxStatus({ name: 'Dach', lastMeasurementAt: '2024-03-12T08:00:00Z' }, now)
    expect(offline.text).toBe('○ „Dach“ ist offline, letzte Messung am 12.03.2024')
    expect(offline.warning).toContain('Nimm eine andere Station oder einen eigenen Zeitraum bis zum 12.03.2024.')
    expect(boxStatus({ name: 'Neu', lastMeasurementAt: null }, now).text).toBe('○ „Neu“ hat noch nie gemessen')
    expect(boxStatus(null, now).text).toBe('✕ Keine Station mit dieser ID')
  })

  it('takes the ID out of a pasted address', () => {
    const block = workspaceWith([{ type: 'osem_fetch' }]).getBlockById('s0')!
    block.setFieldValue(`https://opensensemap.org/explore/${ID.toUpperCase()}`, 'BOX0')
    expect(block.getFieldValue('BOX0')).toBe(ID)
  })

  it('warns at a row without a proper ID, and fetches the others', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    expect(generate(workspaceWith([byIds('Fresno Station')])).shown).not.toContain('open_url(')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('„Fresno Station“ ist keine ID der openSenseMap'), 'box0')
    expect(generate(workspaceWith([byIds(ID, '')])).shown).toContain(`["${ID}"]`)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Gib die ID einer Station ein'), 'box1')
    warn.mockRestore()
  })

  it('leaves out an ID openSenseMap doesn\'t know, and says so in the results', () => {
    const { run } = generate(workspaceWith([byIds(ID)]))
    expect(run).toContain('    if antwort.get("code") == "NotFound":\n')
    expect(run).toContain('hinweis(f"Die openSenseMap kennt keine Station mit der ID „{station_id}“: Sie fehlt darum in den Daten.')
  })
})

describe('a bounding box pasted from a finder', () => {
  it('reads it as west, south, east, north, however the numbers are separated', () => {
    const area = { bbox: [-105.342407, 39.35129, -104.39209, 39.972911] }
    expect(parseBbox('-105.342407,39.351290,-104.392090,39.972911')).toEqual(area)
    expect(parseBbox('[-105.342407, 39.351290, -104.392090, 39.972911]')).toEqual(area)
    expect(parseBbox('-105.342407 39.351290 -104.392090 39.972911')).toEqual(area)
    expect(parseBbox('-105.342407;39.351290;-104.392090;39.972911')).toEqual(area)
  })

  it('puts the corners in order: east before west, north before south', () => {
    expect(parseBbox('-104.39209,39.972911,-105.342407,39.35129')).toEqual({ bbox: [-105.342407, 39.35129, -104.39209, 39.972911] })
  })

  it('says why it is no area: not four numbers, a value out of range, no size', () => {
    expect(parseBbox('7.59,51.92,7.66')).toEqual({ problem: 'count', count: 3 })
    expect(parseBbox('')).toEqual({ problem: 'count', count: 0 })
    // Latitude first, far from the equator: 51.9 can be a longitude, but -105.3 can't be a latitude.
    expect(parseBbox('39.35,-105.34,39.97,-104.39')).toEqual({ problem: 'range', count: 4 })
    expect(parseBbox('7.59,51.92,7.59,51.99')).toEqual({ problem: 'flat', count: 4 })
  })
})

describe('the period of the measurements', () => {
  const measurements = (fields: Record<string, unknown>) =>
    workspaceWith(
      [{ type: 'osem_fetch', fields: { BOX0: ID } }, { type: 'step_read_json' }, { type: 'osem_table' }],
      {
        type: 'spockly_dataset',
        fields: { NAME: 'messwerte' },
        y: 300,
        inputs: { STEPS: { block: { type: 'osem_measurements', id: 'm', fields: { DATASET: 'station', ...fields } } } },
      },
    )

  it('shows "vom … bis …" only for an own period', () => {
    const workspace = measurements({ PERIOD: '1d' })
    const block = workspace.getBlockById('m')!
    expect(block.getInput('RANGE')!.isVisible()).toBe(false)
    block.setFieldValue('custom', 'PERIOD')
    expect(block.getInput('RANGE')!.isVisible()).toBe(true)
  })

  it('fetches an own period, the last day included', () => {
    const { shown } = generate(measurements({ PERIOD: 'custom', FROM: '2026-11-01', TO: '2026-11-15' }))
    expect(shown).toContain('von = datetime(2026, 11, 1, tzinfo=timezone.utc)\nbis = datetime(2026, 11, 16, tzinfo=timezone.utc)  # bis einschließlich 15.11.2026\n')
    // 15 days: as few sensors as for a week.
    expect(shown).toContain('for _, zeile in aktiv.head(10).iterrows():')
    expect(shown).toContain('Zeitraum „01.11.2026 bis 15.11.2026“')
  })

  it('takes days as students type them, and nothing else', () => {
    const block = measurements({ PERIOD: 'custom' }).getBlockById('m')!
    block.setFieldValue('5.11.2026', 'FROM')
    expect(block.getFieldValue('FROM')).toBe('2026-11-05')
    expect(block.getField('FROM')!.getText()).toBe('05.11.2026')
    block.setFieldValue('31.2.2026', 'FROM')
    expect(block.getFieldValue('FROM')).toBe('2026-11-05')
  })

  it('warns about a period that goes backwards, and fetches nothing', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    const { shown } = generate(measurements({ PERIOD: 'custom', FROM: '2026-11-15', TO: '2026-11-01' }))
    expect(shown).not.toContain('teile = []')
    expect(warn).toHaveBeenCalledWith('Der Zeitraum geht rückwärts: „vom“ (15.11.2026) liegt nach „bis“ (01.11.2026). Tausch die beiden Tage.', 'period')
    warn.mockRestore()
  })

  it('says when openSenseMap sent only its newest 10,000 values', () => {
    const { shown } = generate(measurements({ PERIOD: '7d' }))
    expect(shown).toContain('    if len(teil) >= 10000:')
    expect(shown).toMatch(/if voll > 0:\n {4}hinweis\("Bei manchen Sensoren hat die openSenseMap nur die neuesten 10\.000 Messwerte geschickt/)
  })
})

describe('days', () => {
  it('reads German and ISO days, and only real ones', () => {
    expect(parseDay('15.11.2026')).toBe('2026-11-15')
    expect(parseDay(' 2026-11-15 ')).toBe('2026-11-15')
    expect(parseDay('29.2.2026')).toBeNull()
    expect(parseDay('gestern')).toBeNull()
  })

  it('counts both days, and asks fewer sensors the more days', () => {
    expect(daysBetween('2026-11-15', '2026-11-15')).toBe(1)
    expect(daysBetween('2026-11-01', '2026-11-15')).toBe(15)
    expect([1, 2, 3, 4, 30].map(rowsFor)).toEqual([50, 20, 20, 10, 10])
  })
})

describe('measurements need one row per sensor', () => {
  /** The station "station" as a table of the given rows (ids s0–s2), and the measurements of each row. */
  const program = (rows: string) =>
    workspaceWith(
      [{ type: 'osem_fetch', fields: { BOX0: ID } }, { type: 'step_read_json' }, { type: 'osem_table', fields: { ROWS: rows } }],
      {
        type: 'spockly_dataset',
        fields: { NAME: 'messwerte' },
        y: 300,
        inputs: { STEPS: { block: { type: 'osem_measurements', id: 'm', fields: { DATASET: 'station', PERIOD: '1d' } } } },
      },
    )

  it('warns at once, before a run, when the table has one row per station', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    generate(program('station'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('In „station“ steht bei „mache eine Tabelle aus den Stationen“ aber „Station“'), 'rows')
    warn.mockClear()
    generate(program('sensor'))
    expect(warn).toHaveBeenCalledWith(null, 'rows')
    warn.mockRestore()
  })

  it('warns, too, when the dataset has no stations table at all (e.g. the list block instead)', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    generate(
      workspaceWith([{ type: 'osem_fetch', fields: { MODE: 'area' } }, { type: 'step_read_json' }, { type: 'step_json_table' }], {
        type: 'spockly_dataset',
        fields: { NAME: 'messwerte' },
        y: 300,
        inputs: { STEPS: { block: { type: 'osem_measurements', fields: { DATASET: 'station', PERIOD: '1d' } } } },
      }),
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Den Block gibt es in „station“ noch nicht.'), 'rows')
    warn.mockRestore()
  })

  it('explains the failed run at the dataset the rows come from, not the one the measurements go to', () => {
    const table: Snapshot = { art: 'tabelle', spalten: ['station_id', 'station_name'], typen: {}, zeilen: [], anzahl: 1 }
    const problem = explainError("Traceback …\nKeyError: 'station_lastMeasurementAt'", program('station'), {
      s0: { art: 'text', text: '{}', anzahl: 2 },
      s1: { art: 'json', text: '{}', anzahl: 2 },
      s2: table,
    })
    expect(problem.blockId).toBe('m')
    expect(problem.text).toContain('Darum braucht „station“ eine Zeile pro Sensor')
    expect(problem.text).toContain('„mache eine Tabelle aus den Stationen: 1 Zeile pro Sensor“ (unter „openSenseMap“)')
  })
})
