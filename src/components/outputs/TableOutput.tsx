import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'

import { format, useLanguageStore, useT } from '../../i18n'
import type { FieldInfo } from '../../journal/types'
import { formatNumber } from './palette'

type Props = {
  columns: FieldInfo[]
  rows: Record<string, unknown>[]
  totalRows: number
  showKinds?: boolean
}

export function TableOutput({ columns, rows, totalRows, showKinds = true }: Props) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const [sort, setSort] = useState<{ column: string; descending: boolean } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const direction = sort.descending ? -1 : 1
    return [...rows].sort((a, b) => {
      const left = a[sort.column]
      const right = b[sort.column]
      if (left === right) return 0
      if (left === null || left === undefined) return 1
      if (right === null || right === undefined) return -1
      return (left < right ? -1 : 1) * direction
    })
  }, [rows, sort])

  const toggleSort = (column: string) =>
    setSort((current) =>
      current?.column === column ? (current.descending ? null : { column, descending: true }) : { column, descending: false },
    )

  return (
    <div className="min-w-0">
      <div className="max-h-[420px] overflow-auto rounded-xl bg-white ring-1 ring-ink-200">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.name} scope="col">
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1 hover:text-brand-700"
                    onClick={() => toggleSort(column.name)}
                    title={t.outputs.sortHint}
                  >
                    {column.name}
                    {sort?.column === column.name &&
                      (sort.descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                  </button>
                  {showKinds && <span className="block text-[11px] font-normal text-ink-400">{t.kinds[column.kind].label}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => {
                  const value = row[column.name]
                  return (
                    <td key={column.name} className={typeof value === 'number' ? 'numeric' : value == null ? 'missing' : undefined}>
                      {formatNumber(value, language)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">
        {format(rows.length < totalRows ? t.outputs.rowsShownOf : t.outputs.rowsShown, {
          shown: rows.length.toLocaleString(language),
          total: totalRows.toLocaleString(language),
        })}
      </p>
    </div>
  )
}
