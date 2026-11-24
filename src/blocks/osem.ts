/**
 * openSenseMap, step by step: fetch stations (one block: one or more by
 * their ID, or all in an area), translate the answer from JSON, make a table
 * (one row per
 * station or per sensor), and fetch the measurements for each row, for a
 * preset period or one typed in. The loop over the rows is one block; its
 * Python shows the loop.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { formatDate, formatNumber, lang, pick, t } from '../i18n'
import './fields'
import { AREA_PRESETS, areaPreset, type Bbox, bboxText, CUSTOM_PERIOD, parseBbox, daysAgo, daysBetween, parseDay, PERIODS, rowsFor, type PeriodId } from './osem/presets'
import { categoryNames, datasetBlocks, datasetNameOf, needs, pythonNameOf, SOURCES, stepShape, stepsOf, variableFor } from './program'
import { COORDINATES_COLUMN as COORDINATES } from './steps'

export const OSEM_API = 'https://api.opensensemap.org'

/** Fetches stations: one or more by their ID, or all in an area. */
export const OSEM_FETCH = 'osem_fetch'
export const OSEM_TABLE = 'osem_table'
export const OSEM_MEASUREMENTS = 'osem_measurements'
SOURCES.add(OSEM_FETCH).add(OSEM_MEASUREMENTS)

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

/** What the fetch block fetches: stations by their IDs, or all stations in an area. */
export const BY_ID = 'ids'
export const BY_AREA = 'area'

/** The value of the area dropdown when students pasted a bounding box of their own. */
export const CUSTOM_AREA = 'custom'

/** A degree as students read it: at most 4 decimals (about 10 m), the decimal sign of their language. */
const degrees = new Intl.NumberFormat(lang, { maximumFractionDigits: 4 })

/**
 * What the block understood of a bounding box, for the line under it, and the
 * warning if it understood none. The line is how students check their paste
 * (e.g. latitude and longitude swapped).
 */
export function bboxMeaning(text: string): { line: string; warning: string | null; bbox: Bbox | null } {
  const parsed = parseBbox(text)
  if ('problem' in parsed) {
    return { line: t('block.osemArea.notUnderstood'), warning: t(`block.osemArea.${parsed.problem}`, { count: parsed.count }), bbox: null }
  }
  const [west, south, east, north] = parsed.bbox.map((value) => degrees.format(value))
  return { line: t('block.osemArea.understood', { west, south, east, north }), warning: null, bbox: parsed.bbox }
}

/** The fetch block: its rows of station IDs (BOX0, BOX1, …), with the + and − to add or remove one. */
type FetchBlock = Blockly.Block & { stations: number; setStations(count: number): void; showMode(mode: unknown): void }

/** Per station row: the warning of a station that doesn't measure. Shown only while the block fetches by ID. */
const statusWarnings = new WeakMap<Blockly.Block, Map<number, string | null>>()
const rowWarnings = (block: Blockly.Block) => {
  if (!statusWarnings.has(block)) statusWarnings.set(block, new Map())
  return statusWarnings.get(block)!
}
function applyStatusWarnings(block: FetchBlock, mode: unknown = block.getFieldValue('MODE')) {
  for (const [row, warning] of rowWarnings(block)) block.setWarningText(mode === BY_ID && row < block.stations ? warning : null, `status${row}`)
}

/** Shows under a station's row whether it measures; only on a visible canvas, not in tests or Python generation. */
function showBoxStatus(block: FetchBlock, row: number, id: string) {
  const show = (text: string, warning: string | null = null) => {
    if (block.isDisposed() || !block.getField(`STATUS${row}`)) return
    block.setFieldValue(text, `STATUS${row}`)
    rowWarnings(block).set(row, warning)
    applyStatusWarnings(block)
  }
  if (!isBoxId(id)) return show('')
  show(t('block.osemBox.status.checking'))
  void askBox(id).then((answer) => {
    // The ID may have changed while openSenseMap answered.
    if (block.isDisposed() || block.getFieldValue(`BOX${row}`) !== id) return
    if (answer === undefined) return show('')
    const status = boxStatus(answer)
    show(status.text, status.warning)
  })
}


/** A small round button on a block: + or −. */
const button = (sign: '+' | '−') =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="white" fill-opacity="0.9"/>` +
      `<path d="M5.5 10h9${sign === '+' ? 'M10 5.5v9' : ''}" stroke="#0e7490" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  )

/** The rows that belong to fetching an area; the others (station rows, + and −) to fetching by ID. */
const AREA_ROWS = ['AREA', 'BBOX_ROW', 'BBOX_LINE', 'OUTDOOR_ROW']

/**
 * One block for fetching stations: the dropdown at its top chooses between
 * stations by their ID (one row each, with whether it measures; + adds a row,
 * − removes the last) and all stations in an area (a preset, or two corners
 * typed in). Only the rows of the chosen way show.
 */
Blockly.Blocks[OSEM_FETCH] = {
  init(this: FetchBlock) {
    this.jsonInit({
      message0: `${t('block.osemFetch')} %1 %2`,
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            [t('block.osemFetch.byId'), BY_ID],
            [t('block.osemFetch.byArea'), BY_AREA],
          ],
        },
        { type: 'input_dummy', name: 'TITLE' },
      ],
      message1: '%1 %2',
      args1: [
        {
          type: 'field_dropdown',
          name: 'PRESET',
          options: [...AREA_PRESETS.map((a) => [pick(a.label) ?? a.id, a.id]), [t('block.osemArea.custom'), CUSTOM_AREA]],
        },
        { type: 'input_dummy', name: 'AREA' },
      ],
      // The bounding box as a finder gives it, and under it what the block understood.
      message2: `${t('block.osemArea.bbox')} %1 %2`,
      args2: [
        { type: 'field_input', name: 'BBOX', text: bboxText(AREA_PRESETS[0].bbox), spellcheck: false },
        { type: 'input_dummy', name: 'BBOX_ROW' },
      ],
      message3: '%1 %2',
      args3: [
        { type: 'field_label', name: 'BBOX_INFO', text: bboxMeaning(bboxText(AREA_PRESETS[0].bbox)).line },
        { type: 'input_dummy', name: 'BBOX_LINE' },
      ],
      message4: `${t('block.osemArea.outdoor')} %2`,
      args4: [{ type: 'field_checkbox', name: 'OUTDOOR', checked: true }, { type: 'input_dummy', name: 'OUTDOOR_ROW' }],
      ...stepShape(['start'], 'text'),
      style: 'osem_blocks',
      tooltip: t('block.osemFetch.tooltip', categories),
    })
    this.setInputsInline(false)

    // Choosing an area writes its bounding box into the field; pasting another makes it an own area.
    // Each new text: the line under it says what the block understood.
    let filling = false
    this.getField('PRESET')?.setValidator((value: string) => {
      const preset = areaPreset(value)
      filling = true
      if (preset) this.setFieldValue(bboxText(preset.bbox), 'BBOX')
      filling = false
      return undefined
    })
    this.getField('BBOX')?.setValidator((value: string) => {
      const preset = areaPreset(String(this.getFieldValue('PRESET')))
      if (!filling && preset && value.trim() !== bboxText(preset.bbox)) this.setFieldValue(CUSTOM_AREA, 'PRESET')
      this.setFieldValue(bboxMeaning(value).line, 'BBOX_INFO')
      return undefined
    })
    this.getField('MODE')?.setValidator((value: string) => {
      this.showMode(value)
      return undefined
    })

    this.stations = 0
    this.setStations(1)
  },

  saveExtraState(this: FetchBlock) {
    return { stations: this.stations }
  },

  loadExtraState(this: FetchBlock, state: { stations?: number }) {
    this.setStations(Math.max(1, state.stations ?? 1))
  },

  /** Adds or removes station rows at the end. A new block starts with a station in Münster, so it works at once. */
  setStations(this: FetchBlock, count: number) {
    if (this.getInput('BUTTONS')) this.removeInput('BUTTONS')
    const rendered = this.workspace.rendered
    for (let i = this.stations; i < count; i++) {
      const timers: ReturnType<typeof setTimeout>[] = []
      // A pasted address of the station's page keeps only the ID; each ID gets its status.
      const box = new Blockly.FieldTextInput(i === 0 ? DEFAULT_BOX : '', (value: string) => {
        const id = value.match(BOX_ID)?.[0].toLowerCase() ?? value
        if (rendered) {
          clearTimeout(timers.pop())
          timers.push(setTimeout(() => showBoxStatus(this, i, id.trim()), 400))
        }
        return id
      })
      box.setSpellcheck(false)
      const row = this.appendDummyInput(`ID${i}`)
      if (i > 0) row.appendField(t('block.osemFetch.and'))
      row.appendField(box, `BOX${i}`)
      // Filled in once openSenseMap answered: "● „Fresno Station“ misst gerade".
      this.appendDummyInput(`STATUSROW${i}`).appendField(new Blockly.FieldLabel(''), `STATUS${i}`)
      if (rendered) setTimeout(() => showBoxStatus(this, i, String(this.getFieldValue(`BOX${i}`) ?? '').trim()))
    }
    for (let i = this.stations - 1; i >= count; i--) {
      this.removeInput(`ID${i}`)
      this.removeInput(`STATUSROW${i}`)
      rowWarnings(this).delete(i)
      this.setWarningText(null, `status${i}`)
      this.setWarningText(null, `box${i}`)
    }
    this.stations = count
    const buttons = this.appendDummyInput('BUTTONS')
    buttons.appendField(new Blockly.FieldImage(button('+'), 20, 20, t('block.osemFetch.add'), () => changeStations(this, 1)))
    if (count > 1) buttons.appendField(new Blockly.FieldImage(button('−'), 20, 20, t('block.osemFetch.remove'), () => changeStations(this, -1)))
    this.showMode(this.getFieldValue('MODE'))
  },

  /**
   * The block in a few words, for headings and messages: "hole von openSenseMap
   * die Stationen im Gebiet Münster – ganze Stadt", or "… mit der ID 625c…, …".
   */
  describe(this: FetchBlock): string {
    const title = `${t('block.osemFetch')} ${this.getField('MODE')?.getText() ?? ''}`
    if (this.getFieldValue('MODE') === BY_AREA) {
      return this.getFieldValue('PRESET') === CUSTOM_AREA
        ? `${t('block.osemFetch')} ${t('block.osemFetch.inOwnArea')}`
        : `${title} ${this.getField('PRESET')?.getText() ?? ''}`
    }
    const ids = Array.from({ length: this.stations }, (_, i) => String(this.getFieldValue(`BOX${i}`) ?? '').trim()).filter(Boolean)
    return `${title} ${ids.join(', ')}`
  },

  /** Shows the rows of the chosen way to fetch, and hides the others. */
  showMode(this: FetchBlock, mode: unknown) {
    const area = mode === BY_AREA
    for (const input of this.inputList) {
      if (input.name === 'TITLE') continue
      input.setVisible(AREA_ROWS.includes(input.name) === area)
    }
    applyStatusWarnings(this, mode)
    if (this.rendered) (this as unknown as Blockly.BlockSvg).queueRender()
  },
}

/** A click on + or −: one station row more or less, undoable like any other change. */
function changeStations(block: FetchBlock, by: 1 | -1) {
  if (block.isInFlyout || !block.isEditable()) return
  const before = JSON.stringify(block.saveExtraState?.())
  Blockly.Events.setGroup(true)
  block.setStations(Math.max(1, block.stations + by))
  const after = JSON.stringify(block.saveExtraState?.())
  Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(block, 'mutation', null, before, after))
  Blockly.Events.setGroup(false)
}

Blockly.common.defineBlocksWithJsonArray([
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
    ...stepShape(['stations'], 'table'),
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
    ...stepShape(['start'], 'table'),
    style: 'osem_blocks',
    tooltip: t('block.osemMeasurements.tooltip', {
      day: PERIODS['1d'].rows,
      threeDays: PERIODS['3d'].rows,
      week: PERIODS['7d'].rows,
    }),
  },
])

/** The address that lists the stations in a rectangle [west, south, east, north] (only outdoor ones if asked). */
export function boxesUrl(bbox: readonly number[], outdoor: boolean): string {
  const query = new URLSearchParams({ bbox: bbox.join(','), format: 'json' })
  if (outdoor) query.set('exposure', 'outdoor')
  return `${OSEM_API}/boxes?${query}`
}

/** The station IDs of the block's rows, each once; a row without a proper ID says why. */
function stationIds(block: FetchBlock, byId: boolean): string[] {
  const ids: string[] = []
  for (let i = 0; i < block.stations; i++) {
    const id = String(block.getFieldValue(`BOX${i}`) ?? '').trim()
    const warning = !byId || isBoxId(id) ? null : id ? t('block.osemBox.bad', { id }) : t('block.osemBox.none')
    block.setWarningText(warning, `box${i}`)
    if (byId && isBoxId(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** The address of the block's area, or null if its bounding box isn't one (the block then says why). */
function areaUrl(block: Blockly.Block, byArea: boolean): string | null {
  const { bbox, warning } = bboxMeaning(String(block.getFieldValue('BBOX') ?? ''))
  block.setWarningText(byArea ? warning : null, 'bbox')
  return byArea && bbox ? boxesUrl(bbox, block.getFieldValue('OUTDOOR') === 'TRUE') : null
}

/**
 * The stations as JSON text, as openSenseMap sends them: all in the area at
 * once, or each station by its ID, collected in one list (one openSenseMap
 * doesn't know is left out, with a hint).
 */
pythonGenerator.forBlock[OSEM_FETCH] = (block, generator) => {
  const fetch = block as FetchBlock
  const byArea = block.getFieldValue('MODE') === BY_AREA
  const ids = stationIds(fetch, !byArea)
  const url = areaUrl(block, byArea)
  const name = variableFor(block)
  if (!name || (byArea ? !url : !ids.length)) return ''
  needs(generator, 'from pyodide.http import open_url')
  // An area without stations is an empty list: the Zwischenstand and the results say so, and why (blocks/empty).
  if (url) return `${name} = open_url(${JSON.stringify(url)}).read()\n`
  needs(generator, 'import json', 'from spockly import hinweis')
  const unknown = t('hint.osem.noBox', { id: '{station_id}' })
  return (
    `# ${t('code.osemFetch.collect')}\n` +
    `${name} = []\n` +
    `for station_id in ${JSON.stringify(ids)}:\n` +
    `    antwort = json.load(open_url(f"${OSEM_API}/boxes/{station_id}?format=json"))\n` +
    `    if antwort.get("code") == "NotFound":\n` +
    `        hinweis(f${JSON.stringify(unknown)})\n` +
    `    else:\n` +
    `        ${name}.append(antwort)\n` +
    `${name} = json.dumps(${name})  # ${t('code.osemFetch.asText')}\n`
  )
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
