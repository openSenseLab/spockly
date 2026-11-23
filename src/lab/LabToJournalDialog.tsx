import { BookPlus, Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, Callout, Dialog } from '../components/ui'
import { buttonClass, cn, inputClass } from '../components/ui/styles'
import { format, useT } from '../i18n'
import { runCell } from '../journal/runner'
import { useJournalStore } from '../journal/store'
import type { Cell } from '../journal/types'
import { describeLab, insertLabIntoJournal, useLabStore } from './labStore'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected position (index in the cell list); undefined = end of the journal. */
  index?: number
  /** Called with the new cell ids after inserting. */
  onDone: (ids: string[]) => void
}

/** Short label for a cell in the position list. */
const cellLabel = (cell: Cell) => {
  if (cell.type !== 'text') return cell.title
  const line = cell.markdown.split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').slice(0, 60) || '…'
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-ink-50">
      <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  )
}

function DialogBody({ index, onDone, close }: { index?: number; onDone: (ids: string[]) => void; close: () => void }) {
  const t = useT()
  const cells = useJournalStore((state) => state.journal.cells)
  const runState = useLabStore((state) => state.run.status)
  // Read once when the dialog opens.
  const [lab] = useState(describeLab)
  const [title, setTitle] = useState(t.lab.analysisTitle)
  const [position, setPosition] = useState(index ?? cells.length)
  const [separateData, setSeparateData] = useState(true)
  const [perPipeline, setPerPipeline] = useState(lab.pipelines > 1)
  const [runNow, setRunNow] = useState(true)

  const summary = useMemo(
    () => format(t.labImport.summary, { pipelines: lab.pipelines, loads: lab.loads }),
    [lab, t],
  )

  if (lab.empty) {
    return (
      <div className="space-y-4">
        <Callout tone="amber" icon={<Info />}>
          {t.labImport.empty}
        </Callout>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>{t.common.cancel}</Button>
          <a href="#/lab" className={buttonClass({ variant: 'primary' })} onClick={close}>
            {t.labImport.openLab}
          </a>
        </div>
      </div>
    )
  }

  const submit = () => {
    const ids = insertLabIntoJournal({ index: position, title: title.trim() || t.lab.analysisTitle, separateData, perPipeline })
    if (runNow && ids.length) void runCell(ids.at(-1)!)
    close()
    onDone(ids)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <p className="text-sm text-ink-600">
        {summary}
        {runState === 'stale' && <span className="text-amber-700"> {t.labImport.notRunYet}</span>}
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-500 uppercase">{t.labImport.titleLabel}</span>
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-500 uppercase">{t.labImport.position}</span>
        <select className={cn(inputClass, 'cursor-pointer')} value={position} onChange={(event) => setPosition(Number(event.target.value))}>
          <option value={0}>{t.labImport.atStart}</option>
          {cells.map((cell, i) => (
            <option key={cell.id} value={i + 1}>
              {format(t.labImport.after, { type: t.cells[cell.type].label, label: cellLabel(cell) })}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl ring-1 ring-ink-200">
        {lab.loads > 0 && (
          <Check checked={separateData} onChange={setSeparateData} label={t.labImport.separateData} hint={t.labImport.separateDataHint} />
        )}
        {lab.pipelines > 1 && (
          <Check checked={perPipeline} onChange={setPerPipeline} label={t.labImport.perPipeline} hint={t.labImport.perPipelineHint} />
        )}
        <Check checked={runNow} onChange={setRunNow} label={t.labImport.runNow} hint={t.labImport.runNowHint} />
      </div>

      {separateData && lab.alreadyInJournal.length > 0 && (
        <Callout tone="brand" icon={<Info />}>
          {format(t.labImport.skipped, { names: lab.alreadyInJournal.join(', ') })}
        </Callout>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={close}>{t.common.cancel}</Button>
        <Button type="submit" variant="primary">
          <BookPlus /> {t.labImport.confirm}
        </Button>
      </div>
    </form>
  )
}

/** Bring the lab's workflow into the journal: as data and analysis blocks at a chosen position. */
export function LabToJournalDialog({ open, onOpenChange, index, onDone }: Props) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t.labImport.title} description={t.labImport.description}>
      {open && <DialogBody index={index} onDone={onDone} close={() => onOpenChange(false)} />}
    </Dialog>
  )
}
