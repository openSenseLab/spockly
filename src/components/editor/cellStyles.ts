import type { CellType } from '../../journal/types'

/** Colour language per block type, shared by cells, menus and the viewer. */
export const CELL_STYLES: Record<CellType, { tile: string; accent: string }> = {
  text: { tile: 'bg-ink-100 text-ink-600', accent: 'text-ink-600' },
  data: { tile: 'bg-data-50 text-data-600 ring-1 ring-inset ring-data-100', accent: 'text-data-700' },
  analysis: { tile: 'bg-analysis-50 text-analysis-600 ring-1 ring-inset ring-analysis-100', accent: 'text-analysis-700' },
}
