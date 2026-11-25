import * as Blockly from 'blockly'
import 'blockly/blocks'

import { getMessages, type Messages } from '../i18n'
import { useKernelStore } from '../kernel/kernel'
import { SAMPLES } from '../journal/samples'
import { knownValues } from './fields'
import { toIdentifier } from './python'
import { PIPELINE, isNumericColumn } from './schema'
import { describePath } from '../journal/extract'
import type { SelectionRef } from '../journal/types'
import { SELECT_BLOCK, isSelectionRef, referenceOf, setReference, type Reference } from './reference'
import { COLOUR_CHECK, COLUMN_BLOCK, COLUMN_CHECK, DATASET_BLOCK, DATASET_CHECK, colourSlot, columnSlot, datasetSlot } from './selection'
import { VALUE_SLOTS, addDefaultShadows, valueSlot } from './valueInputs'

/** Block colours: blue and green from the Geoinformatik palette; white labels stay readable on all. */
export const COLOURS = {
  data: '#007eaa',
  transform: '#55821a',
  spatial: '#d9480f',
  output: '#9c36b5',
  value: '#4f6f86',
  column: '#0b7285',
} as const

type BlockMessages = Messages['blocks']
type Json = Record<string, unknown>

/** Column of the dataset chosen in the same block's DATASET field. */
const datasetColumn = (name: string) => ({ type: 'field_spk_dataset_column', name })
const dataset = (name: string) => ({ type: 'field_spk_dataset', name })
const input = (name: string, text: string) => ({ type: 'field_input', name, text })
const dropdown = (name: string, options: [string, string][]) => ({
  type: 'field_dropdown',
  name,
  options,
})

const aggOptions = (t: BlockMessages, withCount: boolean): [string, string][] => [
  ...(withCount ? [[t.agg.count, 'count'] as [string, string]] : []),
  [t.agg.mean, 'mean'],
  [t.agg.median, 'median'],
  [t.agg.sum, 'sum'],
  [t.agg.min, 'min'],
  [t.agg.max, 'max'],
  [t.agg.std, 'std'],
  [t.agg.nunique, 'nunique'],
]

/** Blocks whose inputs sit outside, one per row: the column blocks plugged in read like a list. */
const EXTERNAL_INPUTS = ['spk_show_chart', 'spk_show_stat']

/** Each block reads its texts from the active language when it is created. */
const define = (type: string, build: (t: BlockMessages) => Json, setup?: (block: Blockly.Block) => void) => {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      const json = build(getMessages().blocks)
      // Blocks with slots keep them inline, so they read like a sentence with gaps.
      const slots = !EXTERNAL_INPUTS.includes(type) && (VALUE_SLOTS[type] || JSON.stringify(json).includes('"input_value"'))
      this.jsonInit(slots ? { inputsInline: true, ...json } : json)
      addDefaultShadows(this)
      setup?.(this)
    },
  }
}

/** Dataset names become Python variables, so keep them valid identifiers while typing. */
const identifierNames = (block: Blockly.Block, ...fields: string[]) => {
  for (const name of fields) block.getField(name)?.setValidator((value: string) => toIdentifier(value))
}

/** Long web addresses would make blocks very wide: show the start, edit the full text. */
const shortUrl = (block: Blockly.Block) => {
  const field = block.getField('URL')
  if (field) field.maxDisplayLength = 32
}

const load = (json: Json): Json => ({
  previousStatement: 'load',
  nextStatement: 'load',
  colour: COLOURS.data,
  ...json,
})

// --- Loading data (data cells) -----------------------------------------------

define(
  'spk_load_example',
  (t) =>
    load({
      message0: t.loadExample,
      args0: [
        dropdown('EXAMPLE', SAMPLES.map((sample): [string, string] => [getMessages().samples[sample.id].title, sample.id])),
        input('NAME', 'stations'),
      ],
      tooltip: t.loadExampleTip,
    }),
  (block) => {
    identifierNames(block, 'NAME')
    // Keep the dataset name in sync with the chosen example until the learner renames it.
    block.getField('EXAMPLE')?.setValidator(function (this: Blockly.Field<string>, value: string) {
      const name = block.getField('NAME')
      if (name && name.getValue() === this.getValue()) name.setValue(value)
      return value
    })
  },
)

define(
  'spk_load_url',
  (t) =>
    load({
      message0: t.loadUrl,
      args0: [input('URL', 'https://'), input('NAME', 'data')],
      tooltip: t.loadUrlTip,
    }),
  (block) => {
    identifierNames(block, 'NAME')
    shortUrl(block)
  },
)

define(
  'spk_load_file',
  (t) =>
    load({
      message0: t.loadFile,
      args0: [{ type: 'field_spk_file', name: 'FILE' }, input('NAME', 'data')],
      tooltip: t.loadFileTip,
    }),
  (block) => identifierNames(block, 'NAME'),
)

define(
  'spk_load_gis_file',
  (t) =>
    load({
      message0: t.loadGisFile,
      args0: [{ type: 'field_spk_file', name: 'FILE' }],
      message1: t.gisLayerAs,
      args1: [{ type: 'field_spk_layer', name: 'LAYER' }, input('NAME', 'data')],
      colour: COLOURS.spatial,
      tooltip: t.loadGisFileTip,
    }),
  (block) => identifierNames(block, 'NAME'),
)

define(
  'spk_load_gis_url',
  (t) =>
    load({
      message0: t.loadGisUrl,
      args0: [input('URL', 'https://')],
      message1: t.gisLayerAs,
      args1: [{ type: 'field_spk_layer', name: 'LAYER' }, input('NAME', 'data')],
      colour: COLOURS.spatial,
      tooltip: t.loadGisUrlTip,
    }),
  (block) => {
    identifierNames(block, 'NAME')
    shortUrl(block)
  },
)

define('spk_make_spatial', (t) =>
  load({
    message0: t.makeSpatial,
    args0: [dataset('DATASET'), datasetColumn('LON'), datasetColumn('LAT')],
    colour: COLOURS.spatial,
    tooltip: t.makeSpatialTip,
  }),
)

// --- Taking parts of a dataset (data cells) --------------------------------------
// Created from the "Select" tab of the inspection, or dragged in and set up by hand.
// They never change the dataset they take from: the result always gets its own name.

const takeSetup = (block: Blockly.Block) => {
  identifierNames(block, 'NAME')
  block.setOnChange(function (this: Blockly.Block, event) {
    if (event.isUiEvent || this.isInFlyout) return
    const same = toIdentifier(String(this.getFieldValue('NAME') ?? '')) === toIdentifier(String(this.getFieldValue('DATASET') ?? ''))
    this.setWarningText(same ? getMessages().blocks.sameName : null)
  })
}

define(
  'spk_take_table',
  (t) =>
    load({
      message0: t.takeTable,
      args0: [dataset('DATASET'), { type: 'field_spk_json_table', name: 'PATH' }],
      message1: t.takeColumnsAs,
      args1: [{ type: 'field_spk_pick_columns', name: 'COLUMNS', value: '[]' }, input('NAME', 'table')],
      tooltip: t.takeTableTip,
    }),
  takeSetup,
)

define(
  'spk_take_columns',
  (t) =>
    load({
      message0: t.takeColumns,
      args0: [dataset('DATASET'), { type: 'field_spk_pick_columns', name: 'COLUMNS', value: '[]' }, input('NAME', 'selection')],
      tooltip: t.takeColumnsTip,
    }),
  takeSetup,
)

define(
  'spk_take_value',
  (t) =>
    load({
      message0: t.takeValue,
      args0: [dataset('DATASET'), { type: 'field_spk_json_value', name: 'PATH' }, input('NAME', 'value')],
      tooltip: t.takeValueTip,
    }),
  takeSetup,
)

define(
  'spk_take_stat',
  (t) =>
    load({
      message0: t.takeStat,
      args0: [
        dataset('DATASET'),
        dropdown('AGG', [...aggOptions(t, true), [t.agg.first, 'first']]),
        datasetColumn('COLUMN'),
        input('NAME', 'value'),
      ],
      tooltip: t.takeStatTip,
    }),
  takeSetup,
)

const step = (colour: string, json: Json): Json => ({
  previousStatement: 'step',
  nextStatement: 'step',
  colour,
  ...json,
})

// --- Data ------------------------------------------------------------------

define(PIPELINE, (t) => ({
  message0: t.pipeline,
  args0: [datasetSlot('DATASET')],
  message1: '%1',
  args1: [{ type: 'input_statement', name: 'STEPS', check: 'step' }],
  colour: COLOURS.data,
  tooltip: t.pipelineTip,
}))

define(
  'spk_save',
  (t) =>
    step(COLOURS.data, {
      message0: t.save,
      args0: [input('NAME', 'result')],
      tooltip: t.saveTip,
    }),
  (block) => identifierNames(block, 'NAME'),
)

define('spk_join', (t) =>
  step(COLOURS.data, {
    message0: t.join,
    args0: [datasetSlot('DATASET'), columnSlot('COLUMN')],
    tooltip: t.joinTip,
  }),
)

// --- Transform -------------------------------------------------------------

define('spk_filter', (t) =>
  step(COLOURS.transform, {
    message0: t.filter,
    args0: [
      columnSlot('COLUMN'),
      dropdown('OP', [
        ['=', 'eq'],
        ['≠', 'neq'],
        ['<', 'lt'],
        ['≤', 'lte'],
        ['>', 'gt'],
        ['≥', 'gte'],
        [t.ops.contains, 'contains'],
        [t.ops.missing, 'missing'],
        [t.ops.notmissing, 'notmissing'],
      ]),
      valueSlot('spk_filter', 'VALUE'),
    ],
    tooltip: t.filterTip,
  }),
)

define('spk_filter_in', (t) =>
  step(COLOURS.transform, {
    message0: t.filterIn,
    args0: [
      columnSlot('COLUMN'),
      dropdown('MODE', [
        [t.filterInModes.in, 'in'],
        [t.filterInModes.notIn, 'notin'],
      ]),
      { type: 'field_spk_values', name: 'VALUES', value: '[]' },
    ],
    tooltip: t.filterInTip,
  }),
)

define('spk_rows', (t) =>
  step(COLOURS.transform, {
    message0: t.rows,
    args0: [valueSlot('spk_rows', 'FROM'), valueSlot('spk_rows', 'TO')],
    tooltip: t.rowsTip,
  }),
)

define('spk_sort', (t) =>
  step(COLOURS.transform, {
    message0: t.sort,
    args0: [
      columnSlot('COLUMN'),
      dropdown('DIR', [
        [t.ascending, 'asc'],
        [t.descending, 'desc'],
      ]),
    ],
    tooltip: t.sortTip,
  }),
)

define('spk_head', (t) =>
  step(COLOURS.transform, {
    message0: t.head,
    args0: [valueSlot('spk_head', 'N')],
    tooltip: t.headTip,
  }),
)

define('spk_group', (t) =>
  step(COLOURS.transform, {
    message0: t.group,
    args0: [columnSlot('BY'), dropdown('AGG', aggOptions(t, true)), columnSlot('COLUMN')],
    tooltip: t.groupTip,
  }),
)

define('spk_compute', (t) =>
  step(COLOURS.transform, {
    message0: t.compute,
    args0: [input('NAME', 'new_column'), { type: 'input_value', name: 'VALUE' }],
    tooltip: t.computeTip,
  }),
)

define('spk_convert', (t) =>
  step(COLOURS.transform, {
    message0: t.convert,
    args0: [
      columnSlot('COLUMN'),
      dropdown('TYPE', [
        [t.convertTypes.number, 'number'],
        [t.convertTypes.date, 'date'],
        [t.convertTypes.text, 'text'],
      ]),
    ],
    tooltip: t.convertTip,
  }),
)

define('spk_round', (t) =>
  step(COLOURS.transform, {
    message0: t.round,
    args0: [columnSlot('COLUMN'), valueSlot('spk_round', 'DIGITS')],
    tooltip: t.roundTip,
  }),
)

define('spk_rename', (t) =>
  step(COLOURS.transform, {
    message0: t.rename,
    args0: [columnSlot('COLUMN'), input('NAME', 'new_name')],
    tooltip: t.renameTip,
  }),
)

define('spk_drop', (t) =>
  step(COLOURS.transform, { message0: t.drop, args0: [columnSlot('COLUMN')], tooltip: t.dropTip }),
)

define('spk_drop_missing', (t) =>
  step(COLOURS.transform, {
    message0: t.dropMissing,
    args0: [columnSlot('COLUMN')],
    tooltip: t.dropMissingTip,
  }),
)

// --- Spatial ---------------------------------------------------------------


define('spk_points', (t) =>
  step(COLOURS.spatial, {
    message0: t.points,
    args0: [columnSlot('LON'), columnSlot('LAT')],
    tooltip: t.pointsTip,
  }),
)

define('spk_near', (t) =>
  step(COLOURS.spatial, {
    message0: t.near,
    args0: [valueSlot('spk_near', 'KM'), valueSlot('spk_near', 'LAT'), valueSlot('spk_near', 'LON')],
    tooltip: t.nearTip,
  }),
)

define('spk_distance', (t) =>
  step(COLOURS.spatial, {
    message0: t.distance,
    args0: [input('NAME', 'distance_km'), valueSlot('spk_distance', 'LAT'), valueSlot('spk_distance', 'LON')],
    tooltip: t.distanceTip,
  }),
)

define('spk_area', (t) =>
  step(COLOURS.spatial, {
    message0: t.area,
    args0: [input('NAME', 'area_km2')],
    tooltip: t.areaTip,
  }),
)

define('spk_count_within', (t) =>
  step(COLOURS.spatial, {
    message0: t.countWithin,
    args0: [input('NAME', 'count'), datasetSlot('DATASET')],
    tooltip: t.countWithinTip,
  }),
)

define('spk_centroid', (t) =>
  step(COLOURS.spatial, {
    message0: t.centroid,
    args0: [
      dropdown('MODE', [
        [t.centroidModes.own, 'own'],
        [t.centroidModes.wgs84, 'wgs84'],
      ]),
    ],
    tooltip: t.centroidTip,
  }),
)

define('spk_to_centroids', (t) =>
  step(COLOURS.spatial, {
    message0: t.toCentroids,
    args0: [
      dropdown('MODE', [
        [t.centreModes.centroid, 'centroid'],
        [t.centreModes.inside, 'inside'],
      ]),
    ],
    tooltip: t.toCentroidsTip,
  }),
)

define('spk_to_crs', (t) =>
  step(COLOURS.spatial, {
    message0: t.toCrs,
    args0: [
      dropdown('CRS', [
        [t.crsOptions.wgs84, 'EPSG:4326'],
        [t.crsOptions.utm32, 'EPSG:25832'],
        [t.crsOptions.laea, 'EPSG:3035'],
        [t.crsOptions.webMercator, 'EPSG:3857'],
      ]),
    ],
    tooltip: t.toCrsTip,
  }),
)

define('spk_length', (t) =>
  step(COLOURS.spatial, { message0: t.length, args0: [input('NAME', 'length_km')], tooltip: t.lengthTip }),
)

define('spk_nearest', (t) =>
  step(COLOURS.spatial, {
    message0: t.nearest,
    args0: [input('NAME', 'nearest_km'), datasetSlot('DATASET')],
    tooltip: t.nearestTip,
  }),
)

define('spk_inside', (t) =>
  step(COLOURS.spatial, {
    message0: t.inside,
    args0: [
      dropdown('MODE', [
        [t.insideModes.inside, 'inside'],
        [t.insideModes.outside, 'outside'],
      ]),
      datasetSlot('DATASET'),
    ],
    tooltip: t.insideTip,
  }),
)

define('spk_spatial_join', (t) =>
  step(COLOURS.spatial, { message0: t.spatialJoin, args0: [datasetSlot('DATASET')], tooltip: t.spatialJoinTip }),
)

define('spk_aggregate_within', (t) =>
  step(COLOURS.spatial, {
    message0: t.aggregateWithin,
    args0: [input('NAME', 'mean_value'), dropdown('AGG', aggOptions(t, true)), columnSlot('COLUMN'), datasetSlot('DATASET')],
    tooltip: t.aggregateWithinTip,
  }),
)

define('spk_buffer', (t) =>
  step(COLOURS.spatial, {
    message0: t.buffer,
    args0: [valueSlot('spk_buffer', 'METRES')],
    tooltip: t.bufferTip,
  }),
)

define('spk_dissolve', (t) =>
  step(COLOURS.spatial, { message0: t.dissolve, args0: [columnSlot('BY')], tooltip: t.dissolveTip }),
)

define('spk_convex_hull', (t) =>
  step(COLOURS.spatial, { message0: t.convexHull, tooltip: t.convexHullTip }),
)

define('spk_grid', (t) =>
  step(COLOURS.spatial, {
    message0: t.grid,
    args0: [
      dropdown('SHAPE', [
        [t.gridShapes.hexagon, 'hexagon'],
        [t.gridShapes.square, 'square'],
      ]),
      valueSlot('spk_grid', 'KM'),
    ],
    tooltip: t.gridTip,
  }),
)

// --- Outputs ---------------------------------------------------------------

define('spk_show_table', (t) =>
  step(COLOURS.output, {
    message0: t.showTable,
    args0: [input('TITLE', '')],
    tooltip: t.showTableTip,
  }),
)

define('spk_show_summary', (t) =>
  step(COLOURS.output, { message0: t.showSummary, tooltip: t.showSummaryTip }),
)

define('spk_show_chart', (t) =>
  step(COLOURS.output, {
    message0: t.showChart,
    args0: [
      dropdown('KIND', [
        [t.charts.bar, 'bar'],
        [t.charts.line, 'line'],
        [t.charts.scatter, 'scatter'],
        [t.charts.histogram, 'histogram'],
      ]),
    ],
    message1: t.chartX,
    args1: [columnSlot('X')],
    message2: t.chartY,
    args2: [columnSlot('Y')],
    message3: t.chartColor,
    args3: [colourSlot('COLOR')],
    message4: t.chartTitle,
    args4: [input('TITLE', '')],
    tooltip: t.showChartTip,
  }),
)

define('spk_show_map', (t) =>
  step(COLOURS.output, {
    message0: t.showMap,
    args0: [colourSlot('COLOR')],
    message1: t.chartTitle,
    args1: [input('TITLE', '')],
    tooltip: t.showMapTip,
  }),
)

define('spk_map', (t) =>
  step(COLOURS.output, {
    message0: t.map,
    args0: [input('TITLE', '')],
    message1: t.mapBasemap,
    args1: [
      dropdown('BASEMAP', [
        [t.basemaps.light, 'light'],
        [t.basemaps.osm, 'osm'],
        [t.basemaps.topo, 'topo'],
        [t.basemaps.satellite, 'satellite'],
      ]),
    ],
    message2: '%1',
    args2: [{ type: 'input_statement', name: 'LAYERS', check: 'layer' }],
    tooltip: t.mapTip,
  }),
)

define('spk_map_layer', (t) => ({
  message0: t.mapLayer,
  args0: [
    datasetSlot('DATASET'),
    dropdown('STYLE', [
      [t.mapStyles.auto, 'auto'],
      [t.mapStyles.points, 'points'],
      [t.mapStyles.bubbles, 'bubbles'],
      [t.mapStyles.areas, 'areas'],
      [t.mapStyles.lines, 'lines'],
    ]),
  ],
  message1: t.mapLayerColor,
  args1: [colourSlot('COLOR')],
  message2: t.mapLayerSize,
  args2: [columnSlot('SIZE')],
  message3: t.mapLayerLabel,
  args3: [columnSlot('LABEL')],
  previousStatement: 'layer',
  nextStatement: 'layer',
  colour: COLOURS.output,
  tooltip: t.mapLayerTip,
}))

define('spk_show_stat', (t) =>
  step(COLOURS.output, {
    message0: t.showStat,
    args0: [
      dropdown('AGG', aggOptions(t, true)),
      columnSlot('COLUMN'),
      input('LABEL', ''),
    ],
    tooltip: t.showStatTip,
  }),
)

// --- Columns, datasets and values -------------------------------------------
// One small block per column ("pm10"), dataset ("stations") and taken value ("total"),
// offered in the toolbox. They plug into the slots of the analysis blocks.

/** Workspace a block will be used in: for a block in the toolbox flyout, the one it is dropped into. */
const homeWorkspace = (block: Blockly.Block) =>
  (block.workspace as { targetWorkspace?: Blockly.Workspace | null }).targetWorkspace ?? block.workspace

/** Set the output check computed by `checkOf` now and whenever the workspace changes. */
const typedOutput = (block: Blockly.Block, checkOf: (block: Blockly.Block) => string[] | null) => {
  const refresh = () => {
    const connection = block.outputConnection
    if (block.isDisposed() || !connection) return
    const check = checkOf(block)
    if (JSON.stringify(connection.getCheck()) !== JSON.stringify(check)) connection.setCheck(check)
  }
  block.setOnChange((event) => {
    if (!event.isUiEvent) refresh()
  })
  // After loading: the field value is set once init has returned.
  queueMicrotask(refresh)
}

const label = (name: string) => ({ type: 'field_label_serializable', name, text: '' })

/**
 * Column and value blocks made in the Select tab point into the original data
 * (stations["temperature"]); the reference and its type are saved with the block.
 */

const withReference = (block: Blockly.Block) => {
  const mixin = block as Blockly.Block & {
    saveExtraState: () => Reference | null
    loadExtraState: (state: Reference) => void
  }
  mixin.saveExtraState = () => {
    const saved = Object.fromEntries(Object.entries(referenceOf(block)).filter(([, value]) => value !== undefined))
    return Object.keys(saved).length ? saved : null
  }
  mixin.loadExtraState = (state) => {
    const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
    setReference(block, {
      ref: isSelectionRef(state?.ref) ? state.ref : undefined,
      type: text(state?.type),
      id: text(state?.id),
      output: state?.output === 'value' || state?.output === 'column' ? state.output : undefined,
    })
    onReferenceLoaded.get(block)?.()
  }
}

/** Called after a block's reference was loaded (e.g. to show where a selection points to). */
const onReferenceLoaded = new WeakMap<Blockly.Block, () => void>()

/** "stations › temperature", "osem › boxes › each › title", "mean of stations › pm10". */
const describeReference = (ref: SelectionRef) => {
  const t = getMessages().blocks
  switch (ref.kind) {
    case 'column':
      return `${ref.dataset} › ${ref.column}`
    case 'json':
      return `${ref.dataset} › ${describePath(ref.path, t.eachItem, t.wholeFile)}`
    case 'stat':
      return `${t.agg[ref.agg as keyof typeof t.agg] ?? ref.agg} ${ref.dataset} › ${ref.column}`
  }
}

/**
 * A selection made in the Select tab, as a block in the data block: "select stations › temperature
 * as temperature". It copies nothing; the analysis toolbox offers a block with its name that reads
 * directly from the data. Delete it to remove the selection, rename it to rename the block.
 */
define(
  SELECT_BLOCK,
  (t) =>
    load({
      message0: t.selectAs,
      args0: [{ type: 'field_label', name: 'SOURCE', text: '…' }, { type: 'field_input', name: 'NAME', text: 'value' }],
      tooltip: t.selectAsTip,
    }),
  (block) => {
    withReference(block)
    onReferenceLoaded.set(block, () => {
      const { ref, output } = referenceOf(block)
      if (ref) block.getField('SOURCE')?.setValue(describeReference(ref))
      block.setColour(output === 'value' ? COLOURS.value : COLOURS.column)
    })
  },
)

// --- Colours -------------------------------------------------------------------

/** A fixed colour, for the colour gap of charts and maps (instead of colouring by a column). */
define('spk_colour', (t) => ({
  message0: '%1',
  args0: [{ type: 'field_spk_colour', name: 'COLOUR' }],
  output: COLOUR_CHECK,
  colour: COLOURS.output,
  tooltip: t.colourTip,
}))

/** A value's check is its type (Number, String, Boolean) once Python has run, so it only fits matching slots. */
const valueCheck = (block: Blockly.Block) => {
  const saved = referenceOf(block).type
  if (saved) return [saved]
  const name = toIdentifier(String(block.getFieldValue('NAME') ?? ''))
  const type = knownValues(homeWorkspace(block)).find((value) => value.name === name)?.type
  return type ? [type] : null
}

const COLUMN_TYPES: Record<string, string> = { number: 'NumberColumn', text: 'StringColumn', category: 'StringColumn', boolean: 'BooleanColumn' }

/**
 * A column fits every column slot; numeric columns also fit calculations and the filter's
 * value slot (as "NumberColumn"), so "pm10 > limit" and "pm10 × 2" work, "first pm10 rows" does not.
 */
const columnCheck = (block: Blockly.Block) => {
  const saved = referenceOf(block).type
  if (saved) return [COLUMN_CHECK, saved]
  const ref = referenceOf(block).ref
  const name = ref?.kind === 'column' ? ref.column : String(block.getFieldValue('COLUMN') ?? '')
  let kind: string | undefined
  for (const fields of Object.values(useKernelStore.getState().schemas)) {
    kind = fields.find((field) => field.name === name)?.kind
    if (kind) break
  }
  if (!kind && isNumericColumn(block, name)) kind = 'number'
  return kind && COLUMN_TYPES[kind] ? [COLUMN_CHECK, COLUMN_TYPES[kind]] : [COLUMN_CHECK]
}

define(
  COLUMN_BLOCK,
  (t) => ({ message0: '%1', args0: [label('COLUMN')], output: COLUMN_CHECK, colour: COLOURS.column, tooltip: t.columnValueTip }),
  (block) => {
    withReference(block)
    typedOutput(block, columnCheck)
  },
)

define(DATASET_BLOCK, (t) => ({
  message0: '%1',
  args0: [label('NAME')],
  output: DATASET_CHECK,
  colour: COLOURS.data,
  tooltip: t.datasetBlockTip,
}))

define(
  'spk_value',
  (t) => ({ message0: '%1', args0: [label('NAME')], output: null, colour: COLOURS.value, tooltip: t.useValueTip }),
  (block) => {
    withReference(block)
    typedOutput(block, valueCheck)
  },
)

// Calculations ("pm10 × 2") take numeric columns as well as numbers.
for (const [type, inputs] of [
  ['math_arithmetic', ['A', 'B']],
  ['math_single', ['NUM']],
] as const) {
  const original = Blockly.Blocks[type].init as (this: Blockly.Block) => void
  Blockly.Blocks[type].init = function (this: Blockly.Block) {
    original.call(this)
    for (const input of inputs) this.getInput(input)?.setCheck(['Number', 'NumberColumn'])
  }
}
