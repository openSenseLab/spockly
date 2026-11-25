import { ChartColumn, Check, Database, Lightbulb, PenLine, Search, Share2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { useT } from '../../i18n'
import { buildQuestions } from '../../journal/inspection'
import { useJournalStore } from '../../journal/store'
import type { Cell, CellOutput } from '../../journal/types'
import { cardClass, cn } from '../ui/styles'

type Step = 'data' | 'inspect' | 'analyse' | 'story' | 'share'
const STEPS: Step[] = ['data', 'inspect', 'analyse', 'story', 'share']

type Inspection = Extract<CellOutput, { type: 'inspection' }>

/** Derive the learner's progress through the data-journal workflow from the journal itself. */
const workflowProgress = (cells: Cell[], shared: boolean): Record<Step, boolean> => {
  const inspections = cells.flatMap((cell) =>
    cell.type === 'data'
      ? cell.outputs
          // Selections ("take" blocks) have no inspection task of their own.
          .filter((output): output is Inspection => output.type === 'inspection' && output.source.kind !== 'extract')
          .map((output) => ({ profile: output.profile, solved: cell.solved[output.profile.name] ?? [] }))
      : [],
  )
  const hasStory =
    cells.filter((cell) => cell.type === 'text' && cell.markdown.trim()).length >= 2 ||
    cells.some((cell) => cell.type !== 'text' && cell.note.trim())
  return {
    data: inspections.length > 0,
    inspect:
      inspections.length > 0 &&
      inspections.every(({ profile, solved }) => buildQuestions(profile).every((q) => solved.includes(q.id))),
    analyse: cells.some(
      (cell) => cell.type === 'analysis' && cell.outputs.some((output) => output.type !== 'inspection'),
    ),
    story: hasStory,
    share: shared,
  }
}

const ICONS: Record<Step, ReactNode> = {
  data: <Database />,
  inspect: <Search />,
  analyse: <ChartColumn />,
  story: <PenLine />,
  share: <Share2 />,
}

export function WorkflowStepper({ shared }: { shared: boolean }) {
  const t = useT()
  const cells = useJournalStore((state) => state.journal.cells)
  const progress = workflowProgress(cells, shared)
  const current = STEPS.find((step) => !progress[step])

  return (
    <nav className={cn(cardClass, 'mt-8 p-4 sm:p-5')} aria-label={t.workflow.label}>
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((step, index) => {
          const done = progress[step]
          const active = current === step
          return (
            <li key={step} className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left" aria-current={active ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl transition [&>svg]:size-4',
                  done && 'bg-leaf-600 text-white shadow-sm shadow-leaf-600/30',
                  active && 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-brand-100',
                  !done && !active && 'bg-ink-100 text-ink-400',
                )}
              >
                {done ? <Check /> : ICONS[step]}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[11px] font-medium tracking-wide text-ink-400 uppercase">{index + 1}</span>
                <span className={cn('block truncate text-sm font-medium', active ? 'text-ink-900' : done ? 'text-ink-700' : 'text-ink-500')}>
                  {t.workflow.steps[step].title}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2.5 text-sm text-brand-900">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-500" />
        {current ? (
          <span>
            <strong className="font-semibold">{t.workflow.steps[current].title}:</strong> {t.workflow.steps[current].hint}
          </span>
        ) : (
          t.workflow.allDone
        )}
      </p>
    </nav>
  )
}
