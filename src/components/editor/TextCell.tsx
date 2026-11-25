import { useState } from 'react'

import { useT } from '../../i18n'
import { renderMarkdown } from '../../journal/markdown'
import { useJournalStore } from '../../journal/store'
import type { TextCell as TextCellType } from '../../journal/types'
import { cn, inputClass } from '../ui/styles'
import { CellShell } from './CellShell'

/** Reads like the final journal; click to edit, click outside to finish. */
export function TextCell({ cell, index }: { cell: TextCellType; index: number }) {
  const t = useT()
  const setResult = useJournalStore((state) => state.setResult)
  const [editing, setEditing] = useState(!cell.markdown.trim())

  return (
    <CellShell id={cell.id} type="text" index={index}>
      {editing ? (
        <div className="py-1">
          <textarea
            autoFocus={!!cell.markdown.trim()}
            className={cn(inputClass, 'min-h-28 resize-y font-mono leading-relaxed')}
            rows={Math.min(20, Math.max(4, cell.markdown.split('\n').length + 1))}
            value={cell.markdown}
            placeholder={t.cells.text.placeholder}
            onChange={(event) => setResult(cell.id, { markdown: event.target.value })}
            onBlur={() => cell.markdown.trim() && setEditing(false)}
            aria-label={t.cells.text.label}
          />
          <p className="mt-1.5 text-xs text-ink-500">{t.cells.text.markdownHelp}</p>
        </div>
      ) : (
        <div
          className="prose -mx-3 cursor-text rounded-xl px-3 py-2 transition hover:bg-white hover:ring-1 hover:ring-ink-200"
          role="button"
          tabIndex={0}
          title={t.cells.text.clickToEdit}
          onClick={(event) => (event.target as HTMLElement).tagName !== 'A' && setEditing(true)}
          onKeyDown={(event) => event.key === 'Enter' && setEditing(true)}
          // renderMarkdown escapes all input before adding its own tags.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.markdown) }}
        />
      )}
    </CellShell>
  )
}
