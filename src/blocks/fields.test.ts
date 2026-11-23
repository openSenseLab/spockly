// @vitest-environment jsdom
import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import { useAppStore } from '../store/useAppStore'
import { colourColumnsFor, columnsFor, groupColumnsFor, NO_COLUMN, refreshFieldLabels, splitColumnsFor, timeColumnsFor, valueColumnsFor } from './fields'
import { generate } from './index'

function program() {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'spockly_dataset',
            fields: { NAME: 'sensoren' },
            inputs: { STEPS: { block: { type: 'osem_boxes', next: { block: { type: 'step_read_json', next: { block: { type: 'osem_table', id: 'tabelle', next: { block: { type: 'step_split_position', id: 'lage' } } } } } } } } },
          },
        ],
      },
    },
    workspace,
  )
  return workspace.getBlockById('lage')
}

describe('the colour column of "zeige … auf der Karte"', () => {
  function map(colour: string) {
    const workspace = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: 'spockly_dataset', fields: { NAME: 'messwerte' }, inputs: { STEPS: { block: { type: 'osem_measurements', id: 'zahl' } } } },
            { type: 'view_map', id: 'karte', fields: { DATASET: 'messwerte', LAT: 'lat', LON: 'lon', COLOUR: colour } },
          ],
        },
      },
      workspace,
    )
    return workspace
  }

  it('offers number columns only, not the position, and "no column"', () => {
    useAppStore.getState().setSnapshots({
      zahl: {
        art: 'tabelle',
        spalten: ['sensor_id', 'sensor_icon', 'station_exposure', 'value', 'hoehe', 'lat', 'lon'],
        typen: { sensor_id: 'object', sensor_icon: 'object', station_exposure: 'object', value: 'float64', hoehe: 'int64', lat: 'float64', lon: 'float64' },
        zeilen: [],
        anzahl: 0,
      },
    })
    const block = map('value').getBlockById('karte')
    expect(colourColumnsFor(block)).toEqual(['value', 'hoehe'])
    const options = (block!.getField('COLOUR') as Blockly.FieldDropdown).getOptions(false).map(([label]) => label)
    expect(options).toEqual(['value', 'hoehe', 'keiner Spalte (alle gleich)'])
  })

  it('marks a chosen column as missing once a run showed it isn\'t there, not before', () => {
    useAppStore.getState().setSnapshots({})
    const workspace = map('value')
    const field = workspace.getBlockById('karte')!.getField('COLOUR') as Blockly.FieldDropdown
    expect(field.getText()).toBe('value')
    useAppStore.getState().setSnapshots({
      zahl: { art: 'tabelle', spalten: ['station_name', 'lat', 'lon'], typen: { lat: 'float64', lon: 'float64' }, zeilen: [], anzahl: 0 },
    })
    refreshFieldLabels(workspace)
    expect(field.getText()).toBe('value – fehlt')
    expect(field.getValue()).toBe('value')
  })

  it('starts with "no column": not every dataset has numbers to colour by', () => {
    const workspace = new Blockly.Workspace()
    expect(workspace.newBlock('view_map').getFieldValue('COLOUR')).toBe(NO_COLUMN)
  })

  it('colours all points alike with "no column"', () => {
    expect(generate(map('value')).shown).toContain('farbe="value"')
    expect(generate(map(NO_COLUMN)).shown).toContain('farbe=None')
  })
})

describe('the column of "teile die Spalte … auf"', () => {
  it('offers only columns whose values have several parts: lists, or text with a comma or semicolon', () => {
    useAppStore.getState().setSnapshots({
      tabelle: {
        art: 'tabelle',
        spalten: ['station_id', 'station_name', 'sensors', 'koordinaten', 'hoehe', 'lage', 'ort'],
        typen: {},
        zeilen: [
          ['a1', 'Dach', [{ title: 'Temperatur' }], [7.62, 51.96], 60, '51.96, 7.62', 'Münster; NRW'],
          ['b2', 'Garten', [], [7.6, 51.95, 58.5], null, '51.95, 7.6', 'Telgte; NRW'],
          ['c3', 'Schule', [], null, 55, null, 'Greven'],
        ],
        anzahl: 3,
      },
    })
    const block = program()
    expect(columnsFor(block)).toHaveLength(7)
    // Not the list of sensors: its parts are objects. Not "ort": "Greven" has one part only.
    expect(splitColumnsFor(block)).toEqual(['koordinaten', 'lage'])
  })

  it('says when the table has nothing to split, apart from "run first"', () => {
    useAppStore.getState().setSnapshots({ tabelle: { art: 'tabelle', spalten: ['ort'], typen: {}, zeilen: [['Münster']], anzahl: 1 } })
    const field = program()!.getField('COLUMN') as Blockly.FieldDropdown
    field.setValue('')
    expect(field.getOptions(false)[0][0]).toBe('– keine Spalte mit mehreren Teilen –')
    useAppStore.getState().setSnapshots({})
    expect(field.getOptions(false)[0][0]).toBe('– erst ausführen –')
  })
})

describe('the columns of "zeige … als Zeitverlauf"', () => {
  function chart(group: string) {
    const workspace = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: 'spockly_dataset', fields: { NAME: 'messwerte' }, inputs: { STEPS: { block: { type: 'osem_measurements', id: 'datum' } } } },
            { type: 'view_chart', id: 'verlauf', fields: { DATASET: 'messwerte', TIME: 'createdAt', VALUE: 'value', GROUP: group } },
          ],
        },
      },
      workspace,
    )
    return workspace
  }

  it('offers dates for the time, numbers for the value, repeating short names for the lines', () => {
    useAppStore.getState().setSnapshots({
      datum: {
        art: 'tabelle',
        spalten: ['createdAt', 'station_lastMeasurementAt', 'value', 'lat', 'station_name', 'sensor_title', 'description', 'image', 'koordinaten', 'sensor_id'],
        typen: { createdAt: 'datetime64[ns, UTC]', station_lastMeasurementAt: 'object', value: 'float64', lat: 'float64' },
        zeilen: [
          ['2026-11-10T10:00:00Z', '2026-11-11T09:00:00Z', 7.5, 51.9, 'Dach', 'Temperatur', 'Eine Station auf dem Dach unserer Schule, gebaut von der 9b.', 'https://example.org/a.png', [7.6, 51.9], 'a1'],
          ['2026-11-10T10:05:00Z', '2026-11-11T09:00:00Z', 7.6, 51.9, 'Dach', 'Temperatur', 'Eine Station auf dem Dach unserer Schule, gebaut von der 9b.', 'https://example.org/a.png', [7.6, 51.9], 'a2'],
        ],
        anzahl: 2,
      },
    })
    const block = chart('station_name').getBlockById('verlauf')
    expect(timeColumnsFor(block)).toEqual(['createdAt'])
    expect(valueColumnsFor(block)).toEqual(['value', 'lat'])
    // Not the description or the link (long, though repeating), not a date as text, not the id (never repeats).
    expect(groupColumnsFor(block)).toEqual(['station_name', 'sensor_title'])
    const options = (block!.getField('GROUP') as Blockly.FieldDropdown).getOptions(false).map(([label]) => label)
    expect(options.at(-1)).toBe('nichts (eine Linie)')
  })

  it('judges the groups by all rows, not the first: a column with one value everywhere is no group', () => {
    useAppStore.getState().setSnapshots({
      datum: {
        art: 'tabelle',
        spalten: ['station_name', 'sensor_icon', 'sensor_id'],
        typen: {},
        // The first rows all come from one sensor, so everything repeats here …
        zeilen: [['Dach', 'osem-thermometer', 'a1'], ['Dach', 'osem-thermometer', 'a1']],
        anzahl: 500,
        // … but in all rows: 7 stations, one icon, 500 different ids.
        verschieden: { station_name: 7, sensor_icon: 1, sensor_id: 500 },
      },
    })
    expect(groupColumnsFor(chart('station_name').getBlockById('verlauf'))).toEqual(['station_name'])
  })

  it('draws one line for all rows with "nothing"', () => {
    expect(generate(chart('station_name')).shown).toContain('je="station_name"')
    expect(generate(chart(NO_COLUMN)).shown).toContain('je=None')
  })
})

describe('ticking columns for "zeige … beim Darüberfahren mit der Maus"', () => {
  function map() {
    const workspace = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: 'spockly_dataset', fields: { NAME: 'messwerte' }, inputs: { STEPS: { block: { type: 'osem_measurements', id: 'zahl' } } } },
            { type: 'view_map', id: 'karte', y: 200, fields: { DATASET: 'messwerte', LAT: 'lat', LON: 'lon', COLOUR: '' } },
          ],
        },
      },
      workspace,
    )
    return workspace.getBlockById('karte')!
  }

  it('ticks and unticks one column per choice, and the map gets them as info=[…]', () => {
    useAppStore.getState().setSnapshots({
      zahl: { art: 'tabelle', spalten: ['sensor_title', 'station_name', 'lat', 'lon'], typen: {}, zeilen: [], anzahl: 0 },
    })
    const block = map()
    const field = block.getField('INFO') as Blockly.FieldDropdown
    expect(generate(block.workspace).shown).toContain('zeige_karte(messwerte, breite="lat", laenge="lon", farbe=None, titel="messwerte")')
    const pick = (label: string) => field.setValue(field.getOptions(false).find(([text]) => typeof text === 'string' && text.endsWith(label))![1])
    pick('sensor_title')
    pick('station_name')
    expect(field.getText()).toBe('sensor_title, station_name')
    expect(field.getOptions(false).map(([text]) => text)).toContain('☑ sensor_title')
    expect(generate(block.workspace).shown).toContain('titel="messwerte", info=["sensor_title", "station_name"])')
    pick('sensor_title')
    expect(field.getText()).toBe('station_name')
  })

  it('keeps the choice in a saved program', () => {
    useAppStore.getState().setSnapshots({})
    const block = map()
    block.setFieldValue('["station_name"]', 'INFO')
    const saved = Blockly.serialization.workspaces.save(block.workspace)
    const again = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(saved, again)
    expect(again.getBlockById('karte')!.getField('INFO')!.getText()).toBe('station_name')
  })
})
