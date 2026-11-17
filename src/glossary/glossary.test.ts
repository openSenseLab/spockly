import { describe, expect, it } from 'vitest'

import { GLOSSARY } from './entries'
import { glossaryFor, glossaryForColumn } from './index'

describe('glossaryFor', () => {
  it.each([
    ['Temperatur', 'temperature'],
    ['Temperature', 'temperature'],
    ['rel. Luftfeuchte', 'humidity'],
    ['Rel. Humidity', 'humidity'],
    ['Luftdruck', 'pressure'],
    ['PM10', 'pm10'],
    ['Finedust PM10', 'pm10'],
    ['PM2.5', 'pm25'],
    ['Finedust PM2.5', 'pm25'],
    ['Finedust PM1', 'pm1'],
    ['UV-Index', 'uv-index'],
    ['UV-Intensität', 'uv-intensity'],
    ['Beleuchtungsstärke', 'illuminance'],
    ['Lautstärke', 'noise'],
    ['Windgeschwindigkeit', 'wind'],
    ['  temperatur ', 'temperature'],
    // Other spellings seen on openSenseMap around Münster (October 2026)
    ['relative Luftfeuchtigkeit', 'humidity'],
    ['rel. Luftfeuchtigkeit', 'humidity'],
    ['relative_humidity', 'humidity'],
    ['atmospheric_pressure', 'pressure'],
    ['wind_speed', 'wind'],
    ['Lautstärke (LEQ 60s)', 'noise'],
    ['PM25', 'pm25'],
  ])('%s → %s', (name, id) => {
    expect(glossaryFor(name)?.id).toBe(id)
  })

  it('matches whole names only, so soil temperature is not explained as air temperature', () => {
    expect(glossaryFor('Bodentemperatur')).toBeUndefined()
    expect(glossaryFor('Overtaking Distance')).toBeUndefined()
    // Different quantities with similar names: no (wrong) explanation
    expect(glossaryFor('Windböen')).toBeUndefined()
    expect(glossaryFor('rain_rate')).toBeUndefined()
    expect(glossaryFor('solar_irradiance')).toBeUndefined()
  })

  it('finds NASA POWER codes', () => {
    expect(glossaryFor('T2M_MAX')?.id).toBe('temperature')
    expect(glossaryFor('ALLSKY_SFC_SW_DWN')?.id).toBe('solar')
    expect(glossaryFor('PS')?.id).toBe('pressure')
  })
})

describe('glossaryForColumn', () => {
  it('uses the label when the column name is not known', () => {
    const column = { name: 'rel_luftfeuchte', label: { de: 'rel. Luftfeuchte' }, dataType: 'number', semanticType: 'measurement' } as const
    expect(glossaryForColumn(column)?.id).toBe('humidity')
  })
})

describe('entries', () => {
  it('have German and English texts, and a source for every reference value', () => {
    for (const entry of GLOSSARY) {
      expect(entry.explanation.de && entry.explanation.en, entry.id).toBeTruthy()
      if (entry.reference) {
        expect(entry.reference.de && entry.reference.en, entry.id).toBeTruthy()
        expect(entry.sources.length, `${entry.id} has a reference value without a source`).toBeGreaterThan(0)
      }
      if (entry.hint) expect(entry.reference, `${entry.id} has a hint without a reference`).toBeDefined()
      for (const source of entry.sources) expect(source.url).toMatch(/^https:\/\//)
    }
  })

  it('give each name to only one entry', () => {
    const names = GLOSSARY.flatMap((e) => e.names.map((n) => n.toLowerCase()))
    expect(new Set(names).size).toBe(names.length)
  })
})
