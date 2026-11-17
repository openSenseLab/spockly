// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import type { Snapshot } from '../core/fromPython'
import { explainError } from './errors'
import { boxStatus, DEFAULT_BOX } from './osem'
import { generate } from './index'
import { daysBetween, parseDay, rowsFor } from './osem/presets'

/** A dataset "station" with the given steps (ids s0, s1, …), and optionally more top-level blocks. */
function workspaceWith(steps: { type: string; fields?: Record<string, unknown> }[], ...others: object[]) {
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

describe('one station by its ID', () => {
  it('fetches only that station', () => {
    const { shown } = generate(workspaceWith([{ type: 'osem_box', fields: { BOX: ID } }]))
    expect(shown).toContain(`station = open_url("https://api.opensensemap.org/boxes/${ID}?format=json").read()`)
  })

  it('starts with a station in Münster, so a new block works at once', () => {
    const { shown } = generate(workspaceWith([{ type: 'osem_box' }]))
    expect(shown).toContain(`/boxes/${DEFAULT_BOX}?format=json`)
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
    const workspace = workspaceWith([{ type: 'osem_box' }])
    workspace.getBlockById('s0')!.setFieldValue(`https://opensensemap.org/explore/${ID.toUpperCase()}`, 'BOX')
    expect(workspace.getBlockById('s0')!.getFieldValue('BOX')).toBe(ID)
  })

  it('warns and fetches nothing without a proper ID', () => {
    const warn = vi.spyOn(Blockly.Block.prototype, 'setWarningText')
    expect(generate(workspaceWith([{ type: 'osem_box', fields: { BOX: 'Fresno Station' } }])).shown).not.toContain('open_url(')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('„Fresno Station“ ist keine ID der openSenseMap'), 'box')
    warn.mockRestore()
  })

  it('explains an ID openSenseMap doesn\'t know, wherever the run stopped', () => {
    const workspace = workspaceWith([{ type: 'osem_box', fields: { BOX: ID } }, { type: 'step_read_json' }, { type: 'osem_table' }])
    const answer: Snapshot = { art: 'text', text: '{"code":"NotFound","message":"Box not found"}', anzahl: 45 }
    const problem = explainError("KeyError: 'sensors'", workspace, { s0: answer, s1: { art: 'json', text: '{}', anzahl: 2 } })
    expect(problem.blockId).toBe('s2')
    expect(problem.text).toBe(
      `Die openSenseMap kennt keine Station mit der ID „${ID}“. Prüf die ID: am besten die Adresse der Station von opensensemap.org in den Block kopieren.`,
    )
  })
})

describe('the period of the measurements', () => {
  const measurements = (fields: Record<string, unknown>) =>
    workspaceWith(
      [{ type: 'osem_box', fields: { BOX: ID } }, { type: 'step_read_json' }, { type: 'osem_table' }],
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
      [{ type: 'osem_box', fields: { BOX: ID } }, { type: 'step_read_json' }, { type: 'osem_table', fields: { ROWS: rows } }],
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
      workspaceWith([{ type: 'osem_boxes' }, { type: 'step_read_json' }, { type: 'step_json_table' }], {
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
