import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Flex,
  Heading,
  Select,
  Separator,
  Text,
} from '@radix-ui/themes'

import './App.css'
import { BlocklyWorkspace } from './components/BlocklyWorkspace'
import { lessons } from './data/lessons'
import { useAppStore } from './store/useAppStore'

function App() {
  const activeLessonId = useAppStore((state) => state.activeLessonId)
  const generatedCode = useAppStore((state) => state.generatedCode)
  const totalBlocks = useAppStore((state) => state.totalBlocks)
  const topLevelBlocks = useAppStore((state) => state.topLevelBlocks)
  const workspaceVersion = useAppStore((state) => state.workspaceVersion)
  const setActiveLesson = useAppStore((state) => state.setActiveLesson)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)

  const lesson = lessons.find(({ id }) => id === activeLessonId) ?? lessons[0]

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
            A lightweight Blockly workspace for learning spatial data science with Python,
            GeoPandas, and interactive lesson prompts.
          </Text>
        </div>
        <Card size="2" className="hero-metadata">
          <Text as="p" size="2" color="gray">
            Active dataset bundle
          </Text>
          <Code size="3">{lesson.dataset}</Code>
          <Separator my="3" size="4" />
          <Text as="p" size="2" color="gray">
            Objective
          </Text>
          <Text as="p" mt="2">
            {lesson.objective}
          </Text>
        </Card>
      </header>

      <main className="workspace-layout">
        <aside className="sidebar">
          <Card size="3">
            <Heading size="4">Lesson path</Heading>
            <Text as="p" size="2" color="gray" mt="2">
              Choose a starter exercise and reload the seeded blocks at any time.
            </Text>
            <Flex direction="column" gap="3" mt="4">
              <Select.Root value={lesson.id} onValueChange={setActiveLesson}>
                <Select.Trigger />
                <Select.Content>
                  {lessons.map((entry) => (
                    <Select.Item key={entry.id} value={entry.id}>
                      {entry.title}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <Button type="button" variant="soft" onClick={resetWorkspace}>
                Reset lesson blocks
              </Button>
            </Flex>
          </Card>

          <Card size="3">
            <Heading size="4">Spatial workflow summary</Heading>
            <div className="stat-grid">
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
            </div>
            <Text as="p" size="2" color="gray">
              Use sequential statement blocks to model a reproducible geospatial notebook pipeline.
            </Text>
          </Card>

          <Card size="3">
            <Heading size="4">Focus areas</Heading>
            <Flex gap="2" wrap="wrap" mt="3">
              {lesson.focusAreas.map((topic) => (
                <Badge key={topic} color="cyan" variant="surface">
                  {topic}
                </Badge>
              ))}
            </Flex>
            <Separator my="4" size="4" />
            <ol className="prompt-list">
              {lesson.prompts.map((prompt) => (
                <li key={prompt}>
                  <Text as="span">{prompt}</Text>
                </li>
              ))}
            </ol>
          </Card>
        </aside>

        <section className="main-column">
          <Card size="3" className="workspace-card">
            <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
              <div>
                <Heading size="5">Blockly lab</Heading>
                <Text as="p" size="2" color="gray">
                  Drag spatial analysis blocks, then inspect the generated Python below.
                </Text>
              </div>
              <Badge size="2" color="amber" variant="soft">
                {lesson.title}
              </Badge>
            </Flex>
            <BlocklyWorkspace
              starterXml={lesson.starterXml}
              workspaceVersion={workspaceVersion}
            />
          </Card>

          <Card size="3">
            <Heading size="5">Generated Python</Heading>
            <Text as="p" size="2" color="gray" mb="3">
              The code preview updates from the Zustand-backed workspace state.
            </Text>
            <pre className="python-preview">
              <code>{generatedCode}</code>
            </pre>
          </Card>
        </section>
      </main>
    </Box>
  )
}

export default App
