import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Heading,
  Link,
  Progress,
  Table,
  Text,
} from '@radix-ui/themes'

import { summarizeTable, type ColumnSummary } from '../core/summary'
import type { ColumnMeta, DataTable, SemanticType } from '../core/types'
import { formatDate, formatNumber, pick, t } from '../i18n'
import { glossaryForColumn } from '../glossary'
import { selectShownStrandId, useAppStore } from '../store/useAppStore'
import { GlossaryInfo } from './GlossaryInfo'

const PREVIEW_ROWS = 20

type BadgeColor = 'blue' | 'violet' | 'orange' | 'green' | 'gray'

const semanticColor: Record<SemanticType, BadgeColor> = {
  measurement: 'blue',
  category: 'violet',
  timestamp: 'orange',
  latitude: 'green',
  longitude: 'green',
  identifier: 'gray',
  text: 'gray',
}

function formatValue(value: unknown, column: ColumnMeta): string {
  if (typeof value === 'number') return formatNumber(value)
  if (column.dataType === 'date' && typeof value === 'string') return formatDate(value)
  return String(value)
}

const distinctText = (summary: ColumnSummary) =>
  summary.distinct === 1
    ? t('column.distinctOne')
    : t('column.distinct', { count: formatNumber(summary.distinct) })

function ColumnOverview({ summary }: { summary: ColumnSummary }) {
  if (summary.filled === 0) {
    return <Text color="gray">{t('column.empty')}</Text>
  }
  if (summary.numeric) {
    const { min, max, mean } = summary.numeric
    const unit = summary.column.unit ? ` ${summary.column.unit}` : ''
    return (
      <Flex direction="column">
        <Text>{t('column.range', { min: formatNumber(min), max: formatNumber(max) }) + unit}</Text>
        {summary.column.semanticType === 'measurement' && (
          <Text color="gray">{t('column.mean', { mean: formatNumber(mean) }) + unit}</Text>
        )}
      </Flex>
    )
  }
  if (summary.time) {
    const first = formatDate(summary.time.first)
    const last = formatDate(summary.time.last)
    return <Text>{first === last ? first : t('column.timeRange', { first, last })}</Text>
  }
  // Frequent values only tell something if a value repeats.
  const repeats = (summary.topValues?.[0]?.count ?? 0) > 1
  if (summary.topValues && repeats && summary.column.semanticType === 'category') {
    return (
      <Flex direction="column" gap="1">
        <Flex gap="1" wrap="wrap">
          {summary.topValues.map(({ value, count }) => (
            <Badge key={value} variant="surface" color="gray" className="value-chip">
              {value} · {formatNumber(count)}
            </Badge>
          ))}
        </Flex>
        <Text color="gray">{distinctText(summary)}</Text>
      </Flex>
    )
  }
  return <Text color="gray">{distinctText(summary)}</Text>
}

/** Columns whose values stay hidden until a prediction is revealed. */
type Hidden = ReadonlySet<string>

function HiddenValue() {
  return <Text color="violet">🔒 {t('dataset.hiddenForPrediction')}</Text>
}

function ColumnsTable({ table, hidden }: { table: DataTable; hidden: Hidden }) {
  const summaries = useMemo(() => summarizeTable(table), [table])
  const rowCount = table.rows.length

  return (
    <Table.Root size="1" variant="surface" className="dataset-table">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{t('column.name')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('column.kind')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('column.filled')}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{t('column.overview')}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {summaries.map((summary) => {
          const { column } = summary
          const label = pick(column.label) ?? column.name
          const description = pick(column.description)
          const filledShare = rowCount ? (summary.filled / rowCount) * 100 : 0
          return (
            <Table.Row key={column.name}>
              <Table.RowHeaderCell>
                <Text weight="medium" title={description}>
                  {label}
                </Text>{' '}
                <GlossaryInfo entry={glossaryForColumn(column)} />
                {label !== column.name && (
                  <Text as="div" size="1" color="gray" className="column-name">
                    {column.name}
                  </Text>
                )}
              </Table.RowHeaderCell>
              <Table.Cell>
                <Badge color={semanticColor[column.semanticType]} variant="soft">
                  {t(`semantic.${column.semanticType}`)}
                </Badge>
              </Table.Cell>
              <Table.Cell className="filled-cell">
                <Progress
                  value={filledShare}
                  size="1"
                  color={summary.missing ? 'amber' : 'grass'}
                  aria-label={t('column.filled')}
                />
                {summary.missing > 0 && (
                  <Text as="div" size="1" color="amber">
                    {t('column.missing', { count: formatNumber(summary.missing) })}
                  </Text>
                )}
              </Table.Cell>
              <Table.Cell>
                {hidden.has(column.name) ? <HiddenValue /> : <ColumnOverview summary={summary} />}
              </Table.Cell>
            </Table.Row>
          )
        })}
      </Table.Body>
    </Table.Root>
  )
}

function RowsPreview({ table, hidden }: { table: DataTable; hidden: Hidden }) {
  const rows = table.rows.slice(0, PREVIEW_ROWS)
  return (
    <Box className="preview-scroll">
      <Table.Root size="1" variant="surface" className="dataset-table preview-table">
        <Table.Header>
          <Table.Row>
            {table.columns.map((column) => (
              <Table.ColumnHeaderCell key={column.name}>
                {pick(column.label) ?? column.name}
              </Table.ColumnHeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row, index) => (
            <Table.Row key={index}>
              {table.columns.map((column) => {
                const value = row[column.name]
                const missing = value === null || value === undefined || value === ''
                return (
                  <Table.Cell key={column.name} className={missing ? 'cell-missing' : undefined}>
                    {hidden.has(column.name) ? '?' : missing ? '–' : formatValue(value, column)}
                  </Table.Cell>
                )
              })}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

function DatasetCard({ table, hidden }: { table: DataTable; hidden: Hidden }) {
  const [expanded, setExpanded] = useState(false)
  const { meta } = table
  const loaded = table.rows.length
  const total = meta.totalRecords ?? loaded
  const description = pick(meta.description)

  return (
    <Flex direction="column" gap="3">
      <Box>
        <Heading size="4">{pick(meta.title) ?? meta.id}</Heading>
        <Flex gap="2" mt="2" wrap="wrap" align="center">
          <Badge color={loaded < total ? 'amber' : 'grass'} variant="soft" size="2">
            {loaded < total
              ? t('dataset.rowsLoaded', { loaded: formatNumber(loaded), total: formatNumber(total) })
              : t('dataset.rowsLoadedAll', { loaded: formatNumber(loaded) })}
          </Badge>
          <Badge color="gray" variant="soft" size="2">
            {t('dataset.columnCount', { count: table.columns.length })}
          </Badge>
        </Flex>
      </Box>

      {loaded < total && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{t('dataset.partial')}</Callout.Text>
        </Callout.Root>
      )}

      <dl className="dataset-facts">
        <dt>{t('dataset.source')}</dt>
        <dd>
          {meta.source.url ? (
            <Link href={meta.source.url} target="_blank" rel="noreferrer">
              {meta.source.name}
            </Link>
          ) : (
            meta.source.name
          )}
          {meta.attribution && <Text color="gray"> · {meta.attribution}</Text>}
        </dd>
        {meta.collectedBy && (
          <>
            <dt>{t('dataset.collectedBy')}</dt>
            <dd>{meta.collectedBy}</dd>
          </>
        )}
        {meta.source.license && (
          <>
            <dt>{t('dataset.license')}</dt>
            <dd>
              {meta.source.licenseUrl ? (
                <Link href={meta.source.licenseUrl} target="_blank" rel="noreferrer">
                  {meta.source.license}
                </Link>
              ) : (
                meta.source.license
              )}
            </dd>
          </>
        )}
        {meta.updated && (
          <>
            <dt>{t('dataset.updated')}</dt>
            <dd>{formatDate(meta.updated)}</dd>
          </>
        )}
      </dl>

      {description && (
        <Box>
          <Text as="p" size="2" className={expanded ? 'dataset-description' : 'dataset-description clamped'}>
            {description}
          </Text>
          <Button size="1" variant="ghost" mt="1" onClick={() => setExpanded((e) => !e)}>
            {expanded ? t('dataset.lessDescription') : t('dataset.moreDescription')}
          </Button>
        </Box>
      )}

      {meta.keywords && meta.keywords.length > 0 && (
        <Flex gap="1" wrap="wrap">
          {meta.keywords.map((keyword) => (
            <Badge key={keyword} variant="outline" color="gray">
              {keyword}
            </Badge>
          ))}
        </Flex>
      )}

      <Heading size="3" mt="2">
        {t('dataset.columns')}
      </Heading>
      <ColumnsTable table={table} hidden={hidden} />

      <Flex align="baseline" gap="2" mt="2">
        <Heading size="3">{t('dataset.preview')}</Heading>
        <Text size="1" color="gray">
          {t('dataset.previewOf', {
            shown: formatNumber(Math.min(PREVIEW_ROWS, loaded)),
            loaded: formatNumber(loaded),
          })}
        </Text>
      </Flex>
      <RowsPreview table={table} hidden={hidden} />
    </Flex>
  )
}

export function DatasetPanel() {
  const loads = useAppStore((state) => state.loads)
  const shownId = useAppStore(selectShownStrandId)
  const hiddenColumns = useAppStore((state) => state.hiddenColumns)

  const load = shownId ? loads[shownId] : undefined

  if (!load) {
    return (
      <Text as="p" size="2" color="gray">
        {t('dataset.empty')}
      </Text>
    )
  }

  if (load.status === 'loading') {
    return (
      <Flex direction="column" gap="2">
        <Text size="2">
          {load.progress
            ? t(load.progress.unit === 'stations' ? 'dataset.loadingStations' : 'dataset.loadingRows', {
                done: formatNumber(load.progress.done),
                total: formatNumber(load.progress.total),
              })
            : t('dataset.loading')}
        </Text>
        <Progress
          value={load.progress ? (load.progress.done / Math.max(1, load.progress.total)) * 100 : undefined}
        />
      </Flex>
    )
  }

  if (load.status === 'error') {
    return (
      <Callout.Root color="red">
        <Callout.Text>{t(load.errorCode)}</Callout.Text>
      </Callout.Root>
    )
  }

  return <DatasetCard table={load.table} hidden={new Set(shownId ? hiddenColumns[shownId] : [])} />
}
