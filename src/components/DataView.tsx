import { useState } from 'react'
import { Badge, Flex, Text } from '@radix-ui/themes'
import type { DataPreview } from '../hooks/usePythonRunner'

type DataViewProps = {
  variables: DataPreview[]
}

/**
 * Parse a CSV preview string into rows of cells, handling quoted fields that
 * contain commas (e.g. station names) and preserving empty trailing cells.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

/** Render a CSV preview string as a simple HTML table (first rows). */
function CsvPreviewTable({ csv }: { csv: string }) {
  const lines = csv.trim().split('\n')
  const header = lines[0] ? parseCsvLine(lines[0]) : []
  const rows = lines.slice(1, 11).map((line) => parseCsvLine(line))

  return (
    <div className="data-preview-table-wrap">
      <table className="data-preview-table">
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={index}>{cell.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_, colIndex) => (
                <td key={colIndex}>{row[colIndex]?.trim() ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataItem({ item }: { item: DataPreview }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="data-item">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Flex align="center" gap="2" wrap="wrap">
          <Text as="span" size="2" weight="medium" className="data-item-name">
            {item.name}
          </Text>
          <Badge size="1" color="gray" variant="soft">
            {item.rowCount} × {item.columnCount}
          </Badge>
        </Flex>
        <button
          type="button"
          className="data-item-toggle"
          onClick={() => setShowPreview((value) => !value)}
        >
          {showPreview ? 'Hide' : 'Preview'}
        </button>
      </Flex>
      {showPreview && <CsvPreviewTable csv={item.csvPreview} />}
    </div>
  )
}

export function DataView({ variables }: DataViewProps) {
  const hasData = variables.length > 0

  return (
    <div className="data-view">
      {!hasData && (
        <Text as="p" size="2" color="gray">
          Run the generated Python to see loaded variables.
        </Text>
      )}

      {variables.length > 0 && (
        <div className="data-section">
          <Flex align="center" gap="2" mb="2">
            <Text as="span" size="2" weight="bold">
              Variables
            </Text>
            <Badge size="1" color="gray" variant="soft">
              {variables.length}
            </Badge>
          </Flex>
          {variables.map((item) => (
            <DataItem key={item.name} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
