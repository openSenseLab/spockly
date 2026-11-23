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

function Node({ node, path, label, info, depth }: { node: JsonNode; path: Path; label: string; info: JsonInfo; depth: number }) {
  const t = useT()
  const isRows = samePath(path, info.recordsPath) && node.type.includes('array')
  // The geometry field lives inside the items of the rows array.
  const isGeometry = info.kind === 'json' && !!info.geometryKey && samePath(path, [...(info.recordsPath ?? []), '[]', info.geometryKey])
  const children = [
    ...(node.children ?? []).map((child) => ({ node: child, label: child.key ?? '', key: child.key ?? '' })),
    ...(node.items ? [{ node: node.items, label: t.inspect.structure.eachItem, key: '[]' }] : []),
  ]

  const header = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1">
      <span className={cn('font-mono text-sm', node.items && label === t.inspect.structure.eachItem ? 'text-ink-500 italic' : 'font-medium text-ink-800')}>
        {label}
      </span>
      <TypeBadges node={node} />
      {isRows && <Marker tone="brand" label={t.inspect.structure.rows} hint={t.inspect.structure.rowsHint} />}
      {isGeometry && <Marker tone="red" label={t.inspect.structure.geometry} hint={t.inspect.structure.geometryHint} />}
      {node.example !== undefined && <span className="truncate font-mono text-xs text-ink-400">{JSON.stringify(node.example)}</span>}
      {node.truncated && <span className="text-xs text-ink-400 italic">{t.inspect.structure.truncated}</span>}
    </span>
  )

  if (!children.length) return <div className="pl-5">{header}</div>

  return (
    <details open={depth < 2} className="group/node">
      <summary className="flex cursor-pointer list-none items-start gap-1 rounded-md hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-2 size-4 shrink-0 text-ink-400 transition-transform group-open/node:rotate-90" />
        {header}
      </summary>
      <div className="ml-2 border-l border-ink-200 pl-3">
        {children.map((child) => (
          <Node key={child.key} node={child.node} path={[...path, child.key]} label={child.label} info={info} depth={depth + 1} />
        ))}
      </div>
    </details>
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
      <div className="max-h-[480px] overflow-auto rounded-xl bg-white p-3 ring-1 ring-ink-200">
        <Node node={info.structure} path={[]} label="JSON" info={info} depth={0} />
      </div>
    </div>
  )
}
