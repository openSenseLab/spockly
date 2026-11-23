import { ArrowDown, ArrowUp, ChartColumn, Copy, Database, Ellipsis, Play, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { useT } from '../../i18n'
import { runCell } from '../../journal/runner'
import { useJournalStore } from '../../journal/store'
import type { CellType, RunState } from '../../journal/types'
import { ErrorMessage } from '../ErrorMessage'
import { Button, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from '../ui'
import { cardClass, cn } from '../ui/styles'
import { CELL_STYLES } from './cellStyles'

type Props = {
  id: string
  type: CellType
  index: number
  /** Editable title (block cells). Text cells have none and show their toolbar on hover only. */
  title?: ReactNode
  /** Extra icon buttons shown before Run. */
  actions?: ReactNode
  children: ReactNode
}

const STATUS: Record<RunState['status'], string> = {
  idle: 'bg-ink-300',
  stale: 'bg-amber-400',
  running: 'bg-brand-500 status-pulse',
  done: 'bg-leaf-500',
  error: 'bg-red-500',
}

function CellMenu({ id, index }: { id: string; index: number }) {
  const t = useT()
  const total = useJournalStore((state) => state.journal.cells.length)
  const moveCell = useJournalStore((state) => state.moveCell)
  const removeCell = useJournalStore((state) => state.removeCell)
  const duplicateCell = useJournalStore((state) => state.duplicateCell)
  const duplicate = () => {
    const copy = duplicateCell(id)
    if (copy) requestAnimationFrame(() => document.getElementById(`cell-${copy}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  return (
    <Menu>
      <MenuTrigger>
        <IconButton label={t.cells.more}>
          <Ellipsis />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <MenuItem disabled={index === 0} onSelect={() => moveCell(id, -1)}>
          <ArrowUp /> {t.cells.moveUp}
        </MenuItem>
        <MenuItem disabled={index === total - 1} onSelect={() => moveCell(id, 1)}>
          <ArrowDown /> {t.cells.moveDown}
        </MenuItem>
        <MenuItem onSelect={duplicate}>
          <Copy /> {t.cells.duplicate}
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={() => window.confirm(t.cells.deleteConfirm) && removeCell(id)}>
          <Trash2 /> {t.cells.delete}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export function CellShell({ id, type, index, title, actions, children }: Props) {
  const t = useT()
  const runState = useJournalStore((state) => state.runStates[id])
  const status = runState?.status ?? 'idle'

  if (type === 'text') {
    return (
      <section id={`cell-${id}`} className="group relative scroll-mt-24">
        <div className="absolute -top-1 right-0 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CellMenu id={id} index={index} />
        </div>
        {children}
      </section>
    )
  }

  return (
    <section id={`cell-${id}`} className={cn(cardClass, 'scroll-mt-24 overflow-hidden')}>
      <header className="flex items-center gap-2.5 border-b border-ink-100 px-3 py-2.5 sm:px-4">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4', CELL_STYLES[type].tile)}>
          {type === 'data' ? <Database /> : <ChartColumn />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[11px] font-semibold tracking-wide uppercase', CELL_STYLES[type].accent)}>{t.cells[type].label}</p>
          {title}
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-ink-500 sm:inline-flex">
          <span className={cn('status-dot', STATUS[status])} />
          {t.run.status[status]}
        </span>
        {actions}
        <Tooltip content={t.run.runHint}>
          <Button variant="soft" size="sm" loading={status === 'running'} onClick={() => void runCell(id)}>
            {status !== 'running' && <Play />} {t.run.run}
          </Button>
        </Tooltip>
        <CellMenu id={id} index={index} />
      </header>
      <div className="flex flex-col gap-5 p-3 sm:p-4">{children}</div>
      {runState?.status === 'error' && runState.error && (
        <div className="px-3 pb-4 sm:px-4">
          <ErrorMessage message={runState.error} />
        </div>
      )}
    </section>
  )
}
