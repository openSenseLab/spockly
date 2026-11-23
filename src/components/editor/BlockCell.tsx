import { Code, PenLine } from 'lucide-react'
import { useCallback, useState } from 'react'

import { BlocklyEditor } from '../../blockly/BlocklyEditor'
import { useLanguageStore, useT } from '../../i18n'
import { useJournalStore } from '../../journal/store'
import type { BlockCell as BlockCellType, CellOutput } from '../../journal/types'
import { DatasetHeader } from '../inspect/DatasetHeader'
import { InspectionPanel } from '../inspect/InspectionPanel'
import { OutputView } from '../outputs/OutputView'
import { Button, IconButton, Tooltip } from '../ui'
import { cn, inputClass } from '../ui/styles'
import { CellShell } from './CellShell'

type Inspection = Extract<CellOutput, { type: 'inspection' }>

function DatasetInspection({ cell, output }: { cell: BlockCellType; output: Inspection }) {
  const setResult = useJournalStore((state) => state.setResult)
  const { profile } = output
  const solved = cell.solved[profile.name] ?? []

  const onSolve = (questionId: string) => {
    if (solved.includes(questionId)) return
    setResult(cell.id, { solved: { ...cell.solved, [profile.name]: [...solved, questionId] } })
  }

  return (
    <div className="rounded-xl bg-ink-50/70 p-3 ring-1 ring-ink-100 sm:p-4">
      <DatasetHeader output={output} />
      <InspectionPanel profile={profile} solved={solved} onSolve={onSolve} />
    </div>
  )
}

function Note({ cell }: { cell: BlockCellType }) {
  const t = useT()
  const setResult = useJournalStore((state) => state.setResult)
  const [open, setOpen] = useState(false)
  const texts = t.cells[cell.type]

  if (!cell.note && !open) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="-ml-1 text-ink-500" onClick={() => setOpen(true)}>
          <PenLine /> {texts.addNote}
        </Button>
      </div>
    )
  }
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
        <PenLine className="size-3.5" /> {texts.noteLabel}
      </span>
      <textarea
        autoFocus={open}
        rows={3}
        className={cn(inputClass, 'resize-y bg-amber-50/40')}
        placeholder={texts.notePlaceholder}
        value={cell.note}
        onChange={(event) => setResult(cell.id, { note: event.target.value })}
        onBlur={() => !cell.note && setOpen(false)}
      />
    </label>
  )
}

/** Data and analysis cells: a Blockly workspace, its results and an optional note. */
export function BlockCell({ cell, index }: { cell: BlockCellType; index: number }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const editCell = useJournalStore((state) => state.editCell)
  const setResult = useJournalStore((state) => state.setResult)
  const [showCode, setShowCode] = useState(false)

  const onWorkspaceChange = useCallback(
    (workspace: object, code: string) => {
      const current = useJournalStore.getState().journal.cells.find((c) => c.id === cell.id)
      if (!current || current.type === 'text') return
      // Only a change in generated code makes results outdated; moving blocks does not.
      if (current.code === code) setResult(cell.id, { workspace })
      else editCell(cell.id, { workspace, code })
    },
    [cell.id, editCell, setResult],
  )

  const inspections = cell.outputs.filter((output): output is Inspection => output.type === 'inspection')
  const others = cell.outputs.filter((output) => output.type !== 'inspection')

  return (
    <CellShell
      id={cell.id}
      type={cell.type}
      index={index}
      title={
        <input
          className="-mx-1 w-full max-w-md truncate rounded-md bg-transparent px-1 font-semibold text-ink-900 outline-none hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-200"
          value={cell.title}
          onChange={(event) => setResult(cell.id, { title: event.target.value })}
          aria-label={t.cells.titleLabel}
        />
      }
      actions={
        <Tooltip content={showCode ? t.cells.hideCode : t.cells.showCode}>
          <IconButton
            label={t.cells.showCode}
            variant={showCode ? 'soft' : 'ghost'}
            onClick={() => setShowCode(!showCode)}
            aria-pressed={showCode}
          >
            <Code />
          </IconButton>
        </Tooltip>
      }
    >
      <div
        className={cn(
          'resize-y overflow-hidden rounded-xl ring-1 ring-ink-200',
          cell.type === 'data' ? 'h-[215px] min-h-36' : 'h-[420px] min-h-64',
        )}
      >
        <BlocklyEditor key={language} variant={cell.type} initialState={cell.workspace} onChange={onWorkspaceChange} />
      </div>
      {showCode && (
        <pre className="overflow-auto rounded-xl bg-ink-900 p-4 font-mono text-[13px] leading-relaxed text-ink-100">
          <code>{cell.code || t.cells.noCode}</code>
        </pre>
      )}
      {inspections.map((output) => (
        <DatasetInspection key={output.profile.name} cell={cell} output={output} />
      ))}
      {others.length > 0 && <OutputView outputs={others} />}
      <Note cell={cell} />
    </CellShell>
  )
}
