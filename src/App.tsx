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
import { OsemSetupDialog } from './components/OsemSetupDialog'
import { useLoadRunner } from './hooks/useLoadRunner'
import { usePythonRunner, type PythonRunStatus } from './hooks/usePythonRunner'
import { pick, t } from './i18n'
import { selectShownStrandId, useAppStore } from './store/useAppStore'

const statusLabels: Record<PythonRunStatus, string> = {
  idle: 'Ready',
  loading: 'Loading Python',
  running: 'Running',
  success: 'Finished',
  error: 'Error',
  stopped: 'Stopped',
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
    status === 'loading' ? 'Stop loading' : status === 'running' ? 'Stop execution' : 'Run code'

  return (
    <Box className="app-shell">
      <OsemSetupDialog />
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
            A lightweight Blockly workspace for assembling Python logic and inspecting the
            generated code live.
          </Text>
        </div>
        <Card size="2" className="hero-metadata">
          <Flex justify="end" mb="3">
            <LanguageSwitch />
          </Flex>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <div>
              <Text as="div" size="2" color="gray">
                Total blocks
              </Text>
              <Heading size="7">{totalBlocks}</Heading>
            </div>
            <div>
              <Text as="div" size="2" color="gray">
                Top-level steps
              </Text>
              <Heading size="7">{topLevelBlocks}</Heading>
            </div>
          </Flex>
          <Button type="button" variant="soft" mt="4" onClick={resetWorkspace}>
            Reset workspace
          </Button>
        </Card>
      </header>

      <main className="workspace-layout">
        <section className="workspace-column">
          <Card size="3" className="workspace-card">
            <div className="workspace-card-content">
              <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
                <div>
                  <Heading size="5">Blockly lab</Heading>
                  <Text as="p" size="2" color="gray">
                    Use the standard Blockly toolbox, then inspect the generated Python
                    beside it.
                  </Text>
                </div>
                <Badge size="2" color="amber" variant="soft">
                  Live preview
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
              <DatasetPanel />
            </Card>
          </Tabs.Content>

          <Tabs.Content value="python" className="tab-content">
            <Card size="3" className="code-card">
              <div className="code-card-content">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Heading size="5">Generated Python</Heading>
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
                    <Heading size="5">Output</Heading>
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
                    Clear
                  </Button>
                </Flex>
                <Text as="p" size="2" color="gray" mb="3">
                  Standard output, return values, and Python errors appear here.
                </Text>
                <pre
                  className={`python-output${status === 'error' ? ' python-output-error' : ''}`}
                  aria-busy={isBusy}
                  aria-live="polite"
                  role="log"
                >
                  {output ||
                    (status === 'loading'
                      ? 'Preparing the Python runtime…'
                      : status === 'running'
                        ? 'Running Python…'
                        : status === 'success'
                          ? 'Code finished without producing output.'
                          : 'Run the generated Python to see its output.')}
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
