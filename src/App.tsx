import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes'

import './App.css'
import { BlocklyWorkspace } from './components/BlocklyWorkspace'
import { usePythonRunner, type PythonRunStatus } from './hooks/usePythonRunner'
import { useAppStore } from './store/useAppStore'

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
  const totalBlocks = useAppStore((state) => state.totalBlocks)
  const topLevelBlocks = useAppStore((state) => state.topLevelBlocks)
  const workspaceVersion = useAppStore((state) => state.workspaceVersion)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const { clearOutput, isBusy, output, run, status, stop } = usePythonRunner()

  const runButtonLabel =
    status === 'loading' ? 'Stop loading' : status === 'running' ? 'Stop execution' : 'Run code'

  return (
    <Box className="app-shell">
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

        <section className="code-column">
          <Card size="3" className="code-card">
            <div className="code-card-content">
              <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Heading size="5">Generated Python</Heading>
                <Button
                  type="button"
                  color={isBusy ? 'red' : 'grass'}
                  onClick={() => (isBusy ? stop() : run(generatedCode))}
                >
                  {runButtonLabel}
                </Button>
              </Flex>
              <Text as="p" size="2" color="gray" mb="3">
                The code preview updates from the Zustand-backed workspace state as you
                change the blocks.
              </Text>
              <pre className="python-preview">
                <code>{generatedCode}</code>
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
        </section>
      </main>
    </Box>
  )
}

export default App
