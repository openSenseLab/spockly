import * as Blockly from 'blockly'

/** Zelos plus SPOCKLY block styles. Load blocks get a hat: they start a strand. */
export const spocklyTheme = Blockly.Theme.defineTheme('spockly', {
  name: 'spockly',
  base: Blockly.Themes.Zelos,
  blockStyles: {
    load_blocks: {
      colourPrimary: '#0e7490',
      colourSecondary: '#22d3ee',
      colourTertiary: '#155e75',
      hat: 'cap',
    },
  },
  categoryStyles: {
    load_category: { colour: '#0e7490' },
  },
})
