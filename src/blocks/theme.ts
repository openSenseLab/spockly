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
    predict_blocks: {
      colourPrimary: '#7c3aed',
      colourSecondary: '#a78bfa',
      colourTertiary: '#5b21b6',
      hat: '',
    },
  },
  categoryStyles: {
    load_category: { colour: '#0e7490' },
    predict_category: { colour: '#7c3aed' },
  },
})
