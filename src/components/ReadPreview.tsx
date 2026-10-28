import { Badge, Flex, Select, Text } from '@radix-ui/themes'

import { guessTable, type Delimiter, type ReadResult } from '../core/tabular'
import { formatNumber, t } from '../i18n'

/** Enough rows to guess the column types for the preview. */
const PREVIEW_ROWS = 500
const DELIMITER_KEYS: Record<Delimiter, string> = { ';': 'read.semicolon', ',': 'read.comma', '\t': 'read.tab' }

/**
 * What was read from a file or web address: format, rows and the guessed
 * type of each column. For CSV, the delimiter can be changed.
 */
export function ReadPreview({ read, onDelimiter }: { read: ReadResult; onDelimiter: (delimiter: Delimiter) => void }) {
  const { columns } = guessTable(read.fields, read.records, PREVIEW_ROWS)
  const format =
    read.format === 'csv' ? 'CSV'
    : read.format === 'geojson' ? 'GeoJSON'
    : read.path?.length ? t('read.jsonAt', { path: read.path.join('.') })
    : 'JSON'
  return (
    <Flex direction="column" gap="2" className="read-preview">
      <Text size="2">
        <Text weight="bold">{format}</Text> ·{' '}
        {t('read.rowsColumns', { rows: formatNumber(read.records.length), columns: formatNumber(columns.length) })}
      </Text>
      {read.format === 'csv' && (
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="1" color="gray">
            {t('read.delimiter')}
          </Text>
          <Select.Root size="1" value={read.delimiter} onValueChange={(d) => onDelimiter(d as Delimiter)}>
            <Select.Trigger aria-label={t('read.delimiter')} />
            <Select.Content>
              {(Object.keys(DELIMITER_KEYS) as Delimiter[]).map((d) => (
                <Select.Item key={d} value={d}>
                  {t(DELIMITER_KEYS[d])}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Text size="1" color="gray">
            {t('read.delimiterHint')}
          </Text>
        </Flex>
      )}
      <Flex gap="1" wrap="wrap" role="list" aria-label={t('read.columns')}>
        {columns.slice(0, 40).map((c) => (
          <Badge key={c.name} role="listitem" color="gray" variant="soft" size="1">
            {c.name} <Text color="gray">· {t(`semantic.${c.semanticType}`)}</Text>
          </Badge>
        ))}
        {columns.length > 40 && (
          <Text size="1" color="gray">
            {t('read.moreColumns', { count: formatNumber(columns.length - 40) })}
          </Text>
        )}
      </Flex>
      <Text size="1" color="gray">
        {t('read.guessHint')}
      </Text>
    </Flex>
  )
}
