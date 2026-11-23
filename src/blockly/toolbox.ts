import * as Blockly from 'blockly'

import type { Messages } from '../i18n'
import { COLOURS } from './blocks'
import { LIBRARY_CATEGORY } from './library'
import { PIPELINE } from './schema'

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: 'block', type, ...extra })

/** spk_compute with a ready-made "column × 1" expression to show how values plug in. */
const computeExample = {
  inputs: {
    VALUE: {
      block: {
        type: 'math_arithmetic',
        fields: { OP: 'MULTIPLY' },
        inputs: {
          A: { block: { type: 'spk_column' } },
          B: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        },
      },
    },
  },
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
  ],
})

/** Analysis toolbox; the lab also gets the load blocks, since it has no separate data cells. */
export const buildToolbox = (
  t: Messages['toolbox'],
  { withLoad = false } = {},
): Blockly.utils.toolbox.ToolboxDefinition => ({
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: t.data,
      colour: COLOURS.data,
      contents: [
        ...(withLoad ? [block('spk_load_example'), block('spk_load_file'), block('spk_load_url'), { kind: 'sep', gap: 24 }] : []),
        block(PIPELINE),
        block('spk_save'),
        block('spk_join'),
      ],
    },
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
      contents: [
        block('spk_column'),
        block('math_number'),
        block('math_arithmetic'),
        block('math_single'),
        block('text'),
      ],
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
