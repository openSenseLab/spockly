import { ChevronRight, Info } from 'lucide-react'

import { format, useT } from '../../i18n'
import type { JsonInfo, JsonNode } from '../../journal/types'
import { Badge, Callout, Tooltip, type Tone } from '../ui'
import { cn } from '../ui/styles'

const TYPE_TONES: Record<string, Tone> = {
  object: 'purple',
  array: 'orange',
  string: 'green',
  number: 'blue',
  boolean: 'brown',
  null: 'gray',
}

/** Where a node sits, so the rows array and the geometry field can be highlighted. */
type Path = string[]

/** Clicking a node selects it (the Select tab); the selected node is highlighted. */
export type TreeSelection = { selected: Path | null; onSelect: (path: Path) => void }

const samePath = (a: Path, b: Path | null) => !!b && a.length === b.length && a.every((key, i) => key === b[i])

function TypeBadges({ node }: { node: JsonNode }) {
  const t = useT()
  return (
    <>
      {[...new Set(node.type.split('|'))].map((type) => (
        <Badge key={type} tone={TYPE_TONES[type] ?? 'gray'} className="font-mono">
          {type === 'array' ? '[ ]' : type === 'object' ? '{ }' : type}
        </Badge>
      ))}
      {node.length !== undefined && (
        <span className="text-xs text-ink-500">
          {node.length === 1 ? t.inspect.structure.itemsOne : format(t.inspect.structure.items, { count: node.length.toLocaleString() })}
        </span>
      )}
      {node.children && (
        <span className="text-xs text-ink-400">
          {node.children.length === 1 ? t.inspect.structure.fieldsOne : format(t.inspect.structure.fields, { count: node.children.length })}
        </span>
      )}
    </>
  )
}

function Marker({ tone, label, hint }: { tone: Tone; label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      <span>
        <Badge tone={tone} className="font-semibold">
          → {label}
        </Badge>
      </span>
    </Tooltip>
  )
}

type NodeProps = { node: JsonNode; path: Path; label: string; info: JsonInfo; depth: number; select?: TreeSelection }

function Node({ node, path, label, info, depth, select }: NodeProps) {
  const t = useT()
  const isRows = samePath(path, info.recordsPath) && node.type.includes('array')
  // The geometry field lives inside the items of the rows array.
  const isGeometry = info.kind === 'json' && !!info.geometryKey && samePath(path, [...(info.recordsPath ?? []), '[]', info.geometryKey])
  const children = [
    ...(node.children ?? []).map((child) => ({ node: child, label: child.key ?? '', key: child.key ?? '' })),
    ...(node.items ? [{ node: node.items, label: t.inspect.structure.eachItem, key: '[]' }] : []),
  ]

  const labelClass = cn('font-mono text-sm', path.at(-1) === '[]' ? 'text-ink-500 italic' : 'font-medium text-ink-800')
  const selected = !!select && samePath(path, select.selected)
  const header = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1">
      {select ? (
        <button
          type="button"
          aria-pressed={selected}
          className={cn(
            labelClass,
            'cursor-pointer rounded-md px-1.5 py-0.5 ring-1 transition-colors',
            selected ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-ink-200 hover:bg-brand-50 hover:ring-brand-300',
          )}
          onClick={(event) => {
            // Inside <summary>: select without folding the node.
            event.preventDefault()
            select.onSelect(path)
          }}
        >
          {label}
        </button>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      <TypeBadges node={node} />
      {isRows && <Marker tone="brand" label={t.inspect.structure.rows} hint={t.inspect.structure.rowsHint} />}
      {isGeometry && <Marker tone="red" label={t.inspect.structure.geometry} hint={t.inspect.structure.geometryHint} />}
      {node.example !== undefined && <span className="truncate font-mono text-xs text-ink-400">{JSON.stringify(node.example)}</span>}
      {node.truncated && <span className="text-xs text-ink-400 italic">{t.inspect.structure.truncated}</span>}
    </span>
  )

  if (!children.length) return <div className="pl-5">{header}</div>

  return (
    <details open={depth < 2} className="[&[open]>summary>.chevron]:rotate-90">
      <summary className="flex cursor-pointer list-none items-start gap-1 rounded-md hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
        {/* Only this entry's own open state turns the arrow (not an open parent). */}
        <ChevronRight className="chevron mt-2 size-4 shrink-0 text-ink-400 transition-transform" />
        {header}
      </summary>
      <div className="ml-2 border-l border-ink-200 pl-3">
        {children.map((child) => (
          <Node key={child.key} node={child.node} path={[...path, child.key]} label={child.label} info={info} depth={depth + 1} select={select} />
        ))}
      </div>
    </details>
  )
}

/** The bare tree, optionally with selectable nodes. */
export function JsonTree({ info, select }: { info: JsonInfo; select?: TreeSelection }) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-xl bg-white p-3 ring-1 ring-ink-200">
      <Node node={info.structure} path={[]} label="JSON" info={info} depth={0} select={select} />
    </div>
  )
}

/** Collapsible tree of a JSON source: keys, types, list lengths, examples. */
export function JsonStructure({ info, columns }: { info: JsonInfo; columns: string[] }) {
  const t = useT()
  const flattened = columns.find((column) => column.includes('.'))
  return (
    <div className="space-y-3">
      <Callout tone="gray" icon={<Info />}>
        <p>{t.inspect.structure.intro}</p>
        {info.kind === 'geojson' && <p className="mt-1">{t.inspect.structure.geojson}</p>}
        {info.kind === 'json' && flattened && <p className="mt-1">{format(t.inspect.structure.flattened, { example: flattened })}</p>}
      </Callout>
      <JsonTree info={info} />
    </div>
  )
}
