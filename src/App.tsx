import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Tabs,
  Text,
} from '@radix-ui/themes'

import './App.css'
import { BlocklyWorkspace } from './components/BlocklyWorkspace'
import { DatasetPanel } from './components/DatasetPanel'
import { LanguageSwitch } from './components/LanguageSwitch'
import { BlockSetupDialog } from './components/BlockSetupDialog'
import { useLoadRunner } from './hooks/useLoadRunner'
import { usePythonRunner, type PythonRunStatus } from './hooks/usePythonRunner'
import { pick, t } from './i18n'
import { selectShownStrandId, useAppStore } from './store/useAppStore'

const statusLabels: Record<PythonRunStatus, string> = {
  idle: t('run.status.idle'),
  loading: t('run.status.loading'),
  running: t('run.status.running'),
  success: t('run.status.success'),
  error: t('run.status.error'),
  stopped: t('run.status.stopped'),
}

function App() {
  const generatedCode = useAppStore((state) => state.generatedCode)
  const strandCode = useAppStore((state) => state.strandCode)
  const strandNames = useAppStore((state) => state.strandNames)
  const shownId = useAppStore(selectShownStrandId)
  const selectedBlockId = useAppStore((state) => state.selectedBlockId)
  const loads = useAppStore((state) => state.loads)
  const totalBlocks = useAppStore((state) => state.totalBlocks)
  const topLevelBlocks = useAppStore((state) => state.topLevelBlocks)
  const workspaceVersion = useAppStore((state) => state.workspaceVersion)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const { clearOutput, isBusy, output, run, status, stop } = usePythonRunner()
  useLoadRunner()

  // The code tab follows the same block as the data tab. A selected block outside
  // any strand (dev toolbox) shows the code of the whole workspace instead.
  const selectedOutsideStrands = !!selectedBlockId && !(selectedBlockId in strandCode)
  const strandShown = !selectedOutsideStrands && !!shownId && shownId in strandCode
  const shownCode = strandShown && shownId ? strandCode[shownId] : generatedCode
  const shownLoad = shownId ? loads[shownId] : undefined
  const codeCaption = !strandShown
    ? t('python.forWorkspace')
    : shownLoad?.status === 'ready'
      ? t('python.forDataset', { title: pick(shownLoad.table.meta.title) ?? '' })
      : t('python.forSelected')
  const otherStrands = Object.keys(strandCode).length > 1
  const shownName = strandShown && shownId ? strandNames[shownId] : undefined

  const runButtonLabel =
    status === 'loading' ? t('run.stopLoading') : status === 'running' ? t('run.stop') : t('run.start')

  return (
    <Box className="app-shell">
      <BlockSetupDialog />
      <header className="hero-panel">
        <div>
          <Flex align="center" gap="3" wrap="wrap">
            <Badge size="3" color="cyan" variant="soft">
              React + Vite
            </Badge>
            <Badge size="3" color="violet" variant="soft">
              Blockly {`+`} Python
            </Badge>
            <Badge size="3" color="grass" variant="soft">
              Zustand state
            </Badge>
          </Flex>
          <Heading size="8" mt="4">
            spockly
          </Heading>
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
              <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
                <div>
                  <Heading size="5">{t('app.workspaceTitle')}</Heading>
                  <Text as="p" size="2" color="gray">
                    {t('app.workspaceHint')}
                  </Text>
                </div>
                <Badge size="2" color="amber" variant="soft">
                  {t('app.livePreview')}
                </Badge>
              </Flex>
              <BlocklyWorkspace workspaceVersion={workspaceVersion} />
            </div>
          </Card>
        </section>

        <Tabs.Root defaultValue="data" className="code-column">
          <Tabs.List>
            <Tabs.Trigger value="data">{t('panel.data')}</Tabs.Trigger>
            <Tabs.Trigger value="python">{t('panel.python')}</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="data" className="tab-content">
            <Card size="3" className="dataset-card">
              <div className="dataset-scroll">
                <DatasetPanel />
              </div>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="python" className="tab-content">
            <Card size="3" className="code-card">
              <div className="code-card-content">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Heading size="5">{t('python.title')}</Heading>
                  <Button
                    type="button"
                    color={isBusy ? 'red' : 'grass'}
                    onClick={() => (isBusy ? stop() : run(shownCode))}
                  >
                    {runButtonLabel}
                  </Button>
                </Flex>
                <Text as="p" size="2" color="gray" mb="3">
                  {codeCaption}
                  {shownName && <> {t('python.variable')} <code>{shownName}</code>.</>}
                  {strandShown && otherStrands && ` ${t('python.switchHint')}`}
                </Text>
                <pre className="python-preview">
                  <code>{shownCode}</code>
                </pre>
              </div>
            </Card>

            <Card size="3" className="output-card">
              <div className="output-card-content">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Flex align="center" gap="2">
                    <Heading size="5">{t('run.output')}</Heading>
                    <Badge
                      size="2"
                      color={
                        status === 'error'
                          ? 'red'
                          : status === 'success'
                            ? 'grass'
                            : status === 'stopped'
                              ? 'amber'
                              : 'gray'
                      }
                      variant="soft"
                    >
                      {statusLabels[status]}
                    </Badge>
                  </Flex>
                  <Button
                    type="button"
                    size="1"
                    variant="ghost"
                    disabled={!output || isBusy}
                    onClick={clearOutput}
                  >
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
      </main>
    </Box>
  )
}

export default App
