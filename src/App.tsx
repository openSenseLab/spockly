import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes'
import { useEffect, useState } from 'react'

import './App.css'
import { BlocklyWorkspace } from './components/BlocklyWorkspace'
import { DataView } from './components/DataView'
import { OutputView } from './components/OutputView'
import { usePythonRunner } from './hooks/usePythonRunner'
import { useAppStore } from './store/useAppStore'
import { useTasksStore, columnsFromPreview } from './store/useTasksStore'
import { DS_MODES } from './components/blockly/modes/types'

type RightTab = 'data' | 'code'

function App() {
  const generatedCode = useAppStore((state) => state.generatedCode)
  const uploadedCsv = useAppStore((state) => state.uploadedCsv)
  const totalBlocks = useAppStore((state) => state.totalBlocks)
  const topLevelBlocks = useAppStore((state) => state.topLevelBlocks)
  const workspaceVersion = useAppStore((state) => state.workspaceVersion)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const dsMode = useAppStore((state) => state.dsMode)
  const setDsMode = useAppStore((state) => state.setDsMode)
  const resultsStale = useAppStore((state) => state.resultsStale)
  const setResultsStale = useAppStore((state) => state.setResultsStale)
  const {
    clearOutput,
    dataFiles,
    images,
    isBusy,
    output,
    run,
    status,
    stop,
    systemOutput,
    variables,
  } = usePythonRunner()
  const [activeTab, setActiveTab] = useState<RightTab>('data')
  const [showReflection, setShowReflection] = useState(
    () => localStorage.getItem('spockly:showReflection') !== 'false',
  )

  const dismissReflection = () => {
    localStorage.setItem('spockly:showReflection', 'false')
    setShowReflection(false)
  }

  // When a run finishes (success or error), the displayed results correspond to
  // the current workspace, so clear the stale flag.
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      setResultsStale(false)
    }
  }, [status, setResultsStale])

  // After a run, sync the worker-reported DataFrame variables into the tasks
  // store so the tasks blocks' variable and column dropdowns can list the
  // loaded variables and their columns. The user must run the script before the
  // dropdowns are populated — this is intentional and keeps editing fast.
  useEffect(() => {
    if (status !== 'success') {
      return
    }
    const columns: Record<string, string[]> = {}
    const variableNames: string[] = []
    for (const variable of variables) {
      columns[variable.name] = columnsFromPreview(variable)
      variableNames.push(variable.name)
    }
    useTasksStore.getState().setTasksVariableColumns(columns)
    useTasksStore.getState().setTasksVariables(variableNames)
  }, [status, variables])

  const runButtonLabel =
    status === 'loading' ? 'Stop loading' : status === 'running' ? 'Stop execution' : 'Run code'

  const hasWorkspaceContent = totalBlocks > 0

  const confirmDiscard = () => {
    if (!hasWorkspaceContent) {
      return true
    }
    return window.confirm(
      'This will discard the current workspace and its results. Continue?',
    )
  }

  const handleRun = () => {
    if (isBusy) {
      stop()
      return
    }
    run(generatedCode, {
      dataFiles: [
        {
          path: '/data/muenster_measurements_72h.csv',
          url: '/data/muenster_measurements_72h.csv',
        },
        {
          path: '/data/muenster_stations.geojson',
          url: '/data/muenster_stations.geojson',
        },
      ],
      uploadedCsv,
    })
  }

  const handleReset = () => {
    if (isBusy) {
      return
    }
    if (!confirmDiscard()) {
      return
    }
    clearOutput()
    resetWorkspace()
  }

  const handleModeChange = (mode: (typeof DS_MODES)[number]['value']) => {
    if (isBusy) {
      return
    }
    if (mode === dsMode) {
      return
    }
    if (!confirmDiscard()) {
      return
    }
    clearOutput()
    setDsMode(mode)
  }

  return (
    <Box className="app-shell">
      <header className="hero-panel">
        <Flex className="hero-controls" align="center" gap="3" wrap="wrap">
          <Flex align="center" gap="2" wrap="wrap">
            <Badge size="1" color="cyan" variant="soft">
              Investigation
            </Badge>
            <Badge size="1" color="violet" variant="soft">
              Blockly prototype
            </Badge>
            <Badge size="1" color="grass" variant="soft">
              Example workflow
            </Badge>
          </Flex>
          <Flex align="center" gap="2" wrap="wrap">
            {DS_MODES.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                size="1"
                variant={dsMode === mode.value ? 'solid' : 'soft'}
                color={dsMode === mode.value ? 'indigo' : 'gray'}
                onClick={() => handleModeChange(mode.value)}
                disabled={isBusy}
                title={mode.description}
              >
                {mode.label}
              </Button>
            ))}
          </Flex>
        </Flex>
        <Card size="2" className="hero-metadata">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Flex align="center" gap="4">
              <Flex align="center" gap="2">
                <Text as="span" size="1" color="gray">
                  Total blocks
                </Text>
                <Heading size="4">{totalBlocks}</Heading>
              </Flex>
              <Flex align="center" gap="2">
                <Text as="span" size="1" color="gray">
                  Top-level steps
                </Text>
                <Heading size="4">{topLevelBlocks}</Heading>
              </Flex>
            </Flex>
            <Flex align="center" gap="2" wrap="wrap">
              <Button
                type="button"
                size="1"
                color={isBusy ? 'red' : 'grass'}
                onClick={handleRun}
              >
                {runButtonLabel}
              </Button>
              <Button
                type="button"
                size="1"
                variant="soft"
                onClick={handleReset}
                disabled={isBusy}
              >
                Reset workspace
              </Button>
            </Flex>
          </Flex>
          {resultsStale && (
            <Text as="p" size="1" color="amber" mt="2">
              Workspace edited — results are from the last run.
            </Text>
          )}
        </Card>
      </header>

      <main className="workspace-layout">
        <section className="workspace-column">
          <Card size="3" className="workspace-card">
            <div className="workspace-card-content">
              <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
                <div>
                  <Heading size="5">Investigation workspace <Badge size="2" color="amber" variant="soft">Live preview</Badge></Heading>
                  <Text as="p" size="2" color="gray">
                    Build the analysis as a chain of steps, then run it and inspect the
                    named tables and plots. The process is iterative — edit, rerun, refine.
                  </Text>
                </div>
                {/* <Badge size="2" color="amber" variant="soft">
                  Live preview
                </Badge> */}
              </Flex>
              <BlocklyWorkspace workspaceVersion={workspaceVersion} />
            </div>
          </Card>
        </section>

        <section className="code-column">
          <Card size="3" className="workspace-card tabs-card">
            <div className="tabs-header" role="tablist" aria-label="Workspace panels">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'data'}
                className={`tabs-tab${activeTab === 'data' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('data')}
              >
                Data &amp; Output
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'code'}
                className={`tabs-tab${activeTab === 'code' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                Generated Python
              </button>
            </div>
            <div className="tabs-content" role="tabpanel">
              {activeTab === 'data' && (
                <div className="data-output-panel">
                  <DataView variables={variables} />
                  <OutputView
                    output={output}
                    status={status}
                    isBusy={isBusy}
                    images={images}
                    dataFiles={dataFiles}
                    systemOutput={systemOutput}
                    onClear={clearOutput}
                  />
                </div>
              )}
              {activeTab === 'code' && (
                <pre className="python-preview">
                  <code>{generatedCode}</code>
                </pre>
              )}
            </div>
          </Card>
        </section>
      </main>

      {showReflection && (
        <Card size="2" className="reflection-card">
          <Flex align="center" justify="between" gap="3">
            <Heading size="4">Reflect on the evidence</Heading>
            <Button
              type="button"
              variant="ghost"
              color="gray"
              size="1"
              onClick={dismissReflection}
              aria-label="Dismiss reflection prompts"
              title="Dismiss reflection prompts"
            >
              Dismiss
            </Button>
          </Flex>
          <Text as="p" size="2" color="gray" mt="1">
            Separate what the data shows from what it cannot tell you. Use these prompts
            to guide the discussion.
          </Text>
          <ul className="reflection-list">
            <li>What is the difference between the highest and lowest sampled station means?</li>
            <li>Which coverage or sensor-siting differences could affect that result?</li>
            <li>
              What additional evidence would support an explanation involving trees, surfaces,
              water, or buildings?
            </li>
            <li>What would longer-term and matched-time data reveal?</li>
            <li>What other evidence is needed before choosing cooling interventions?</li>
            <li>Which claims about vulnerable groups cannot be derived from these sensor data?</li>
          </ul>
        </Card>
      )}
    </Box>
  )
}

export default App
