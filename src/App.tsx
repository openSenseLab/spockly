import { useEffect, useState } from 'react'
import { Badge, Box, Button, Callout, Card, Flex, Heading, Tabs, Text } from '@radix-ui/themes'

import './App.css'
import { explainError } from './blocks/errors'
import { pythonFiles } from './blocks/fileStore'
import { allAdvice, ranAsItIs, signatures } from './blocks'
import { blockText, datasetOf } from './blocks/program'
import { BlocklyWorkspace } from './components/BlocklyWorkspace'
import { getActiveWorkspace } from './components/blockly/carryWorkspace'
import { LanguageSwitch } from './components/LanguageSwitch'
import { ResultsPanel } from './components/ResultsPanel'
import { SnapshotPanel } from './components/SnapshotPanel'
import { usePythonRunner, type PythonRunStatus } from './hooks/usePythonRunner'
import { t } from './i18n'
import { useAppStore } from './store/useAppStore'

const statusLabels: Record<PythonRunStatus, string> = {
  idle: t('run.status.idle'),
  loading: t('run.status.loading'),
  running: t('run.status.running'),
  success: t('run.status.success'),
  error: t('run.status.error'),
  stopped: t('run.status.stopped'),
}

const statusColor = (status: PythonRunStatus) =>
  status === 'error' ? 'red' : status === 'success' ? 'grass' : status === 'stopped' ? 'amber' : 'gray'

type Tab = 'results' | 'snapshot' | 'python'

function App() {
  const generatedCode = useAppStore((state) => state.generatedCode)
  const runCode = useAppStore((state) => state.runCode)
  const filesVersion = useAppStore((state) => state.filesVersion)
  const totalBlocks = useAppStore((state) => state.totalBlocks)
  const topLevelBlocks = useAppStore((state) => state.topLevelBlocks)
  const workspaceVersion = useAppStore((state) => state.workspaceVersion)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const snapshots = useAppStore((state) => state.snapshots)
  const { clearOutput, error, hints, isBusy, output, run, status, stop, views } = usePythonRunner()
  const [tab, setTab] = useState<Tab>('results')

  // A Python error, explained at the block that caused it.
  const workspace = getActiveWorkspace()
  const problem = status === 'error' && error && workspace ? explainError(error, workspace, snapshots) : null
  const problemBlock = problem?.blockId ? (workspace?.getBlockById(problem.blockId) ?? null) : null
  // The canvas marks the block, and its Zwischenstand shows the error (see blocks/runState).
  const problemId = problem?.blockId ?? null
  const problemText = problem?.text ?? ''
  useEffect(() => {
    useAppStore.getState().setFailure(problemId ? { blockId: problemId, text: problemText } : null)
  }, [problemId, problemText])

  // Clicking a step shows what the data looked like after it.
  useEffect(
    () =>
      useAppStore.subscribe((state, before) => {
        if (!state.selectedBlockId || state.selectedBlockId === before.selectedBlockId) return
        const block = getActiveWorkspace()?.getBlockById(state.selectedBlockId)
        if (block && datasetOf(block)) setTab('snapshot')
      }),
    [],
  )

  // What the last "Ausführen" ran. Nothing runs by itself: after a change,
  // students decide when to run again, and the canvas shows which blocks the
  // last run covered (blocks/runState).
  const lastRun = useAppStore((state) => state.lastRun)
  const start = () => {
    const current = getActiveWorkspace()
    useAppStore.getState().setLastRun({
      code: runCode,
      files: filesVersion,
      signatures: current ? signatures(current, filesVersion) : {},
    })
    // The picked files go along each time: Python reads them like files on a disk.
    run(runCode, pythonFiles())
    setTab('results')
  }
  const changed = lastRun !== null && !isBusy && (runCode !== lastRun.code || filesVersion !== lastRun.files)
  // Advice on results that ran but hide a mistake (a table of one row from GeoJSON), while still current.
  const advice =
    workspace && lastRun && !isBusy
      ? allAdvice(workspace, snapshots).filter((a) => {
          const block = workspace.getBlockById(a.blockId)
          return block !== null && ranAsItIs(block, lastRun.signatures, snapshots, filesVersion)
        })
      : []

  const runButtonLabel =
    status === 'loading' ? t('run.stopLoading') : status === 'running' ? t('run.stop') : t('run.start')

  return (
    <Box className="app-shell">
      <header className="hero-panel">
        <div>
          <Heading size="8">spockly</Heading>
          <Text as="p" size="4" className="hero-copy">
            {t('app.tagline')}
          </Text>
        </div>
        <Card size="2" className="hero-metadata">
          <Flex justify="end" mb="3">
            <LanguageSwitch />
          </Flex>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <div>
              <Text as="div" size="2" color="gray">
                {t('app.totalBlocks')}
              </Text>
              <Heading size="7">{totalBlocks}</Heading>
            </div>
            <div>
              <Text as="div" size="2" color="gray">
                {t('app.topLevelBlocks')}
              </Text>
              <Heading size="7">{topLevelBlocks}</Heading>
            </div>
          </Flex>
          <Button type="button" variant="soft" mt="4" onClick={resetWorkspace}>
            {t('app.resetWorkspace')}
          </Button>
        </Card>
      </header>

      <main className="workspace-layout">
        <section className="workspace-column">
          <Card size="3" className="workspace-card">
            <div className="workspace-card-content">
              <Box mb="4">
                <Heading size="5">{t('app.workspaceTitle')}</Heading>
                <Text as="p" size="2" color="gray">
                  {t('app.workspaceHint')}
                </Text>
              </Box>
              <BlocklyWorkspace workspaceVersion={workspaceVersion} />
            </div>
          </Card>
        </section>

        <section className="code-column">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Flex align="center" gap="2">
              <Button type="button" size="3" color={isBusy ? 'red' : 'grass'} onClick={() => (isBusy ? stop() : start())}>
                {runButtonLabel}
              </Button>
              <Badge size="2" color={statusColor(status)} variant="soft">
                {statusLabels[status]}
              </Badge>
            </Flex>
          </Flex>

          <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)} className="code-column">
            <Tabs.List>
              <Tabs.Trigger value="results">{t('panel.results')}</Tabs.Trigger>
              <Tabs.Trigger value="snapshot">{t('panel.snapshot')}</Tabs.Trigger>
              <Tabs.Trigger value="python">{t('panel.python')}</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="results" className="tab-content">
              <Card size="3" className="dataset-card">
                <div className="dataset-scroll">
                  {changed && (
                    <Callout.Root color="blue" mb="4" role="status">
                      <Callout.Text>{t('results.changed')}</Callout.Text>
                    </Callout.Root>
                  )}
                  {problem && (
                    <Callout.Root color="red" mb="4" role="alert">
                      <Callout.Text>
                        <Text as="span" weight="bold">
                          {problemBlock ? t('error.title', { block: blockText(problemBlock) }) : t('error.general')}
                        </Text>
                        <br />
                        {problem.text}
                        <br />
                        {t('error.notRunAfter')}
                        <br />
                        <Text as="span" size="1" color="gray">
                          {t('error.details')}
                        </Text>
                      </Callout.Text>
                    </Callout.Root>
                  )}
                  {hints.map((hint, i) => (
                    <Callout.Root key={i} color="amber" mb="4" role="status">
                      <Callout.Text>{hint}</Callout.Text>
                    </Callout.Root>
                  ))}
                  {advice.map((a) => (
                    <Callout.Root key={a.blockId} color="amber" mb="4" role="status">
                      <Callout.Text>
                        {a.text}
                        <br />
                        <Text as="span" size="1">
                          {t('advice.onCanvas')}
                        </Text>
                      </Callout.Text>
                    </Callout.Root>
                  ))}
                  {(!problem || views.length > 0) && <ResultsPanel views={views} ran={status === 'success'} />}
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="snapshot" className="tab-content">
              <Card size="3" className="dataset-card">
                <div className="dataset-scroll snapshot-scroll">
                  <SnapshotPanel busy={isBusy} />
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="python" className="tab-content python-tab">
              <Card size="3" className="code-card">
                <div className="code-card-content">
                  <Heading size="5">{t('python.title')}</Heading>
                  <Text as="p" size="2" color="gray" mb="3">
                    {t('python.caption')}
                  </Text>
                  <pre className="python-preview">
                    <code>{generatedCode}</code>
                  </pre>
                </div>
              </Card>

              <Card size="3" className="output-card">
                <div className="output-card-content">
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Heading size="5">{t('run.output')}</Heading>
                    <Button type="button" size="1" variant="ghost" disabled={!output || isBusy} onClick={clearOutput}>
                      {t('run.clear')}
                    </Button>
                  </Flex>
                  <Text as="p" size="2" color="gray" mb="3">
                    {t('run.outputHint')}
                  </Text>
                  <pre
                    className={`python-output${status === 'error' ? ' python-output-error' : ''}`}
                    aria-busy={isBusy}
                    aria-live="polite"
                    role="log"
                  >
                    {output ||
                      (status === 'loading'
                        ? t('run.preparing')
                        : status === 'running'
                          ? t('run.running')
                          : status === 'success'
                            ? t('run.noOutput')
                            : t('run.empty'))}
                  </pre>
                </div>
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        </section>
      </main>
    </Box>
  )
}

export default App
