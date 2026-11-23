/**
 * Steps that prepare data from any source, in the same order for each:
 * translate the text for Python (from JSON, GeoJSON included, or from CSV),
 * make a table of it (of a list, or of GeoJSON's shapes), then split or
 * change columns. openSenseMap, own files and, later, web addresses all use
 * these steps; only how the text arrives differs.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { t } from '../i18n'
import './fields'
import { type DataKind, needs, quoted, stepShape, variableFor } from './program'

export const READ_JSON = 'step_read_json'
/** CSV text → a list with one entry per line, like JSON's lists. */
export const TRANSLATE_CSV = 'step_translate_csv'
/** A list (from JSON or CSV) → a table, one row per entry. */
export const JSON_TABLE = 'step_json_table'
/** Translated GeoJSON → a table, one row per shape. */
export const GEOJSON_TABLE = 'step_geojson_table'
export const SPLIT_POSITION = 'step_split_position'
export const CONVERT_COLUMN = 'step_convert_column'

/** The column a GeoJSON object's shape goes to: the whole shape (point, line or area), for the map. */
export const SHAPE_COLUMN = t('column.shape')
/** The column openSenseMap's positions go to ([longitude, latitude]), named in the student's language. */
export const COORDINATES_COLUMN = t('column.coordinates')

/** Where to find the blocks of other categories, for the tooltips. */
const categories = { general: t('toolbox.general'), own: t('toolbox.ownData'), osem: t('toolbox.osem') }

/** A step: what it takes from the block above and leaves for the one below (see DATA in program.ts). */
const step = (type: string, message: string, tooltip: string, [takes, gives]: [DataKind[], DataKind], args: object[] = []) => ({
  type,
  message0: message,
  args0: args,
  ...stepShape(takes, gives),
  style: 'step_blocks',
  tooltip,
})

Blockly.common.defineBlocksWithJsonArray([
  step(READ_JSON, t('block.readJson'), t('block.readJson.tooltip', categories), [['text'], 'json']),
  step(TRANSLATE_CSV, t('block.translateCsv'), t('block.translateCsv.tooltip', categories), [['text'], 'list']),
  step(JSON_TABLE, t('block.jsonTable'), t('block.jsonTable.tooltip', categories), [['json', 'list'], 'table']),
  step(GEOJSON_TABLE, t('block.geojsonTable'), t('block.geojsonTable.tooltip', categories), [['json'], 'table']),
  step(SPLIT_POSITION, t('block.split'), t('block.split.tooltip'), [['table'], 'table'], [
    { type: 'field_split_column', name: 'COLUMN', value: COORDINATES_COLUMN },
    { type: 'field_input', name: 'FIRST', text: 'lon', spellcheck: false },
    { type: 'field_input', name: 'SECOND', text: 'lat', spellcheck: false },
  ]),
  step(CONVERT_COLUMN, t('block.convert'), t('block.convert.tooltip'), [['table'], 'table'], [
    { type: 'field_column', name: 'COLUMN', value: 'value' },
    {
      type: 'field_dropdown',
      name: 'TO',
      options: [
        [t('block.convert.number'), 'number'],
        [t('block.convert.date'), 'date'],
        [t('block.convert.text'), 'text'],
      ],
    },
  ]),
])

pythonGenerator.forBlock[READ_JSON] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import json')
  return `${name} = json.loads(${name})\n`
}

pythonGenerator.forBlock[TRANSLATE_CSV] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import io', 'import pandas as pd')
  // sep=None: pandas finds out itself whether the values are separated by "," or ";" (as in a German Excel).
  // decimal=",": its 12,5 becomes a number; 12.5 still does, too (pandas' Python reader takes both).
  // pandas also finds which columns are numbers; to_dict("records") then makes the list of entries
  // that "mache eine Tabelle aus der Liste" takes, as for JSON.
  return (
    `# ${t('code.translateCsv')}\n` +
    `${name} = pd.read_csv(io.StringIO(${name}), sep=None, engine="python", decimal=",").to_dict("records")\n`
  )
}

pythonGenerator.forBlock[JSON_TABLE] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import pandas as pd')
  // Each entry of the list (from JSON or CSV) becomes a row; entries inside entries become columns like "ort.name".
  return `${name} = pd.json_normalize(${name})\n`
}


pythonGenerator.forBlock[GEOJSON_TABLE] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import pandas as pd')
  // GeoJSON is JSON with rules for maps, translated by "übersetze den JSON-Text": a list "features"
  // of objects, each with its details ("properties") and its shape ("geometry"). The shape stays
  // whole, so lines and areas survive.
  return (
    `objekte = ${name}["features"]\n` +
    `${name} = pd.json_normalize([objekt["properties"] or {} for objekt in objekte])\n` +
    `${name}["${SHAPE_COLUMN}"] = [objekt["geometry"] for objekt in objekte]\n`
  )
}

pythonGenerator.forBlock[SPLIT_POSITION] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  const column = quoted(String(block.getFieldValue('COLUMN')))
  const first = String(block.getFieldValue('FIRST') ?? '').trim()
  const second = String(block.getFieldValue('SECOND') ?? '').trim()
  const named = first !== '' && second !== '' && first !== second
  block.setWarningText(named ? null : t('block.split.names'), 'names')
  if (!named) return ''
  needs(generator, 'from spockly import in_teile')
  // A position is a list [longitude, latitude] (GeoJSON order), sometimes with the height third;
  // in_teile also splits text like "51.96, 7.62".
  return (
    `# ${t('code.split')}\n` +
    `teile = ${name}[${column}].map(in_teile)\n` +
    `${name}[${quoted(first)}] = teile.str[0]\n` +
    `${name}[${quoted(second)}] = teile.str[1]\n`
  )
}

pythonGenerator.forBlock[CONVERT_COLUMN] = (block, generator) => {
  const name = variableFor(block)
  if (!name) return ''
  needs(generator, 'import pandas as pd')
  const column = `${name}[${quoted(String(block.getFieldValue('COLUMN')))}]`
  const to = String(block.getFieldValue('TO'))
  if (to === 'date') return `${column} = pd.to_datetime(${column}, utc=True, errors="coerce")\n`
  if (to === 'text') return `${column} = ${column}.astype(str)\n`
  return `${column} = pd.to_numeric(${column}, errors="coerce")\n`
}
