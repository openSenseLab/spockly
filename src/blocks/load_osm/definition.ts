import * as Blockly from 'blockly'

import { pick, t } from '../../i18n'
import { OSM_AREA_IDS, osmArea, OSM_TOPICS } from './presets'

export const LOAD_OSM = 'load_osm'

Blockly.Msg.SPOCKLY_LOAD_OSM_TITLE = t('block.loadOsm.title')
Blockly.Msg.SPOCKLY_LOAD_OSM_TOPIC = t('block.loadOsm.topic')
Blockly.Msg.SPOCKLY_LOAD_OSM_AREA = t('block.loadOsm.area')
Blockly.Msg.SPOCKLY_LOAD_OSM_TOOLTIP = t('block.loadOsm.tooltip')

const topicOptions = OSM_TOPICS.map((topic) => [pick(topic.label) ?? topic.id, topic.id])
const areaOptions = OSM_AREA_IDS.map((id) => [pick(osmArea(id)!.label) ?? id, id])

Blockly.common.defineBlocksWithJsonArray([
  {
    type: LOAD_OSM,
    message0: '%{BKY_SPOCKLY_LOAD_OSM_TITLE}',
    message1: '%{BKY_SPOCKLY_LOAD_OSM_TOPIC} %1',
    args1: [{ type: 'field_dropdown', name: 'TOPIC', options: topicOptions }],
    message2: '%{BKY_SPOCKLY_LOAD_OSM_AREA} %1',
    args2: [{ type: 'field_dropdown', name: 'AREA', options: areaOptions }],
    // No previousStatement: this is a hat block, every strand starts with it.
    nextStatement: null,
    style: 'load_blocks',
    tooltip: '%{BKY_SPOCKLY_LOAD_OSM_TOOLTIP}',
  },
])
