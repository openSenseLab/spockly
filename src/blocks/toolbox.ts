import { t } from '../i18n'
import { LOAD_FILE } from './files'
import { OSEM_FETCH, OSEM_MEASUREMENTS, OSEM_TABLE } from './osem'
import { DATASET } from './program'
import { LOAD_URL } from './web'
import { CONVERT_COLUMN, GEOJSON_TABLE, JSON_TABLE, READ_JSON, SPLIT_POSITION, TRANSLATE_CSV } from './steps'
import { VIEW_CHART, VIEW_MAP, VIEW_SHAPES, VIEW_TABLE } from './views'

const blocks = (...types: string[]) => types.map((type) => ({ kind: 'block', type }))

/**
 * A header over blocks that do the same kind of thing. It says what they do,
 * not in which order: students find the order by trying, and when a run
 * fails, its explanation names the block that's missing.
 */
const group = (key: string, ...types: string[]) => [{ kind: 'label', text: t(key) }, ...blocks(...types)]

const category = (name: string, style: string, contents: object[]) => ({ kind: 'category', name, categorystyle: style, contents })

/**
 * The blocks students choose from: datasets, the sources with their own
 * blocks, the blocks every source uses („Allgemeine Blöcke“: translating text
 * from JSON or CSV, making tables, splitting and changing columns), and
 * showing data.
 */
export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    category(t('toolbox.dataset'), 'dataset_category', blocks(DATASET)),
    category(t('toolbox.osem'), 'osem_category', [
      ...group('toolbox.group.stations', OSEM_FETCH),
      ...group('toolbox.group.table', OSEM_TABLE),
      ...group('toolbox.group.measurements', OSEM_MEASUREMENTS),
    ]),
    // Opening a file brings text, like openSenseMap; the same generic blocks go on from there.
    category(t('toolbox.ownData'), 'file_category', group('toolbox.group.file', LOAD_FILE)),
    // A web address brings text too: a file from the internet instead of the computer.
    category(t('toolbox.web'), 'web_category', group('toolbox.group.web', LOAD_URL)),
    category(t('toolbox.general'), 'step_category', [
      ...group('toolbox.group.translate', READ_JSON, TRANSLATE_CSV),
      ...group('toolbox.group.table', JSON_TABLE, GEOJSON_TABLE),
      ...group('toolbox.group.columns', SPLIT_POSITION, CONVERT_COLUMN),
    ]),
    category(t('toolbox.views'), 'view_category', blocks(VIEW_TABLE, VIEW_MAP, VIEW_SHAPES, VIEW_CHART)),
  ],
}
