/**
 * openSenseMap, step by step: fetch the stations in an area (or one station
 * by its ID), translate the answer from JSON, make a table (one row per
 * station or per sensor), and fetch the measurements for each row, for a
 * preset period or one typed in. The loop over the rows is one block; its
 * Python shows the loop.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { formatDate, formatNumber, lang, pick, t } from '../i18n'
import './fields'
import { AREA_PRESETS, areaPreset, CUSTOM_PERIOD, daysAgo, daysBetween, parseDay, PERIODS, rowsFor, type PeriodId } from './osem/presets'
import { categoryNames, datasetBlocks, datasetNameOf, needs, pythonNameOf, SOURCES, STEP, stepsOf, variableFor } from './program'
import { COORDINATES_COLUMN as COORDINATES } from './steps'

export const OSEM_API = 'https://api.opensensemap.org'

export const OSEM_BOXES = 'osem_boxes'
/** One station, by its ID. */
export const OSEM_BOX = 'osem_box'
export const OSEM_TABLE = 'osem_table'
export const OSEM_MEASUREMENTS = 'osem_measurements'
SOURCES.add(OSEM_BOXES).add(OSEM_BOX).add(OSEM_MEASUREMENTS)

/** openSenseMap sends at most so many measurements of a sensor at once, the newest. */
export const OSEM_MAX_VALUES = 10_000

/** A station's ID: 24 digits and letters a–f, e.g. in the address of its page on opensensemap.org. */
const BOX_ID = /[0-9a-f]{24}/i
export const isBoxId = (text: string) => /^[0-9a-f]{24}$/i.test(text)

/** Where to find the blocks of other categories, for the tooltips. */
const categories = { general: t('toolbox.general'), own: t('toolbox.ownData'), osem: t('toolbox.osem') }

/** A day as students write it: 15.11.2026 in German, 2026-11-15 in English. */
export const showDay = (iso: string) => (lang === 'de' ? iso.split('-').reverse().join('.') : iso)

/**
 * A day typed into the block. It keeps "YYYY-MM-DD" and shows the day as
 * students write it; what isn't a day is not taken.
 */
export class FieldDay extends Blockly.FieldTextInput {
  static override fromJson(options: Blockly.FieldTextInputFromJsonConfig & { daysAgo?: number }) {
    return new FieldDay(daysAgo(options.daysAgo ?? 0))
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return typeof value === 'string' ? parseDay(value) : null
  }

  protected override getText_(): string {
    return showDay(this.getValue() ?? '')
  }

  protected override getEditorText_(value: unknown): string {
    return showDay(String(value ?? ''))
  }
}

Blockly.fieldRegistry.register('field_day', FieldDay)

// The "vom … bis …" row only for "eigener Zeitraum …".
Blockly.Extensions.register('osem_custom_period', function (this: Blockly.Block) {
  const show = (value: unknown) => {
    this.getInput('RANGE')?.setVisible(value === CUSTOM_PERIOD)
    if (this.rendered) (this as Blockly.BlockSvg).queueRender()
  }
  this.getField('PERIOD')?.setValidator((value) => {
    show(value)
    return undefined
  })
  show(this.getFieldValue('PERIOD'))
})

/**
 * The station a new block starts with: "Fresno Station" in Münster-Mitte,
 * measuring when it was chosen (2026-11-16). Stations stop measuring over
 * time; the block then says so (boxStatus).
 */
export const DEFAULT_BOX = '625c512a18aca4001cadae87'

/** A station counts as offline once its last measurement is older than this: "letzte 24 Stunden" would find nothing. */
const OFFLINE_AFTER_MS = 24 * 60 * 60 * 1000

/** What openSenseMap says about a station, or null if it knows no such ID. */
export type BoxAnswer = { name?: string; lastMeasurementAt?: string | null } | null

/** The line under the block: does the station measure, and if not, since when not. Offline also gets a warning. */
export function boxStatus(answer: BoxAnswer, now = Date.now()): { text: string; warning: string | null } {
  if (!answer) return { text: t('block.osemBox.status.notFound'), warning: null }
  const name = answer.name ?? ''
  const last = answer.lastMeasurementAt ? Date.parse(answer.lastMeasurementAt) : NaN
  if (Number.isNaN(last)) return { text: t('block.osemBox.status.never', { name }), warning: t('block.osemBox.offline.never', { name }) }
  if (now - last <= OFFLINE_AFTER_MS) return { text: t('block.osemBox.status.online', { name }), warning: null }
  const date = formatDate(answer.lastMeasurementAt!.slice(0, 10))
  return { text: t('block.osemBox.status.offline', { name, date }), warning: t('block.osemBox.offline', { name, date }) }
}

/** One question to openSenseMap per ID, also for the many blocks of the toolbox; again after 5 minutes. */
const answers = new Map<string, { at: number; answer: Promise<BoxAnswer | undefined> }>()

function askBox(id: string): Promise<BoxAnswer | undefined> {
  const cached = answers.get(id)
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.answer
  // undefined: no answer at all (offline?), then the block says nothing.
  const answer = fetch(`${OSEM_API}/boxes/${id}?format=json`)
    .then(async (response) => (response.status === 404 ? null : response.ok ? ((await response.json()) as BoxAnswer) : undefined))
    .catch(() => undefined)
  answers.set(id, { at: Date.now(), answer })
  return answer
}

/** The offline warning of each station block, given again after each run of variableFor, which clears all warnings. */
const statusWarnings = new WeakMap<Blockly.Block, string | null>()

/** Shows under the block whether its station measures; only on a visible canvas, not in tests or Python generation. */
function showBoxStatus(block: Blockly.Block, id: string) {
  const show = (text: string, warning: string | null = null) => {
    if (block.isDisposed()) return
    block.setFieldValue(text, 'STATUS')
    statusWarnings.set(block, warning)
    block.setWarningText(warning, 'status')
  }
  if (!isBoxId(id)) return show('')
  show(t('block.osemBox.status.checking'))
  void askBox(id).then((answer) => {
    // The ID may have changed while openSenseMap answered.
    if (block.isDisposed() || block.getFieldValue('BOX') !== id) return
    if (answer === undefined) return show('')
    const status = boxStatus(answer)
    show(status.text, status.warning)
  })
}

// A pasted address of the station's page keeps only the ID; each ID gets its status.
Blockly.Extensions.register('osem_box_id', function (this: Blockly.Block) {
  const rendered = this.workspace.rendered
  let timer: ReturnType<typeof setTimeout> | undefined
  this.getField('BOX')?.setValidator((value: string) => {
    const id = value.match(BOX_ID)?.[0].toLowerCase() ?? value
    if (rendered) {
      clearTimeout(timer)
      timer = setTimeout(() => showBoxStatus(this, id.trim()), 400)
    }
    return id
  })
  if (rendered) setTimeout(() => showBoxStatus(this, String(this.getFieldValue('BOX') ?? '').trim()))
})

Blockly.common.defineBlocksWithJsonArray([
  {
    type: OSEM_BOXES,
    message0: t('block.osemBoxes'),
    args0: [
      { type: 'field_dropdown', name: 'AREA', options: AREA_PRESETS.map((a) => [pick(a.label) ?? a.id, a.id]) },
      { type: 'field_checkbox', name: 'OUTDOOR', checked: true },
    ],
    previousStatement: STEP,
    nextStatement: STEP,
    style: 'osem_blocks',
    tooltip: t('block.osemBoxes.tooltip', categories),
  },
  {
    type: OSEM_BOX,
    message0: t('block.osemBox'),
    args0: [{ type: 'field_input', name: 'BOX', text: DEFAULT_BOX, spellcheck: false }],
    // Filled in once openSenseMap answered: "● „Fresno Station“ misst gerade".
    message1: '%1',
    args1: [{ type: 'field_label', name: 'STATUS', text: '' }],
    previousStatement: STEP,
    nextStatement: STEP,
    style: 'osem_blocks',
    tooltip: t('block.osemBox.tooltip', categories),
    extensions: ['osem_box_id'],
  },
  {
    type: OSEM_TABLE,
    message0: t('block.osemTable'),
    args0: [
      {
        type: 'field_dropdown',
        name: 'ROWS',
        options: [
          [t('block.osemTable.sensor'), 'sensor'],
          [t('block.osemTable.station'), 'station'],
        ],
      },
    ],
    previousStatement: STEP,
    nextStatement: STEP,
    style: 'osem_blocks',
    tooltip: t('block.osemTable.tooltip'),
  },
  {
    type: OSEM_MEASUREMENTS,
    message0: t('block.osemMeasurements'),
    args0: [
      { type: 'field_dataset', name: 'DATASET', value: t('dataset.default') },
      {
        type: 'field_dropdown',
        name: 'PERIOD',
        options: [...(Object.keys(PERIODS) as PeriodId[]).map((id) => [pick(PERIODS[id].label) ?? id, id]), [t('period.custom'), CUSTOM_PERIOD]],
      },
    ],
    message1: t('block.osemMeasurements.range'),
    args1: [
      { type: 'field_day', name: 'FROM', daysAgo: 7 },
      { type: 'field_day', name: 'TO', daysAgo: 0 },
      { type: 'input_dummy', name: 'RANGE' },
    ],
    extensions: ['osem_custom_period'],
    previousStatement: STEP,
    nextStatement: STEP,
    style: 'osem_blocks',
    tooltip: t('block.osemMeasurements.tooltip', {
      day: PERIODS['1d'].rows,
      threeDays: PERIODS['3d'].rows,
      week: PERIODS['7d'].rows,
    }),
  },
])

/** The address that lists the boxes in an area (only outdoor ones if asked). */
export function boxesUrl(area: string, outdoor: boolean): string {
  const query = new URLSearchParams({ bbox: (areaPreset(area) ?? AREA_PRESETS[0]).bbox.join(','), format: 'json' })
  if (outdoor) query.set('exposure', 'outdoor')
  return `${OSEM_API}/boxes?${query}`
}

pythonGenerator.forBlock[OSEM_BOXES] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'from pyodide.http import open_url')
  const url = boxesUrl(String(block.getFieldValue('AREA')), block.getFieldValue('OUTDOOR') === 'TRUE')
  return `${name} = open_url(${JSON.stringify(url)}).read()\n`
}

pythonGenerator.forBlock[OSEM_BOX] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  const id = String(block.getFieldValue('BOX') ?? '').trim()
  block.setWarningText(statusWarnings.get(block) ?? null, 'status')
  block.setWarningText(isBoxId(id) ? null : id ? t('block.osemBox.bad', { id }) : t('block.osemBox.none'), 'box')
  if (!isBoxId(id)) return ''
  needs(generator, 'from pyodide.http import open_url')
  return `${name} = open_url(${JSON.stringify(`${OSEM_API}/boxes/${id}?format=json`)}).read()\n`
}

/** The period of the measurements block: its Python lines for von and bis, how many days, and its name. */
function periodOf(block: Blockly.Block): { python: string; days: number; label: string } | null {
  const id = String(block.getFieldValue('PERIOD'))
  block.setWarningText(null, 'period')
  if (id !== CUSTOM_PERIOD) {
    const period = PERIODS[id as PeriodId] ?? PERIODS['1d']
    return {
      python: `bis = datetime.now(timezone.utc).replace(second=0, microsecond=0)\nvon = bis - timedelta(days=${period.days})\n`,
      days: period.days,
      label: pick(period.label) ?? id,
    }
  }
  const from = String(block.getFieldValue('FROM'))
  const to = String(block.getFieldValue('TO'))
  const words = { from: showDay(from), to: showDay(to) }
  if (from > to) {
    block.setWarningText(t('block.osemMeasurements.order', words), 'period')
    return null
  }
  // "bis 15.11." means the whole day: up to the start of the next one.
  const end = new Date(Date.parse(to) + 86_400_000).toISOString().slice(0, 10)
  const day = (iso: string) => `datetime(${iso.split('-').map(Number).join(', ')}, tzinfo=timezone.utc)`
  return {
    python: `von = ${day(from)}\nbis = ${day(end)}  # ${t('code.osemMeasurements.until', { day: words.to })}\n`,
    days: daysBetween(from, to),
    label: t('period.range', words),
  }
}

pythonGenerator.forBlock[OSEM_TABLE] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import pandas as pd')
  if (block.getFieldValue('ROWS') === 'station') {
    return (
      `${name} = pd.json_normalize(${name})\n` +
      `${name} = ${name}.rename(columns={"_id": "station_id", "name": "station_name", "currentLocation.coordinates": "${COORDINATES}"})\n`
    )
  }
  // Each sensor of a station becomes a row; it keeps the station's id, name, placement, last measurement and position.
  return (
    `${name} = pd.json_normalize(${name}, record_path="sensors", record_prefix="sensor_",\n` +
    `                          meta=["_id", "name", "exposure", "lastMeasurementAt", ["currentLocation", "coordinates"]], meta_prefix="station_",\n` +
    `                          errors="ignore")\n` +
    `${name} = ${name}.rename(columns={"sensor__id": "sensor_id", "station__id": "station_id", "station_currentLocation.coordinates": "${COORDINATES}"})\n`
  )
}

pythonGenerator.forBlock[OSEM_MEASUREMENTS] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(
    generator,
    'import json',
    'import pandas as pd',
    'from datetime import datetime, timedelta, timezone',
    'from pyodide.http import open_url',
    'from spockly import hinweis',
  )
  const chosen = String(block.getFieldValue('DATASET') ?? '')
  const source = datasetBlocks(block.workspace).find((d) => datasetNameOf(d) === chosen)
  const rows = source ? pythonNameOf(source) : 'None'
  // The measurements are asked per sensor: a table of stations has no sensor_id. Said at once, before a run.
  // Without the stations table (e.g. "mache eine Tabelle aus der Liste" instead) the rows have no such ids either.
  const steps = source ? stepsOf(source) : []
  const table = steps.filter((step) => step.type === OSEM_TABLE).at(-1)
  const where = { dataset: chosen, ...categoryNames() }
  const rowsWarning =
    table?.getFieldValue('ROWS') === 'station'
      ? t('block.osemMeasurements.needsSensors', where)
      : steps.length && !table
        ? t('block.osemMeasurements.needsTable', where)
        : null
  block.setWarningText(rowsWarning, 'rows')
  const period = periodOf(block)
  if (!period) return ''
  const words = { dataset: chosen, period: period.label, max: rowsFor(period.days) }
  // openSenseMap lists its oldest stations first, and most of them stopped
  // measuring long ago: without this the first rows would all come back empty.
  return (
    `# ${t('code.osemMeasurements.each', words)}\n` +
    period.python +
    `# ${t('code.osemMeasurements.active')}\n` +
    `zuletzt = pd.to_datetime(${rows}["station_lastMeasurementAt"], utc=True, errors="coerce")\n` +
    `aktiv = ${rows}[zuletzt >= von]\n` +
    `if len(${rows}) == 0:\n` +
    `    hinweis(${JSON.stringify(t('hint.osem.noRows', words))})\n` +
    `elif len(aktiv) == 0:\n` +
    `    hinweis(${JSON.stringify(t('hint.osem.noActive', words))})\n` +
    `teile = []\n` +
    `voll = 0\n` +
    `for _, zeile in aktiv.head(${words.max}).iterrows():\n` +
    `    url = (f"${OSEM_API}/boxes/{zeile['station_id']}/data/{zeile['sensor_id']}"\n` +
    `           f"?from-date={von:%Y-%m-%dT%H:%M:%SZ}&to-date={bis:%Y-%m-%dT%H:%M:%SZ}&format=json")\n` +
    `    teil = pd.DataFrame(json.load(open_url(url)))\n` +
    `    for spalte, wert in zeile.items():  # jede Messung bekommt die Angaben ihrer Zeile\n` +
    `        if not isinstance(wert, list):\n` +
    `            teil[spalte] = wert\n` +
    `    teile.append(teil)\n` +
    `    if len(teil) >= ${OSEM_MAX_VALUES}:  # ${t('code.osemMeasurements.capped', { max: OSEM_MAX_VALUES })}\n` +
    `        voll += 1\n` +
    `${name} = pd.concat(teile, ignore_index=True) if teile else pd.DataFrame()\n` +
    `if len(aktiv) > 0 and len(${name}) == 0:\n` +
    `    hinweis(${JSON.stringify(t('hint.osem.noMeasurements', words))})\n` +
    `if voll > 0:\n` +
    `    hinweis(${JSON.stringify(t('hint.osem.capped', { ...words, max: formatNumber(OSEM_MAX_VALUES) }))})\n`
  )
}
