import { Flex, Text } from '@radix-ui/themes'

/**
 * Persistent, context-aware guide that frames the block categories as a
 * data-science process (Obtain → Scrub → Explore → Interpret).
 *
 * This is the pedagogical backbone of the tool: it makes the clustering of
 * blocks explicit so learners understand *where* a block fits in the workflow,
 * not just *what* it does. It stays in view (per Blockly design guidance) and
 * does not block the workspace.
 */

type ProcessStage = {
  id: string
  label: string
  color: string
  categories: string[]
  description: string
}

const PROCESS_STAGES: ProcessStage[] = [
  {
    id: 'obtain',
    label: 'Obtain',
    color: '#0d9488',
    categories: ['Data'],
    description: 'Bring the measurements and station locations in.',
  },
  {
    id: 'scrub',
    label: 'Scrub',
    color: '#0284c7',
    categories: ['Transform'],
    description: 'Clean it: fix types, handle missing values, filter, deduplicate.',
  },
  {
    id: 'explore',
    label: 'Explore',
    color: '#7c3aed',
    categories: ['Observe'],
    description: 'Summarize, compare stations, and aggregate over time to find patterns.',
  },
  {
    id: 'interpret',
    label: 'Interpret',
    color: '#ea580c',
    categories: ['Visualize', 'Export', 'Print'],
    description: 'Produce a plot, then interpret what it shows. Export to share.',
  },
]

export function ProcessGuide() {
  return (
    <div className="process-guide" role="note" aria-label="Data science process">
      <Flex align="center" gap="2" mb="2" wrap="wrap">
        <Text as="span" size="2" weight="bold">
          Iterative investigation
        </Text>
        <Text as="span" size="2" color="gray">
          Move through the steps, then revisit them as your questions change.
        </Text>
      </Flex>
      <div className="process-stages">
        {PROCESS_STAGES.map((stage, index) => (
          <div key={stage.id} className="process-stage">
            <div
              className="process-stage-marker"
              style={{ backgroundColor: stage.color }}
            >
              <span className="process-stage-number">{index + 1}</span>
            </div>
            <div className="process-stage-body">
              <Text as="span" size="2" weight="bold" style={{ color: stage.color }}>
                {stage.label}
              </Text>
              <Text as="span" size="1" color="gray" className="process-stage-cats">
                {stage.categories.join(' · ')}
              </Text>
              <Text as="span" size="1" color="gray" className="process-stage-desc">
                {stage.description}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
