import { describe, expect, it } from 'vitest'

import { toPythonName, uniqueNames } from './names'

describe('toPythonName', () => {
  it.each([
    ['georef-germany-land', 'georef_germany_land'],
    ['Temperatur muenster-mitte', 'temperatur_muenster_mitte'],
    ['rel. Luftfeuchte Smart City MS', 'rel_luftfeuchte_smart_city_ms'],
    ['Bodentemperatur Münster', 'bodentemperatur_muenster'],
    ['PM2.5 Straße', 'pm2_5_strasse'],
    ['2025-messungen', 'daten_2025_messungen'],
    ['class', 'class_'],
    ['???', 'daten'],
  ])('%s → %s', (text, expected) => {
    expect(toPythonName(text)).toBe(expected)
  })

  it('shortens long names at a word boundary', () => {
    const name = toPythonName('Beleuchtungsstärke Gruppe eines sehr langen Schulprojekts in Münster')
    expect(name.length).toBeLessThanOrEqual(40)
    expect(name.endsWith('_')).toBe(false)
  })
})

describe('uniqueNames', () => {
  it('numbers repeated names in order, keeping the first as it is', () => {
    expect(uniqueNames(['a', 'b', 'a', 'a'])).toEqual(['a', 'b', 'a_2', 'a_3'])
  })

  it('does not collide with a name that already ends in a number', () => {
    expect(uniqueNames(['a_2', 'a', 'a'])).toEqual(['a_2', 'a', 'a_3'])
  })
})
