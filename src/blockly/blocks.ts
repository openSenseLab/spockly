import * as Blockly from 'blockly'
import 'blockly/blocks'

import { getMessages, type Messages } from '../i18n'
import { SAMPLES } from '../journal/samples'
import './fields'
import { toIdentifier } from './python'
import { PIPELINE } from './schema'

/** Block colours: blue and green from the Geoinformatik palette; white labels stay readable on all. */
export const COLOURS = {
  data: '#007eaa',
  transform: '#55821a',
  spatial: '#d9480f',
  output: '#9c36b5',
  value: '#4f6f86',
} as const

type BlockMessages = Messages['blocks']
type Json = Record<string, unknown>

const column = (name: string) => ({ type: 'field_spk_column', name })
const optionalColumn = (name: string) => ({ type: 'field_spk_optional_column', name })
/** Column of the dataset chosen in the same block's DATASET field. */
const datasetColumn = (name: string) => ({ type: 'field_spk_dataset_column', name })
const dataset = (name: string) => ({ type: 'field_spk_dataset', name })
const input = (name: string, text: string) => ({ type: 'field_input', name, text })
const number = (name: string, value: number, extra: Json = {}) => ({
  type: 'field_number',
  name,
  value,
  ...extra,
})
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

/** Each block reads its texts from the active language when it is created. */
const define = (type: string, build: (t: BlockMessages) => Json, setup?: (block: Blockly.Block) => void) => {
  Blockly.Blocks[type] = {
    init(this: Blockly.Block) {
      this.jsonInit(build(getMessages().blocks))
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

const step = (colour: string, json: Json): Json => ({
  previousStatement: 'step',
  nextStatement: 'step',
  colour,
  ...json,
})

// --- Data ------------------------------------------------------------------

define(PIPELINE, (t) => ({
  message0: t.pipeline,
  args0: [dataset('DATASET')],
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
    args0: [dataset('DATASET'), column('COLUMN')],
    tooltip: t.joinTip,
  }),
)

// --- Transform -------------------------------------------------------------

define('spk_filter', (t) =>
  step(COLOURS.transform, {
    message0: t.filter,
    args0: [
      column('COLUMN'),
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
      input('VALUE', ''),
    ],
    tooltip: t.filterTip,
  }),
)

define('spk_filter_in', (t) =>
  step(COLOURS.transform, {
    message0: t.filterIn,
    args0: [
      column('COLUMN'),
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
    args0: [number('FROM', 1, { min: 1, precision: 1 }), number('TO', 10, { min: 1, precision: 1 })],
    tooltip: t.rowsTip,
  }),
)

define('spk_sort', (t) =>
  step(COLOURS.transform, {
    message0: t.sort,
    args0: [
      column('COLUMN'),
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
    args0: [number('N', 10, { min: 0, precision: 1 })],
    tooltip: t.headTip,
  }),
)

define('spk_group', (t) =>
  step(COLOURS.transform, {
    message0: t.group,
    args0: [column('BY'), dropdown('AGG', aggOptions(t, true)), optionalColumn('COLUMN')],
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
      column('COLUMN'),
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
    args0: [column('COLUMN'), number('DIGITS', 1, { min: 0, max: 10, precision: 1 })],
    tooltip: t.roundTip,
  }),
)

define('spk_rename', (t) =>
  step(COLOURS.transform, {
    message0: t.rename,
    args0: [column('COLUMN'), input('NAME', 'new_name')],
    tooltip: t.renameTip,
  }),
)

define('spk_drop', (t) =>
  step(COLOURS.transform, { message0: t.drop, args0: [column('COLUMN')], tooltip: t.dropTip }),
)

define('spk_drop_missing', (t) =>
  step(COLOURS.transform, {
    message0: t.dropMissing,
    args0: [column('COLUMN')],
    tooltip: t.dropMissingTip,
  }),
)

// --- Spatial ---------------------------------------------------------------

const lat = (name = 'LAT') => number(name, 51.96, { min: -90, max: 90, precision: 0.0001 })
const lon = (name = 'LON') => number(name, 7.63, { min: -180, max: 180, precision: 0.0001 })

define('spk_points', (t) =>
  step(COLOURS.spatial, {
    message0: t.points,
    args0: [column('LON'), column('LAT')],
    tooltip: t.pointsTip,
  }),
)

define('spk_near', (t) =>
  step(COLOURS.spatial, {
    message0: t.near,
    args0: [number('KM', 2, { min: 0, precision: 0.1 }), lat(), lon()],
    tooltip: t.nearTip,
  }),
)

define('spk_distance', (t) =>
  step(COLOURS.spatial, {
    message0: t.distance,
    args0: [input('NAME', 'distance_km'), lat(), lon()],
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
    args0: [input('NAME', 'count'), dataset('DATASET')],
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
    args0: [input('NAME', 'nearest_km'), dataset('DATASET')],
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
      dataset('DATASET'),
    ],
    tooltip: t.insideTip,
  }),
)

define('spk_spatial_join', (t) =>
  step(COLOURS.spatial, { message0: t.spatialJoin, args0: [dataset('DATASET')], tooltip: t.spatialJoinTip }),
)

define('spk_aggregate_within', (t) =>
  step(COLOURS.spatial, {
    message0: t.aggregateWithin,
    args0: [input('NAME', 'mean_value'), dropdown('AGG', aggOptions(t, true)), datasetColumn('COLUMN'), dataset('DATASET')],
    tooltip: t.aggregateWithinTip,
  }),
)

define('spk_buffer', (t) =>
  step(COLOURS.spatial, {
    message0: t.buffer,
    args0: [number('METRES', 500, { min: 0, precision: 1 })],
    tooltip: t.bufferTip,
  }),
)

define('spk_dissolve', (t) =>
  step(COLOURS.spatial, { message0: t.dissolve, args0: [optionalColumn('BY')], tooltip: t.dissolveTip }),
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
      number('KM', 1, { min: 0.01, precision: 0.01 }),
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
    args1: [column('X')],
    message2: t.chartY,
    args2: [optionalColumn('Y')],
    message3: t.chartColor,
    args3: [optionalColumn('COLOR')],
    message4: t.chartTitle,
    args4: [input('TITLE', '')],
    tooltip: t.showChartTip,
  }),
)

define('spk_show_map', (t) =>
  step(COLOURS.output, {
    message0: t.showMap,
    args0: [optionalColumn('COLOR')],
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
    { type: 'field_spk_layer_source', name: 'DATASET' },
    dropdown('STYLE', [
      [t.mapStyles.auto, 'auto'],
      [t.mapStyles.points, 'points'],
      [t.mapStyles.bubbles, 'bubbles'],
      [t.mapStyles.areas, 'areas'],
      [t.mapStyles.lines, 'lines'],
    ]),
  ],
  message1: t.mapLayerColor,
  args1: [optionalColumn('COLOR')],
  message2: t.mapLayerSize,
  args2: [optionalColumn('SIZE')],
  message3: t.mapLayerLabel,
  args3: [optionalColumn('LABEL')],
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
      optionalColumn('COLUMN'),
      input('LABEL', ''),
    ],
    tooltip: t.showStatTip,
  }),
)

// --- Values ----------------------------------------------------------------

define('spk_column', (t) => ({
  message0: t.columnValue,
  args0: [column('COLUMN')],
  output: null,
  colour: COLOURS.value,
  tooltip: t.columnValueTip,
}))
