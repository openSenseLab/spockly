import { Card, Flex, Heading, Text } from '@radix-ui/themes'

import type { View } from '../core/fromPython'
import { t } from '../i18n'
import { DataPreview } from './DataPreview'
import { MapPreview } from './MapPreview'
import { TimeChart } from './TimeChart'

const NONE_HIDDEN: ReadonlySet<string> = new Set()
/** Rows a "zeige als Tabelle" block shows; the table in Python stays whole. */
const TABLE_ROWS = 100

function ViewCard({ view }: { view: View }) {
  const { table, raw, kind, title, options } = view
  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Heading size="3">{t(`view.title.${kind}`, { name: title })}</Heading>
        {kind === 'tabelle' && (
          <DataPreview columns={raw.spalten} types={raw.typen} rows={raw.zeilen.slice(0, TABLE_ROWS)} total={raw.anzahl} />
        )}
        {kind === 'karte' && <MapPreview table={table} hidden={NONE_HIDDEN} />}
        {kind === 'zeitverlauf' && <TimeChart table={table} hidden={NONE_HIDDEN} groupBy={options.je ?? undefined} />}
      </Flex>
    </Card>
  )
}

/** What the program's "zeige …" blocks showed in the last run, in order. */
export function ResultsPanel({ views, ran }: { views: View[]; ran: boolean }) {
  if (views.length === 0) {
    return (
      <Text as="p" size="2" color="gray">
        {t(ran ? 'results.noViews' : 'results.runFirst')}
      </Text>
    )
  }
  return (
    <Flex direction="column" gap="4">
      {views.map((view, i) => (
        <ViewCard key={i} view={view} />
      ))}
    </Flex>
  )
}
