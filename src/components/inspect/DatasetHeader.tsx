import { Database } from 'lucide-react'
import type { ReactNode } from 'react'

import { format, useLanguageStore, useT } from '../../i18n'
import type { CellOutput } from '../../journal/types'
import { useSourceLabel } from '../editor/sourceLabel'

/** "stations · 60 rows · 9 columns · Example: …" above a dataset's inspection panel. */
export function DatasetHeader({ output, action }: { output: Extract<CellOutput, { type: 'inspection' }>; action?: ReactNode }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const sourceLabel = useSourceLabel()
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 font-mono text-sm font-semibold text-ink-900 ring-1 ring-ink-200">
        <Database className="size-3.5 text-data-600" />
        {output.profile.name}
      </span>
      <span className="text-sm text-ink-500">
        {format(t.viewer.datasetSummary, {
          rows: output.profile.rows.toLocaleString(language),
          columns: output.profile.columns.length,
        })}
      </span>
      <span className="truncate text-sm text-ink-400">{sourceLabel(output.source)}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}
