/**
 * Showing data, as blocks of their own: a table, a map, a time chart. They
 * become calls to spockly.py's zeige_… functions, which hand the dataset to
 * the app; they don't change the data.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { t } from '../i18n'
import { chosenColumns, NO_COLUMN } from './fields'
import { SHAPE_COLUMN } from './steps'
import { datasetBlocks, datasetNameOf, needs, PROGRAM, pythonNameOf, quoted, traced } from './program'

export const VIEW_TABLE = 'view_table'
export const VIEW_MAP = 'view_map'
/** The map of a table with shapes (points, lines, areas), e.g. from GeoJSON. */
export const VIEW_SHAPES = 'view_shapes'
export const VIEW_CHART = 'view_chart'

const dataset = { type: 'field_dataset', name: 'DATASET', value: t('dataset.default') }
/** A column dropdown of the given kind (see fields.ts): only the columns that fit. */
const column = (kind: string, name: string, value: string) => ({ type: `field_${kind}_column`, name, value })
const lineBreak = { type: 'input_dummy' }
/** What the map shows on hover over a place: any number of columns; none ticked, the map picks. */
const info = { type: 'field_columns', name: 'INFO', value: '' }

Blockly.common.defineBlocksWithJsonArray([
  {
    type: VIEW_TABLE,
    message0: t('block.viewTable'),
    args0: [dataset],
    previousStatement: PROGRAM,
    nextStatement: PROGRAM,
    style: 'view_blocks',
    tooltip: t('block.viewTable.tooltip'),
  },
  {
    type: VIEW_MAP,
    message0: t('block.viewMap'),
    args0: [dataset, lineBreak, column('value', 'LAT', 'lat'), column('value', 'LON', 'lon'), lineBreak, column('colour', 'COLOUR', NO_COLUMN), lineBreak, info],
    previousStatement: PROGRAM,
    nextStatement: PROGRAM,
    style: 'view_blocks',
    tooltip: t('block.viewMap.tooltip'),
  },
  {
    type: VIEW_SHAPES,
    message0: t('block.viewShapes'),
    args0: [dataset, lineBreak, column('shape', 'SHAPE', SHAPE_COLUMN), lineBreak, column('colour', 'COLOUR', NO_COLUMN), lineBreak, info],
    previousStatement: PROGRAM,
    nextStatement: PROGRAM,
    style: 'view_blocks',
    tooltip: t('block.viewShapes.tooltip'),
  },
  {
    type: VIEW_CHART,
    message0: t('block.viewChart'),
    args0: [dataset, lineBreak, column('time', 'TIME', 'createdAt'), column('value', 'VALUE', 'value'), lineBreak, column('group', 'GROUP', 'station_name')],
    previousStatement: PROGRAM,
    nextStatement: PROGRAM,
    style: 'view_blocks',
    tooltip: t('block.viewChart.tooltip'),
  },
])

/** The dataset's Python name and its name as written, or null if there is no such dataset. */
function chosenDataset(block: Blockly.Block): { variable: string; title: string } | null {
  const title = String(block.getFieldValue('DATASET') ?? '')
  const found = datasetBlocks(block.workspace).find((d) => datasetNameOf(d) === title)
  block.setWarningText(found ? null : t('block.noSuchDataset', { name: title }))
  return found ? { variable: pythonNameOf(found), title } : null
}

const field = (block: Blockly.Block, name: string) => quoted(String(block.getFieldValue(name) ?? ''))
/** The columns ticked for hovering, as a Python argument; nothing when none is ticked. */
const infoArgument = (block: Blockly.Block) => {
  const chosen = chosenColumns(block.getFieldValue('INFO'))
  return chosen.length ? `, info=[${chosen.map(quoted).join(', ')}]` : ''
}

/** A column that may be none: None in Python. */
const optional = (block: Blockly.Block, name: string) => {
  const value = String(block.getFieldValue(name) ?? NO_COLUMN)
  return value === NO_COLUMN ? 'None' : quoted(value)
}

pythonGenerator.forBlock[VIEW_TABLE] = (block, generator) => {
  const chosen = chosenDataset(block)
  if (!chosen) return ''
  needs(generator, 'from spockly import zeige_tabelle')
  return `zeige_tabelle(${chosen.variable}, titel=${quoted(chosen.title)})\n` + traced(block, chosen.variable)
}

pythonGenerator.forBlock[VIEW_MAP] = (block, generator) => {
  const chosen = chosenDataset(block)
  if (!chosen) return ''
  needs(generator, 'from spockly import zeige_karte')
  return (
    `zeige_karte(${chosen.variable}, breite=${field(block, 'LAT')}, laenge=${field(block, 'LON')}, ` +
    `farbe=${optional(block, 'COLOUR')}, titel=${quoted(chosen.title)}${infoArgument(block)})\n` +
    traced(block, chosen.variable)
  )
}

// The same zeige_karte, with the shapes in place of latitude and longitude.
pythonGenerator.forBlock[VIEW_SHAPES] = (block, generator) => {
  const chosen = chosenDataset(block)
  if (!chosen) return ''
  needs(generator, 'from spockly import zeige_karte')
  return (
    `zeige_karte(${chosen.variable}, form=${field(block, 'SHAPE')}, farbe=${optional(block, 'COLOUR')}, titel=${quoted(chosen.title)}${infoArgument(block)})\n` +
    traced(block, chosen.variable)
  )
}

pythonGenerator.forBlock[VIEW_CHART] = (block, generator) => {
  const chosen = chosenDataset(block)
  if (!chosen) return ''
  needs(generator, 'from spockly import zeige_zeitverlauf')
  return (
    `zeige_zeitverlauf(${chosen.variable}, zeit=${field(block, 'TIME')}, wert=${field(block, 'VALUE')}, ` +
    `je=${optional(block, 'GROUP')}, titel=${quoted(chosen.title)})\n` +
    traced(block, chosen.variable)
  )
}
