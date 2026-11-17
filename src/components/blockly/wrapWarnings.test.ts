import { describe, expect, it } from 'vitest'

import { wrapText } from './wrapWarnings'

describe('wrapText', () => {
  it('breaks a long warning into lines at spaces, keeping every word', () => {
    const text = 'Dieser Block fragt für jeden Sensor nach seinen Messwerten und braucht darum eine Zeile pro Sensor.'
    const lines = wrapText(text, 30).split('\n')
    expect(lines.every((line) => line.length <= 30)).toBe(true)
    expect(lines.join(' ')).toBe(text)
  })

  it('keeps short texts, own line breaks, and words longer than a line', () => {
    expect(wrapText('kurz')).toBe('kurz')
    expect(wrapText('eins\nzwei', 30)).toBe('eins\nzwei')
    expect(wrapText('a 625c512a18aca4001cadae87 b', 10)).toBe('a\n625c512a18aca4001cadae87\nb')
  })
})
