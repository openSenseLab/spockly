import { BookPlus, ChartColumn, Code, EllipsisVertical, FlaskConical, Play, Puzzle, RefreshCw, RotateCcw, Square } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { BlocklyEditor } from '../blockly/BlocklyEditor'
import { installEditorContext } from '../blockly/context'
import { codeFromWorkspace } from '../blockly/headless'
import { AppHeader } from '../components/AppHeader'
import { ErrorMessage } from '../components/ErrorMessage'
import { LibraryDialog } from '../components/LibraryDialog'
import { DatasetHeader } from '../components/inspect/DatasetHeader'
import { InspectionPanel } from '../components/inspect/InspectionPanel'
import { KernelDot } from '../components/KernelDot'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { ModeSwitch } from '../components/ModeSwitch'
import { OutputView } from '../components/outputs/OutputView'
import {
  Button,
  Callout,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Spinner,
  Tooltip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui'
import { cardClass, cn } from '../components/ui/styles'
import { useLanguageStore, useT } from '../i18n'
import { useJournalStore } from '../journal/store'
import type { CellOutput } from '../journal/types'
import { KernelError, resetKernel, restartKernel, runCode, warmUpKernel } from '../kernel/kernel'
import { useLabStore } from './labStore'
import { inspectRequests } from '../journal/workspaces'
import { LabToJournalDialog } from './LabToJournalDialog'
import { scrollToCell } from '../journal/scroll'

type Inspection = Extract<CellOutput, { type: 'inspection' }>

/** Runs the whole lab workspace from a clean Python state, like "restart and run all". */
const runLab = async () => {
  const lab = useLabStore.getState()
  const code = lab.workspace ? codeFromWorkspace(lab.workspace) : lab.code
  if (code !== lab.code) useLabStore.setState({ code })
  lab.setRun({ status: 'running' })
  try {
    if (!code.trim()) throw new KernelError('SPK|no_blocks|')
    // The lab shares Python with the journal: journal results must be recomputed afterwards.
    useJournalStore.getState().invalidateFrom(0)
    await resetKernel()
    const files = Object.fromEntries(Object.entries(lab.files).filter(([name]) => code.includes(name)))
    useLabStore.getState().setOutputs(await runCode(code, files, inspectRequests(lab.workspace)))
    useLabStore.getState().setRun({ status: 'done' })
  } catch (error) {
    useLabStore.getState().setRun({ status: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}

export function Lab() {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const { workspace, code, outputs, run, version, setWorkspace, addFile, reset } = useLabStore()
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    warmUpKernel()
    // In the lab, dropdowns offer the datasets of this workspace and uploads stay in the lab.
    return installEditorContext({ datasetNames: () => [], addFile, fileContent: (name) => useLabStore.getState().files[name] })
  }, [addFile])

  const onChange = useCallback((state: object, nextCode: string) => setWorkspace(state, nextCode), [setWorkspace])

  const inspections = outputs.filter((output): output is Inspection => output.type === 'inspection')
  const others = outputs.filter((output) => output.type !== 'inspection')

  const [toJournalOpen, setToJournalOpen] = useState(false)
  const toJournal = () => setToJournalOpen(true)

  return (
    <div className="flex h-screen flex-col bg-ink-50 max-lg:h-auto">
      <AppHeader
        wide
        left={<ModeSwitch mode="lab" />}
        right={
          <>
            <KernelDot />
            {run.status === 'running' ? (
              <Button variant="danger" size="sm" onClick={restartKernel}>
                <Square /> {t.run.stop}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void runLab()} aria-label={t.run.run}>
                <Play /> <span className="hidden sm:inline">{t.run.run}</span>
              </Button>
            )}
            <Tooltip content={t.lab.addToJournalHint}>
              <Button size="sm" onClick={toJournal} aria-label={t.lab.addToJournal}>
                <BookPlus /> <span className="hidden md:inline">{t.lab.toJournal}</span>
              </Button>
            </Tooltip>
            <LanguageSwitch />
            <Menu>
              <MenuTrigger>
                <IconButton label={t.cells.more}>
                  <EllipsisVertical />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={toJournal}>
                  <BookPlus /> {t.lab.addToJournal}
                </MenuItem>
                <MenuItem onSelect={() => setLibraryOpen(true)}>
                  <Puzzle /> {t.library.manage}
                </MenuItem>
                <MenuSeparator />
                <MenuItem danger onSelect={() => window.confirm(t.lab.resetConfirm) && reset()}>
                  <RotateCcw /> {t.lab.reset}
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
        <section className={cn(cardClass, 'min-h-0 overflow-hidden max-lg:h-[70vh]')}>
          {/* key: re-create after "start over" and on language change */}
          <BlocklyEditor key={`${language}-${version}`} variant="lab" initialState={workspace} onChange={onChange} />
        </section>

        <aside className={cn(cardClass, 'flex min-h-0 flex-col overflow-hidden')}>
          <Tabs defaultValue="results" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="shrink-0 px-3">
              <TabsTrigger value="results">
                <ChartColumn /> {t.lab.results}
              </TabsTrigger>
              <TabsTrigger value="python">
                <Code /> Python
              </TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="results" className="flex flex-col gap-5 p-4">
                {run.status === 'error' && run.error && <ErrorMessage message={run.error} />}
                {run.status === 'stale' && (
                  <Callout tone="amber" icon={<RefreshCw />}>
                    {t.lab.stale}
                  </Callout>
                )}
                {outputs.length === 0 && run.status !== 'error' && (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    {run.status === 'running' ? (
                      <Spinner className="size-8" />
                    ) : (
                      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                        <FlaskConical className="size-7" />
                      </span>
                    )}
                    <p className="max-w-xs text-sm text-ink-500">{run.status === 'running' ? t.run.status.running : t.lab.empty}</p>
                  </div>
                )}
                {inspections.map((output) => (
                  <div key={output.profile.name} className="rounded-xl bg-ink-50/70 p-3 ring-1 ring-ink-100">
                    <DatasetHeader output={output} />
                    <InspectionPanel profile={output.profile} />
                  </div>
                ))}
                {others.length > 0 && <OutputView outputs={others} />}
              </TabsContent>
              <TabsContent value="python" className="p-4">
                <pre className="overflow-auto rounded-xl bg-ink-900 p-4 font-mono text-[13px] leading-relaxed text-ink-100">
                  <code>{code || t.cells.noCode}</code>
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </main>
      <LibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
      <LabToJournalDialog
        open={toJournalOpen}
        onOpenChange={setToJournalOpen}
        onDone={(ids) => {
          window.location.hash = '#/'
          if (ids[0]) scrollToCell(ids[0])
        }}
      />
    </div>
  )
}
