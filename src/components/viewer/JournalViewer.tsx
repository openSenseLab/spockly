import { ArrowLeft, Blocks, ChevronDown, PenLine, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { BlocklyEditor } from '../../blockly/BlocklyEditor'
import { useLanguageStore, useT } from '../../i18n'
import { renderMarkdown } from '../../journal/markdown'
import type { CellOutput, PublishedCell, PublishedJournal } from '../../journal/types'
import { AppHeader } from '../AppHeader'
import { DatasetHeader } from '../inspect/DatasetHeader'
import { InspectionPanel } from '../inspect/InspectionPanel'
import { LanguageSwitch } from '../LanguageSwitch'
import { OutputView } from '../outputs/OutputView'
import { Badge, Button } from '../ui'
import { buttonClass, cardClass, cn } from '../ui/styles'

type Inspection = Extract<CellOutput, { type: 'inspection' }>

function Note({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="mt-4 flex gap-3 rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-100">
      <PenLine className="mt-1 size-4 shrink-0 text-amber-500" />
      {/* renderMarkdown escapes all input before adding its own tags. */}
      <div className="prose text-ink-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
    </div>
  )
}

function ViewerDataset({ output }: { output: Inspection }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-data-50/60 p-4 ring-1 ring-data-100">
      <DatasetHeader
        output={output}
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? t.viewer.hideData : t.viewer.showData}
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        }
      />
      {open && (
        <div className="mt-2 rounded-xl bg-white p-4 ring-1 ring-ink-200">
          <InspectionPanel profile={output.profile} />
        </div>
      )}
    </div>
  )
}

function ViewerCell({ cell }: { cell: PublishedCell }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const [showBlocks, setShowBlocks] = useState(false)

  if (cell.type === 'text') {
    // renderMarkdown escapes all input before adding its own tags.
    return <div className="prose text-[1.08rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.markdown) }} />
  }

  const inspections = cell.outputs.filter((output): output is Inspection => output.type === 'inspection')
  const others = cell.outputs.filter((output) => output.type !== 'inspection')

  return (
    <section>
      {cell.type === 'analysis' && cell.title && <h3 className="mb-4 text-xl font-semibold tracking-tight text-ink-900">{cell.title}</h3>}
      {inspections.length > 0 && (
        <div className="space-y-3">
          {inspections.map((output) => (
            <ViewerDataset key={output.profile.name} output={output} />
          ))}
        </div>
      )}
      {others.length > 0 && <OutputView outputs={others} />}
      {cell.outputs.length === 0 && <p className="text-sm text-ink-500 italic">{t.viewer.noOutputs}</p>}
      <Note text={cell.note} />
      {cell.type === 'analysis' && cell.workspace && (
        <div className="mt-3">
          <Button variant="ghost" size="sm" className="-ml-2 text-ink-500" onClick={() => setShowBlocks(!showBlocks)} aria-expanded={showBlocks}>
            <Blocks /> {showBlocks ? t.viewer.hideBlocks : t.viewer.showBlocks}
          </Button>
          {showBlocks && (
            <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-ink-200">
              <BlocklyEditor key={language} initialState={cell.workspace} readOnly />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

type Props = {
  journal: PublishedJournal
  /** Shown in preview mode (editor → reader). */
  onBack?: () => void
}

export function JournalViewer({ journal, onBack }: Props) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const date = new Date(journal.publishedAt).toLocaleDateString(language, { dateStyle: 'long' })

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        left={onBack && <Badge tone="amber">{t.viewer.previewBadge}</Badge>}
        right={
          <>
            {onBack ? (
              <Button size="sm" onClick={onBack}>
                <ArrowLeft /> {t.viewer.backToEditor}
              </Button>
            ) : (
              <a href={`${import.meta.env.BASE_URL}#/`} className={buttonClass({ variant: 'soft', size: 'sm' })}>
                <Sparkles /> {t.viewer.createOwn}
              </a>
            )}
            <LanguageSwitch />
          </>
        }
      />

      <header className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-br from-brand-50 via-white to-leaf-50">
        <div
          className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--color-brand-200)_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 sm:py-20" lang={journal.language}>
          <h1 className="text-4xl font-bold tracking-tight text-balance text-ink-900 sm:text-5xl">{journal.title}</h1>
          {journal.subtitle && <p className="mt-4 text-xl text-balance text-ink-600">{journal.subtitle}</p>}
          <p className="mt-6 text-sm font-medium text-ink-500">{[journal.author, date].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12" lang={journal.language}>
        {journal.cells.map((cell, index) => (
          <ViewerCell key={index} cell={cell} />
        ))}
        <footer className={cn(cardClass, 'mt-6 flex items-center gap-3 bg-ink-50 p-4 text-sm text-ink-500 shadow-none')}>
          <Blocks className="size-4 text-brand-500" /> {t.viewer.footer}
        </footer>
      </article>
    </div>
  )
}
