import * as Blockly from 'blockly'

/** Zelos plus SPOCKLY's block styles: one colour per kind of block. */
export const spocklyTheme = Blockly.Theme.defineTheme('spockly', {
  name: 'spockly',
  base: Blockly.Themes.Zelos,
  blockStyles: {
    dataset_blocks: { colourPrimary: '#334155', colourSecondary: '#64748b', colourTertiary: '#1e293b', hat: 'cap' },
    osem_blocks: { colourPrimary: '#0e7490', colourSecondary: '#22d3ee', colourTertiary: '#155e75', hat: '' },
    file_blocks: { colourPrimary: '#6d28d9', colourSecondary: '#a78bfa', colourTertiary: '#4c1d95', hat: '' },
    step_blocks: { colourPrimary: '#4d7c0f', colourSecondary: '#84cc16', colourTertiary: '#365314', hat: '' },
    view_blocks: { colourPrimary: '#b45309', colourSecondary: '#f59e0b', colourTertiary: '#78350f', hat: '' },
  },
  categoryStyles: {
    dataset_category: { colour: '#334155' },
    osem_category: { colour: '#0e7490' },
    file_category: { colour: '#6d28d9' },
    step_category: { colour: '#4d7c0f' },
    view_category: { colour: '#b45309' },
  },
})
