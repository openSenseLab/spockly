import { getMessages, useLanguageStore } from '../i18n'
import { createCell, newId } from './store'
import type { BlockCell, Cell, Journal } from './types'
import { loadExample, loadWorkspace, pipelineWorkspace } from './workspaces'

const blockCell = (type: 'data' | 'analysis', title: string, workspace: object): BlockCell => ({
  ...(createCell(type) as BlockCell),
  title,
  workspace,
})

const text = (markdown: string): Cell => ({ id: newId(), type: 'text', markdown })

/** A complete small journal that demonstrates the whole workflow in the active language. */
export const createExampleJournal = async (): Promise<Journal> => {
  const t = getMessages().example
  return {
    id: newId(),
    title: t.title,
    subtitle: t.subtitle,
    author: '',
    language: useLanguageStore.getState().language,
    updatedAt: new Date().toISOString(),
    files: {},
    cells: [
      text(t.intro),
      blockCell('data', t.stationsTitle, loadWorkspace([loadExample('stations')])),
      text(t.afterInspection),
      blockCell(
        'analysis',
        t.byTypeTitle,
        pipelineWorkspace('stations', [
          { type: 'spk_group', fields: { BY: 'type', AGG: 'mean', COLUMN: 'pm10' } },
          { type: 'spk_round', fields: { COLUMN: 'mean_pm10', DIGITS: 1 } },
          { type: 'spk_sort', fields: { COLUMN: 'mean_pm10', DIR: 'desc' } },
          { type: 'spk_show_chart', fields: { KIND: 'bar', X: 'type', Y: 'mean_pm10', COLOR: '', TITLE: t.byTypeChart } },
        ]),
      ),
      blockCell(
        'analysis',
        t.mapTitle,
        pipelineWorkspace('stations', [
          { type: 'spk_drop_missing', fields: { COLUMN: 'pm10' } },
          { type: 'spk_show_map', fields: { COLOR: 'pm10', TITLE: t.mapChart } },
          { type: 'spk_show_stat', fields: { AGG: 'mean', COLUMN: 'pm10', LABEL: t.meanLabel } },
        ]),
      ),
      text(t.zonesIntro),
      blockCell('data', t.zonesDataTitle, loadWorkspace([loadExample('zones')])),
      blockCell(
        'analysis',
        t.zonesTitle,
        pipelineWorkspace('zones', [
          { type: 'spk_count_within', fields: { NAME: 'stations', DATASET: 'stations' } },
          { type: 'spk_aggregate_within', fields: { NAME: 'mean_pm10', DATASET: 'stations', AGG: 'mean', COLUMN: 'pm10' } },
          { type: 'spk_round', fields: { COLUMN: 'mean_pm10', DIGITS: 1 } },
          {
            type: 'spk_map',
            fields: { TITLE: t.zonesChart, BASEMAP: 'light' },
            inputs: {
              LAYERS: {
                block: {
                  type: 'spk_map_layer',
                  fields: { DATASET: '', STYLE: 'areas', COLOR: 'mean_pm10', SIZE: '', LABEL: 'zone' },
                  next: {
                    block: {
                      type: 'spk_map_layer',
                      fields: { DATASET: 'stations', STYLE: 'bubbles', COLOR: '', SIZE: 'pm10', LABEL: '' },
                    },
                  },
                },
              },
            },
          },
          { type: 'spk_show_table', fields: { TITLE: '' } },
        ]),
      ),
      blockCell(
        'analysis',
        t.densityTitle,
        pipelineWorkspace('stations', [
          { type: 'spk_grid', fields: { SHAPE: 'hexagon', KM: 3 } },
          {
            type: 'spk_map',
            fields: { TITLE: t.densityChart, BASEMAP: 'light' },
            inputs: {
              LAYERS: { block: { type: 'spk_map_layer', fields: { DATASET: '', STYLE: 'areas', COLOR: 'count', SIZE: '', LABEL: '' } } },
            },
          },
        ]),
      ),
      text(t.conclusion),
    ],
  }
}
