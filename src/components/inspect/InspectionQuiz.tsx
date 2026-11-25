import { CircleCheck, PartyPopper, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import { format, useT } from '../../i18n'
import { buildQuestions, type Question } from '../../journal/inspection'
import type { DatasetProfile } from '../../journal/types'
import { Button, Callout, Progress } from '../ui'
import { cardClass, cn, inputClass } from '../ui/styles'

type Props = {
  profile: DatasetProfile
  solved: string[]
  onSolve: (questionId: string) => void
}

function OpenQuestion({ question, number, onSolve }: { question: Question; number: number; onSolve: () => void }) {
  const t = useT()
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const texts = t.inspect.questions[question.id]

  const check = (candidate: string) => {
    const correct =
      question.kind === 'number'
        ? Number(candidate.replace(/[.,\s]/g, '')) === question.answer
        : candidate === question.answer
    setWrong(!correct)
    if (correct) onSolve()
  }

  const optionLabel = (option: string) => (option === 'yes' ? t.common.yes : option === 'no' ? t.common.no : option)

  return (
    <div className={cn(cardClass, 'animate-fade-in p-4 ring-brand-200')}>
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">{number}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">{texts.question}</p>
          <p className="mt-0.5 text-sm text-ink-500">{texts.hint}</p>

          <div className="mt-3">
            {question.kind === 'number' ? (
              <form
                className="flex max-w-sm gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  check(value)
                }}
              >
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={t.inspect.answerPlaceholder}
                  aria-label={texts.question}
                />
                <Button type="submit" variant="primary" disabled={!value.trim()}>
                  {t.inspect.check}
                </Button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" role="radiogroup" aria-label={texts.question}>
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={value === option}
                    onClick={() => {
                      setValue(option)
                      check(option)
                    }}
                    className={cn(
                      'cursor-pointer truncate rounded-lg px-3 py-2 font-mono text-sm ring-1 transition',
                      value === option && wrong
                        ? 'bg-amber-50 text-amber-800 ring-amber-300'
                        : 'bg-white text-ink-700 ring-ink-200 hover:bg-brand-50 hover:ring-brand-300',
                    )}
                  >
                    {optionLabel(option)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {wrong && <p className="mt-2 text-sm text-amber-700">{t.inspect.tryAgain}</p>}
        </div>
      </div>
    </div>
  )
}

/** One question at a time; answered questions collapse into a single line with the explanation. */
export function InspectionQuiz({ profile, solved, onSolve }: Props) {
  const t = useT()
  const questions = useMemo(() => buildQuestions(profile), [profile])
  const done = questions.filter((question) => solved.includes(question.id))
  const next = questions.find((question) => !solved.includes(question.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Sparkles className="size-4 shrink-0 text-brand-500" />
        <Progress value={(done.length / questions.length) * 100} />
        <span className="shrink-0 text-xs font-medium text-ink-500">
          {format(t.inspect.progress, { done: done.length, total: questions.length })}
        </span>
      </div>
      {done.map((question) => (
        <p key={question.id} className="flex items-start gap-2 text-sm text-leaf-700">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          <span>{t.inspect.questions[question.id].explanation}</span>
        </p>
      ))}
      {next ? (
        <OpenQuestion key={`${profile.name}-${next.id}`} number={done.length + 1} question={next} onSolve={() => onSolve(next.id)} />
      ) : (
        <Callout tone="green" icon={<PartyPopper />}>
          {t.inspect.allDone}
        </Callout>
      )}
    </div>
  )
}
