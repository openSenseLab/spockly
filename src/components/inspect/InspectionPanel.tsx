import { Braces, Columns3, LayoutGrid, ListChecks, Map as MapIcon, Table2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { format, useLanguageStore, useT } from '../../i18n'
import type { ColumnKind, ColumnProfile, DatasetProfile } from '../../journal/types'
import { singleLayer } from '../outputs/mapLayers'
import { MapOutput } from '../outputs/MapOutput'
import { formatNumber } from '../outputs/palette'
import { TableOutput } from '../outputs/TableOutput'
import { Badge, HoverCard, Tabs, TabsContent, TabsList, TabsTrigger, type Tone } from '../ui'
import { cardClass, cn } from '../ui/styles'
import { InspectionQuiz } from './InspectionQuiz'
import { JsonStructure } from './JsonStructure'

const KIND_TONES: Record<ColumnKind, Tone> = {
  number: 'blue',
  category: 'orange',
  text: 'gray',
  date: 'green',
  boolean: 'purple',
  geometry: 'brown',
}

/** Column type label; hovering explains what the type means. */
export function KindBadge({ kind }: { kind: ColumnKind }) {
  const t = useT()
  return (
    <HoverCard
      trigger={
        <button type="button" className="cursor-help rounded-md">
          <Badge tone={KIND_TONES[kind]}>{t.kinds[kind].label}</Badge>
        </button>
      }
    >
      <p className="font-semibold text-ink-900">{t.kinds[kind].label}</p>
      <p className="mt-1">{t.kinds[kind].explanation}</p>
    </HoverCard>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={cn(cardClass, 'p-3.5')}>
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</p>
      {hint && <p className="truncate text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

function MiniHistogram({ bins }: { bins: NonNullable<ColumnProfile['histogram']> }) {
  const max = Math.max(...bins.map((bin) => bin.count), 1)
  return (
    <div className="mt-3 flex h-10 items-end gap-0.5" aria-hidden>
      {bins.map((bin, index) => (
        <span
          key={index}
          className="flex-1 rounded-t-sm bg-brand-300/80"
          style={{ height: `${Math.max(6, (bin.count / max) * 100)}%` }}
          title={`${bin.start.toFixed(2)} – ${bin.end.toFixed(2)}: ${bin.count}`}
        />
      ))}
    </div>
  )
}

function ColumnCard({ column, rows }: { column: ColumnProfile; rows: number }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const n = (value: unknown) => formatNumber(value, language)
  const missingShare = rows ? Math.round((column.missing / rows) * 100) : 0

  return (
    <div className={cn(cardClass, 'p-3.5')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-mono text-sm font-semibold break-all text-ink-900">{column.name}</p>
        <KindBadge kind={column.kind} />
      </div>
      <p className={cn('mt-1 text-xs', column.missing ? 'font-medium text-amber-600' : 'text-ink-500')}>
        {format(t.inspect.missingOf, { missing: column.missing, share: missingShare })}
        <span className="text-ink-300"> · </span>
        <span className="font-normal text-ink-500">{format(t.inspect.uniqueValues, { unique: column.unique })}</span>
      </p>
      {column.kind === 'number' && column.mean !== undefined && (
        <>
          {column.histogram && <MiniHistogram bins={column.histogram} />}
          <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
            {(
              [
                [t.inspect.min, column.min],
                [t.inspect.mean, column.mean],
                [t.inspect.max, column.max],
                [t.inspect.median, column.median],
                [t.inspect.std, column.std],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex gap-1">
                <dt className="text-ink-400">{label}</dt>
                <dd className="font-medium text-ink-700 tabular-nums">{n(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {column.kind === 'date' && (
        <p className="mt-2 text-xs font-medium text-ink-700">
          {String(column.min).slice(0, 10)} → {String(column.max).slice(0, 10)}
        </p>
      )}
      {column.top && (
        <ul className="mt-3 space-y-1">
          {column.top.map((entry) => (
            <li key={entry.value} className="flex items-center gap-2 text-xs">
              <span className="h-1.5 shrink-0 rounded-full bg-orange-300" style={{ width: `${Math.max(4, (entry.count / rows) * 45)}%` }} />
              <span className="truncate text-ink-700">{entry.value}</span>
              <span className="ml-auto text-ink-400 tabular-nums">{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Props = {
  profile: DatasetProfile
  solved?: string[]
  onSolve?: (questionId: string) => void
}

export function InspectionPanel({ profile, solved, onSolve }: Props) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const missingCells = profile.columns.reduce((sum, column) => sum + column.missing, 0)
  const kinds = [...new Set(profile.columns.map((column) => column.kind))]
  const quiz = onSolve && solved

  return (
    <Tabs defaultValue={quiz ? 'check' : 'overview'}>
      <TabsList>
        {quiz && (
          <TabsTrigger value="check">
            <ListChecks /> {t.inspect.tabs.check}
          </TabsTrigger>
        )}
        <TabsTrigger value="overview">
          <LayoutGrid /> {t.inspect.tabs.overview}
        </TabsTrigger>
        <TabsTrigger value="columns">
          <Columns3 /> {t.inspect.tabs.columns}
        </TabsTrigger>
        {profile.json && (
          <TabsTrigger value="structure">
            <Braces /> {t.inspect.tabs.structure}
          </TabsTrigger>
        )}
        <TabsTrigger value="preview">
          <Table2 /> {t.inspect.tabs.preview}
        </TabsTrigger>
        {profile.mapPreview && (
          <TabsTrigger value="map">
            <MapIcon /> {t.inspect.tabs.map}
          </TabsTrigger>
        )}
      </TabsList>

      {quiz && (
        <TabsContent value="check">
          <InspectionQuiz profile={profile} solved={solved} onSolve={onSolve} />
        </TabsContent>
      )}

      <TabsContent value="overview">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <Stat label={t.inspect.rows} value={profile.rows.toLocaleString(language)} hint={t.inspect.rowsHint} />
          <Stat label={t.inspect.columns} value={profile.columns.length} hint={t.inspect.columnsHint} />
          <Stat label={t.inspect.missingCells} value={missingCells.toLocaleString(language)} hint={t.inspect.missingHint} />
          <Stat
            label={t.inspect.spatial}
            value={profile.spatial ? t.common.yes : t.common.no}
            hint={profile.geometryTypes.join(', ') || t.inspect.spatialHint}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          {t.inspect.kindsPresent}
          {kinds.map((kind) => (
            <KindBadge key={kind} kind={kind} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="columns">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {profile.columns.map((column) => (
            <ColumnCard key={column.name} column={column} rows={profile.rows} />
          ))}
        </div>
      </TabsContent>

      {profile.json && (
        <TabsContent value="structure">
          <JsonStructure info={profile.json} columns={profile.columns.map((column) => column.name)} />
        </TabsContent>
      )}

      <TabsContent value="preview">
        <TableOutput columns={profile.columns.map(({ name, kind }) => ({ name, kind }))} rows={profile.preview} totalRows={profile.rows} />
      </TabsContent>

      {profile.mapPreview && (
        <TabsContent value="map">
          <MapOutput layers={[singleLayer(profile.mapPreview)]} height={320} />
        </TabsContent>
      )}
    </Tabs>
  )
}
