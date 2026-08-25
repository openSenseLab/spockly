import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

const blockDefinitions = [
  {
    type: 'load_vector_data',
    message0: 'load vector data from %1 as %2',
    args0: [
      { type: 'field_input', name: 'PATH', text: 'data/neighbourhoods.geojson' },
      { type: 'field_input', name: 'VARIABLE', text: 'layer' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Read a vector dataset into a GeoDataFrame.',
  },
  {
    type: 'reproject_layer',
    message0: 'reproject %1 to EPSG %2',
    args0: [
      { type: 'field_input', name: 'VARIABLE', text: 'layer' },
      { type: 'field_number', name: 'EPSG', value: 3857, min: 2000, precision: 1 },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Project a GeoDataFrame into a new coordinate reference system.',
  },
  {
    type: 'filter_by_attribute',
    message0: 'filter %1 where %2 equals %3 and save as %4',
    args0: [
      { type: 'field_input', name: 'SOURCE', text: 'layer' },
      { type: 'field_input', name: 'COLUMN', text: 'district' },
      { type: 'field_input', name: 'VALUE', text: 'Centre' },
      { type: 'field_input', name: 'OUTPUT', text: 'filtered_layer' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Create a filtered GeoDataFrame based on an attribute value.',
  },
  {
    type: 'buffer_layer',
    message0: 'buffer %1 by %2 meters and save as %3',
    args0: [
      { type: 'field_input', name: 'SOURCE', text: 'layer' },
      { type: 'field_number', name: 'DISTANCE', value: 250, min: 0, precision: 1 },
      { type: 'field_input', name: 'OUTPUT', text: 'buffered_layer' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Build a metric buffer around the current geometry.',
  },
  {
    type: 'spatial_join_layers',
    message0: 'spatial join %1 with %2 and save as %3',
    args0: [
      { type: 'field_input', name: 'LEFT', text: 'points' },
      { type: 'field_input', name: 'RIGHT', text: 'polygons' },
      { type: 'field_input', name: 'OUTPUT', text: 'joined_layer' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Join one layer to another using an intersects predicate.',
  },
  {
    type: 'plot_layer',
    message0: 'plot %1 with title %2',
    args0: [
      { type: 'field_input', name: 'VARIABLE', text: 'layer' },
      { type: 'field_input', name: 'TITLE', text: 'Spatial analysis result' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Visualise the current GeoDataFrame with matplotlib.',
  },
]

const generatorDefinitions = pythonGenerator as typeof pythonGenerator & {
  definitions_: Record<string, string>
}

const sanitizeIdentifier = (value: string, fallback: string) => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_]/g, '_')
  return cleaned.length > 0 ? cleaned : fallback
}

const registerGenerator = () => {
  pythonGenerator.forBlock.load_vector_data = (block, generator) => {
    generatorDefinitions.definitions_.import_geopandas = 'import geopandas as gpd'

    const path = generator.quote_(block.getFieldValue('PATH'))
    const variable = sanitizeIdentifier(block.getFieldValue('VARIABLE'), 'layer')
    return `${variable} = gpd.read_file(${path})\n`
  }

  pythonGenerator.forBlock.reproject_layer = (block) => {
    const variable = sanitizeIdentifier(block.getFieldValue('VARIABLE'), 'layer')
    const epsg = Number(block.getFieldValue('EPSG')) || 3857
    return `${variable} = ${variable}.to_crs(epsg=${epsg})\n`
  }

  pythonGenerator.forBlock.filter_by_attribute = (block, generator) => {
    const source = sanitizeIdentifier(block.getFieldValue('SOURCE'), 'layer')
    const column = generator.quote_(block.getFieldValue('COLUMN'))
    const value = generator.quote_(block.getFieldValue('VALUE'))
    const output = sanitizeIdentifier(block.getFieldValue('OUTPUT'), 'filtered_layer')
    return `${output} = ${source}[${source}[${column}] == ${value}].copy()\n`
  }

  pythonGenerator.forBlock.buffer_layer = (block) => {
    const source = sanitizeIdentifier(block.getFieldValue('SOURCE'), 'layer')
    const output = sanitizeIdentifier(block.getFieldValue('OUTPUT'), 'buffered_layer')
    const distance = Number(block.getFieldValue('DISTANCE')) || 0
    return `${output} = ${source}.copy()\n${output}.geometry = ${output}.buffer(${distance})\n`
  }

  pythonGenerator.forBlock.spatial_join_layers = (block) => {
    generatorDefinitions.definitions_.import_geopandas = 'import geopandas as gpd'

    const left = sanitizeIdentifier(block.getFieldValue('LEFT'), 'left_layer')
    const right = sanitizeIdentifier(block.getFieldValue('RIGHT'), 'right_layer')
    const output = sanitizeIdentifier(block.getFieldValue('OUTPUT'), 'joined_layer')
    return `${output} = gpd.sjoin(${left}, ${right}, how='left', predicate='intersects')\n`
  }

  pythonGenerator.forBlock.plot_layer = (block, generator) => {
    generatorDefinitions.definitions_.import_matplotlib = 'import matplotlib.pyplot as plt'

    const variable = sanitizeIdentifier(block.getFieldValue('VARIABLE'), 'layer')
    const title = generator.quote_(block.getFieldValue('TITLE'))
    return `ax = ${variable}.plot(figsize=(8, 6), alpha=0.8, edgecolor='black')\nax.set_title(${title})\nplt.show()\n`
  }

}

let isRegistered = false

export const registerSpatialBlocks = () => {
  if (isRegistered) {
    return
  }

  Blockly.defineBlocksWithJsonArray(blockDefinitions)
  registerGenerator()
  isRegistered = true
}

export const spatialToolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Spatial data science',
      colour: '#0ea5e9',
      contents: [
        { kind: 'block', type: 'load_vector_data' },
        { kind: 'block', type: 'reproject_layer' },
        { kind: 'block', type: 'filter_by_attribute' },
        { kind: 'block', type: 'buffer_layer' },
        { kind: 'block', type: 'spatial_join_layers' },
        { kind: 'block', type: 'plot_layer' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_round' },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: Blockly.VARIABLE_CATEGORY_NAME,
    },
  ],
}
