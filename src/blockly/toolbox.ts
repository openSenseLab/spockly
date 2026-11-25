import * as Blockly from 'blockly'

import { getMessages, type Messages } from '../i18n'
import { COLOURS } from './blocks'
import { knownDatasets, knownValues } from './fields'
import { LIBRARY_CATEGORY } from './library'
import { PIPELINE } from './schema'
import type { Selection } from '../journal/types'
import { getEditorContext } from './context'
import { COLUMN_BLOCK, datasetBlock } from './selection'

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: 'block', type, ...extra })

/** spk_compute with a ready-made "… × 1" calculation: a column block goes into the gap. */
const computeExample = {
  inputs: {
    VALUE: {
      block: {
        type: 'math_arithmetic',
        fields: { OP: 'MULTIPLY' },
        inputs: { B: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
      },
    },
  },
}

const label = (text: string) => ({ kind: 'label', text })

export const DATA_CATEGORY = 'SPK_DATA'

/** Load blocks for the lab, which has no separate data cells. */
const LAB_LOADS = ['spk_load_example', 'spk_load_file', 'spk_load_url', 'spk_load_gis_file', 'spk_load_gis_url']

/**
 * The "Data" category, built each time it opens: one block per dataset, the blocks that work
 * with a dataset ("use dataset" comes with the first dataset already in its gap), then the
 * selections and columns.
 */
export const dataFlyout =
  (withLoad: boolean) =>
  (workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray => {
    const t = getMessages().toolbox
    const names = knownDatasets(workspace)
    return [
      ...(withLoad ? [...LAB_LOADS.map((type) => block(type)), { kind: 'sep', gap: 24 }] : []),
      label(t.datasets),
      ...(names.length ? names.map((name) => ({ kind: 'block', ...datasetBlock(name) })) : [label(t.datasetsNone)]),
      label(t.steps),
      block(PIPELINE, names[0] ? { inputs: { DATASET: { block: datasetBlock(names[0]) } } } : {}),
      block('spk_save'),
      block('spk_join'),
      ...columnItems(),
    ]
  }

/** The columns picked in the Select tab of a dataset (not every column: only what was chosen). */
const columnItems = (): Blockly.utils.toolbox.FlyoutItemInfoArray => {
  const t = getMessages().toolbox
  const selected = getEditorContext()
    .selections()
    .filter((selection) => selection.output === 'column')
  return [label(t.columnsSelected), ...(selected.length ? selected.map(selectionBlock) : [label(t.columnsNone)])]
}

/** Data cells only load data: a small always-open flyout instead of categories. */
export const buildDataToolbox = (t: Messages['toolbox']): Blockly.utils.toolbox.ToolboxDefinition => ({
  kind: 'flyoutToolbox',
  contents: [
    { kind: 'label', text: t.loadHint },
    block('spk_load_example'),
    block('spk_load_file'),
    block('spk_load_url'),
    { kind: 'label', text: t.gisHint },
    block('spk_load_gis_file'),
    block('spk_load_gis_url'),
    block('spk_make_spatial'),
    // Parts of the data are picked in the Select tab of the inspection: they become column /
    // value blocks of the analysis toolbox, so no "take" blocks here.
  ],
})

/** A column / value block made in the Select tab, pointing into its dataset. */
const selectionBlock = (selection: Selection) => ({
  kind: 'block',
  type: selection.output === 'column' ? COLUMN_BLOCK : 'spk_value',
  fields: selection.output === 'column' ? { COLUMN: selection.name } : { NAME: selection.name },
  extraState: { ref: selection.ref, ...(selection.type ? { type: selection.type } : {}) },
})

export const VALUES_CATEGORY = 'SPK_VALUES'

/**
 * The "Values" category, built each time it opens: one ready block per value taken in a
 * data block (typed, so it only fits matching slots), then numbers, text and calculations.
 */
export const valuesFlyout = (workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray => {
  const t = getMessages().toolbox
  const selected = getEditorContext()
    .selections()
    .filter((selection) => selection.output === 'value')
  // Values of older journals, taken with "take value" blocks in a data block.
  const taken = knownValues(workspace).filter((value) => !selected.some((selection) => selection.name === value.name))
  return [
    { kind: 'label', text: t.valuesYours },
    ...selected.map(selectionBlock),
    ...taken.map((value) => block('spk_value', { fields: { NAME: value.name } })),
    ...(selected.length || taken.length ? [] : [{ kind: 'label', text: t.valuesNone }]),
    { kind: 'label', text: t.valuesGeneral },
    block('spk_colour'),
    block('math_number'),
    block('math_arithmetic'),
    block('math_single'),
    block('text'),
  ]
}

/** Analysis toolbox; the lab also gets the load blocks, since it has no separate data cells. */
export const buildToolbox = (
  t: Messages['toolbox'],
  { withLoad = false } = {},
): Blockly.utils.toolbox.ToolboxDefinition => ({
  kind: 'categoryToolbox',
  contents: [
    // The lab's data category also holds the load blocks (see dataFlyout).
    { kind: 'category', name: t.data, colour: COLOURS.data, custom: withLoad ? `${DATA_CATEGORY}_LAB` : DATA_CATEGORY },
    {
      kind: 'category',
      name: t.transform,
      colour: COLOURS.transform,
      contents: [
        block('spk_filter'),
        block('spk_filter_in'),
        block('spk_rows'),
        block('spk_sort'),
        block('spk_head'),
        block('spk_group'),
        block('spk_compute', computeExample),
        block('spk_convert'),
        block('spk_round'),
        block('spk_rename'),
        block('spk_drop'),
        block('spk_drop_missing'),
      ],
    },
    {
      kind: 'category',
      name: t.spatial,
      colour: COLOURS.spatial,
      contents: [
        { kind: 'label', text: t.spatialCreate },
        block('spk_points'),
        block('spk_to_centroids'),
        block('spk_to_crs'),
        block('spk_centroid'),
        { kind: 'label', text: t.spatialMeasure },
        block('spk_distance'),
        block('spk_nearest'),
        block('spk_area'),
        block('spk_length'),
        { kind: 'label', text: t.spatialSelect },
        block('spk_near'),
        block('spk_inside'),
        { kind: 'label', text: t.spatialCombine },
        block('spk_spatial_join'),
        block('spk_count_within'),
        block('spk_aggregate_within', { fields: { NAME: 'mean_value', AGG: 'mean' } }),
        { kind: 'label', text: t.spatialProcess },
        block('spk_buffer'),
        block('spk_dissolve'),
        block('spk_convex_hull'),
        block('spk_grid'),
      ],
    },
    {
      kind: 'category',
      name: t.output,
      colour: COLOURS.output,
      contents: [
        block('spk_show_table'),
        block('spk_show_summary'),
        block('spk_show_chart'),
        block('spk_colour'),
        block('spk_map', { inputs: { LAYERS: { block: { type: 'spk_map_layer' } } } }),
        block('spk_map_layer'),
        block('spk_show_map'),
        block('spk_show_stat'),
      ],
    },
    {
      kind: 'category',
      name: t.values,
      colour: COLOURS.value,
      custom: VALUES_CATEGORY,
    },
    { kind: 'sep' },
    {
      kind: 'category',
      name: t.library,
      colour: '#7ab629',
      custom: LIBRARY_CATEGORY,
    },
    {
      kind: 'category',
      name: t.more,
      colour: '#868e96',
      contents: [
        {
          kind: 'category',
          name: t.programming,
          colour: '#868e96',
          contents: [
            block('text_print'),
            block('controls_if'),
            block('logic_compare'),
            block('controls_repeat_ext'),
            block('controls_forEach'),
            block('lists_create_with'),
          ],
        },
        {
          kind: 'category',
          name: t.variables,
          categorystyle: 'variable_category',
          custom: Blockly.VARIABLE_CATEGORY_NAME,
        },
      ],
    },
  ],
})
