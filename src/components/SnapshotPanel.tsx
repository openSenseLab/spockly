import { Box, Callout, Flex, Heading, Text } from '@radix-ui/themes'

import { blockText, datasetNameOf, datasetOf } from '../blocks/program'
import { adviceFor } from '../blocks/advice'
import { ranAsItIs } from '../blocks/runState'
import { formatNumber, t } from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { getActiveWorkspace } from './blockly/carryWorkspace'
import { DataPreview } from './DataPreview'

/**
 * What the data looked like after the selected block in the last run: a text
 * answer, JSON, or a table. Students click block after block to follow how
 * each step changes the data.
 */
/** While a run is under way, the previous run's Zwischenstand stays, marked as being updated. */
export function SnapshotPanel({ busy }: { busy: boolean }) {
  const selectedId = useAppStore((state) => state.selectedBlockId)
  const snapshots = useAppStore((state) => state.snapshots)
  const block = selectedId ? (getActiveWorkspace()?.getBlockById(selectedId) ?? null) : null
  const dataset = block ? datasetOf(block) : null
  const snapshot = selectedId ? snapshots[selectedId] : undefined
  const lastRun = useAppStore((state) => state.lastRun)
  const filesVersion = useAppStore((state) => state.filesVersion)
  // Read so the panel follows every change to the blocks.
  useAppStore((state) => state.runCode)
  // Changed since the run (the block, or a step above it): this Zwischenstand is old.
  const current = !block || !lastRun || ranAsItIs(block, lastRun.signatures, snapshots, filesVersion)
  // E.g. a table of one row, from GeoJSON: why, and which block fits.
  const advice = block && current ? adviceFor(block, snapshots) : null

  if (!block || !dataset) {
    return (
      <Text as="p" size="2" color="gray">
        {t('snapshot.pickStep')}
      </Text>
    )
  }

  return (
    <Flex direction="column" gap="3" className="snapshot-panel">
      <Box>
        <Text as="div" size="1" color="gray">
          {t('snapshot.after', { dataset: datasetNameOf(dataset) })}
        </Text>
        <Heading size="3">{blockText(block)}</Heading>
        {busy && (
          <Text as="div" size="1" color="gray">
            {t('snapshot.updating')}
          </Text>
        )}
      </Box>
      {advice && !busy && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{advice}</Callout.Text>
        </Callout.Root>
      )}
      {snapshot && !busy && !current && (
        <Callout.Root color="blue" size="1">
          <Callout.Text>{t('snapshot.old')}</Callout.Text>
        </Callout.Root>
      )}
      {!snapshot && !busy && (
        <Text as="p" size="2" color="gray">
          {t('snapshot.runFirst')}
        </Text>
      )}
      {snapshot?.art === 'tabelle' && (
        <>
          <Text size="2">{t('snapshot.isTable')}</Text>
          <DataPreview fill columns={snapshot.spalten} types={snapshot.typen} rows={snapshot.zeilen} total={snapshot.anzahl} />
        </>
      )}
      {snapshot && snapshot.art !== 'tabelle' && (
        <>
          <Text size="2">
            {t(`snapshot.is.${snapshot.art}`, { count: snapshot.anzahl === null ? '' : formatNumber(snapshot.anzahl) })}
          </Text>
          <pre className="snapshot-text">{snapshot.text}</pre>
        </>
      )}
    </Flex>
  )
}
