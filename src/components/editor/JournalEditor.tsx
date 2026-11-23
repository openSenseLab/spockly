import { ChartColumn, Database, Eye, FastForward, FlaskConical, Plus, Share2, Square, Type, UserRound } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'

import { useT } from '../../i18n'
import { createExampleJournal } from '../../journal/exampleJournal'
import { runAll } from '../../journal/runner'
import { createJournal, useJournalStore } from '../../journal/store'
import type { CellType, Journal } from '../../journal/types'
import { resetKernel, restartKernel, warmUpKernel } from '../../kernel/kernel'
import { AppHeader } from '../AppHeader'
import { KernelDot } from '../KernelDot'
import { LanguageSwitch } from '../LanguageSwitch'
import { ModeSwitch } from '../ModeSwitch'
import { LabToJournalDialog } from '../../lab/LabToJournalDialog'
import { scrollToCell } from '../../journal/scroll'
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from '../ui'
import { buttonClass, cn } from '../ui/styles'
import { BlockCell } from './BlockCell'
import { CELL_STYLES } from './cellStyles'
import { JournalMenu } from './JournalMenu'
import { ShareDialog } from './ShareDialog'
import { TextCell } from './TextCell'
import { WorkflowStepper } from './WorkflowStepper'

const CELL_ICONS: Record<CellType, ReactNode> = {
  text: <Type />,
  data: <Database />,
  analysis: <ChartColumn />,
}

const useAddCell = () => {
  const addCell = useJournalStore((state) => state.addCell)
  return (type: CellType, index: number) => {
    const id = addCell(type, index)
    requestAnimationFrame(() =>
      document.getElementById(`cell-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }
}

type ImportFromLab = (index: number) => void

/** Small "+" between cells, visible on hover. */
function InsertCell({ index, onImport }: { index: number; onImport: ImportFromLab }) {
  const t = useT()
  const add = useAddCell()
  return (
    <div className="group relative flex h-8 items-center justify-center">
      <div className="absolute inset-x-6 top-1/2 h-px bg-brand-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
      <Menu>
        <MenuTrigger>
          <button
            type="button"
            aria-label={t.cells.add}
            className="relative grid size-6 cursor-pointer place-items-center rounded-full bg-white text-brand-600 opacity-0 shadow-sm ring-1 ring-brand-200 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <Plus className="size-3.5" />
          </button>
        </MenuTrigger>
        <MenuContent align="center">
          {(['text', 'data', 'analysis'] as const).map((type) => (
            <MenuItem key={type} onSelect={() => add(type, index)}>
              <span className={cn('grid size-7 place-items-center rounded-md [&>svg]:size-4', CELL_STYLES[type].tile)}>
                {CELL_ICONS[type]}
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-ink-800">{t.cells[type].label}</span>
                <span className="text-xs text-ink-500">{t.cells[type].description}</span>
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => onImport(index)}>
            <span className="grid size-7 place-items-center rounded-md bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-100 [&>svg]:size-4">
              <FlaskConical />
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-ink-800">{t.labImport.fromLab}</span>
              <span className="text-xs text-ink-500">{t.labImport.fromLabHint}</span>
            </span>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}

/** At the end of the journal: three large choices, so the next step is always obvious. */
function AddCellCards({ index, onImport }: { index: number; onImport: ImportFromLab }) {
  const t = useT()
  const add = useAddCell()
  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-sm font-medium text-ink-500">{t.cells.add}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['text', 'data', 'analysis'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type, index)}
            className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink-300 bg-white/60 p-4 text-left transition hover:border-brand-300 hover:bg-white hover:shadow-sm"
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition [&>svg]:size-5', CELL_STYLES[type].tile)}>
              {CELL_ICONS[type]}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold text-ink-800">
                <Plus className="size-3.5 text-ink-400 group-hover:text-brand-600" /> {t.cells[type].label}
              </span>
              <span className="block text-xs text-ink-500">{t.cells[type].description}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onImport(index)}
          className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink-300 bg-white/60 p-4 text-left transition hover:border-leaf-400 hover:bg-white hover:shadow-sm"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-100 [&>svg]:size-5">
            <FlaskConical />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-semibold text-ink-800">
              <Plus className="size-3.5 text-ink-400 group-hover:text-leaf-700" /> {t.labImport.fromLab}
            </span>
            <span className="block text-xs text-ink-500">{t.labImport.fromLabHint}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

/** Title, subtitle and author edited in place, styled like the published heading. */
function JournalHeader() {
  const t = useT()
  const journal = useJournalStore((state) => state.journal)
  const setMeta = useJournalStore((state) => state.setMeta)
  const field = 'w-full rounded-lg bg-transparent px-2 -mx-2 outline-none transition placeholder:text-ink-400 hover:bg-ink-100/70 focus:bg-white focus:ring-2 focus:ring-brand-200'
  return (
    <section className="space-y-1">
      <input
        className={cn(field, 'py-1 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl')}
        value={journal.title}
        onChange={(event) => setMeta({ title: event.target.value })}
        placeholder={t.journal.titlePlaceholder}
        aria-label={t.journal.titlePlaceholder}
      />
      <input
        className={cn(field, 'py-1 text-lg text-ink-500')}
        value={journal.subtitle}
        onChange={(event) => setMeta({ subtitle: event.target.value })}
        placeholder={t.journal.subtitlePlaceholder}
        aria-label={t.journal.subtitlePlaceholder}
      />
      <label className="flex items-center gap-1.5 text-sm text-ink-500">
        <UserRound className="size-4 shrink-0 text-ink-400" />
        <input
          className={cn(field, 'mx-0 py-0.5')}
          value={journal.author}
          onChange={(event) => setMeta({ author: event.target.value })}
          placeholder={t.journal.authorPlaceholder}
          aria-label={t.journal.authorPlaceholder}
        />
      </label>
    </section>
  )
}

export function JournalEditor() {
  const t = useT()
  const cells = useJournalStore((state) => state.journal.cells)
  const replaceJournal = useJournalStore((state) => state.replaceJournal)
  const running = useJournalStore((state) => Object.values(state.runStates).some((s) => s.status === 'running'))
  const [shareOpen, setShareOpen] = useState(false)
  const [labImportIndex, setLabImportIndex] = useState<number | null>(null)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    warmUpKernel()
  }, [])

  const open = (next: Journal) => {
    void resetKernel()
    replaceJournal(next)
    setShared(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/70 via-ink-50 to-ink-50">
      <AppHeader
        left={<ModeSwitch mode="journal" />}
        right={
          <>
            <KernelDot />
            {running ? (
              <Button variant="danger" size="sm" onClick={restartKernel}>
                <Square /> {t.run.stop}
              </Button>
            ) : (
              <Tooltip content={t.run.runAllHint}>
                <Button variant="ghost" size="sm" className="max-sm:hidden" onClick={() => void runAll()}>
                  <FastForward /> <span className="hidden md:inline">{t.run.runAll}</span>
                </Button>
              </Tooltip>
            )}
            <a href="#/preview" className={cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'max-sm:hidden')}>
              <Eye /> <span className="hidden md:inline">{t.menu.preview}</span>
            </a>
            <Button variant="primary" size="sm" onClick={() => setShareOpen(true)} aria-label={t.share.button}>
              <Share2 /> <span className="hidden sm:inline">{t.share.button}</span>
            </Button>
            <div className="hidden sm:block">
              <LanguageSwitch />
            </div>
            <JournalMenu
              onOpen={open}
              onNew={() => open(createJournal())}
              onExample={() => void createExampleJournal().then(open)}
            />
          </>
        }
      />

      <main className="mx-auto max-w-5xl px-4 pt-10 pb-32">
        <JournalHeader />
        <WorkflowStepper shared={shared} />
        <div className="mt-6">
          {cells.map((cell, index) => (
            <Fragment key={cell.id}>
              {index > 0 && <InsertCell index={index} onImport={setLabImportIndex} />}
              {cell.type === 'text' ? <TextCell cell={cell} index={index} /> : <BlockCell cell={cell} index={index} />}
            </Fragment>
          ))}
          <AddCellCards index={cells.length} onImport={setLabImportIndex} />
        </div>
      </main>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} onShared={() => setShared(true)} />
      <LabToJournalDialog
        open={labImportIndex !== null}
        index={labImportIndex ?? undefined}
        onOpenChange={(open) => !open && setLabImportIndex(null)}
        onDone={(ids) => ids[0] && scrollToCell(ids[0])}
      />
    </div>
  )
}
