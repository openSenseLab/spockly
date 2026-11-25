import { Check, Columns3, Hash, Info, MousePointerClick, Plus, Sigma, X } from 'lucide-react'
import { useState } from 'react'

import { format, useT } from '../../i18n'
import { EACH, choiceAt, describePath, nodeAt, suggestName, valueChoices, type Choice, type JsonPath } from '../../journal/extract'
import type { ColumnKind, DatasetProfile, JsonNode, Selection, SelectionRef } from '../../journal/types'
import { newId } from '../../utils/id'
import { Button, Callout, Segmented } from '../ui'
import { cardClass, cn, inputClass } from '../ui/styles'
import { JsonTree } from './JsonStructure'

/** The journal's (or lab's) named blocks and how to change them. */
export type SelectProps = {
  selections: Selection[]
  add: (selections: Selection[]) => void
  remove: (id: string) => void
}

type Props = SelectProps & { profile: DatasetProfile }

/** Something picked in a form, before it gets an id and a unique name. */
type Pick = { name: string; output: Selection['output']; ref: SelectionRef; type?: string }

type ValueChoice = Extract<Choice, { kind: 'value' }>

// Blockly checks: values have the plain type, columns the "…Column" variant (see blocks.ts).
const VALUE_TYPES: Record<string, string> = { number: 'Number', string: 'String', boolean: 'Boolean' }
const COLUMN_TYPES: Record<string, string> = { number: 'NumberColumn', text: 'StringColumn', category: 'StringColumn', boolean: 'BooleanColumn' }
const JSON_KINDS: Record<string, ColumnKind> = { number: 'number', string: 'text', boolean: 'boolean' }
const NUMERIC_AGGS = ['count', 'nunique', 'mean', 'median', 'sum', 'std']

const jsonValueType = (node: JsonNode | null) => VALUE_TYPES[node?.type ?? '']
const jsonColumnType = (node: JsonNode | null) => (node && VALUE_TYPES[node.type] ? `${VALUE_TYPES[node.type]}Column` : undefined)

const labelClass = 'mb-1 block text-xs font-semibold tracking-wide text-ink-500 uppercase'

/** Turn picks into selections with names unique among the existing ones: temperature, temperature_2, … */
const named = (picks: Pick[], existing: Selection[]): Selection[] => {
  const taken = new Set(existing.map((selection) => selection.name))
  return picks.map((pick) => {
    const base = pick.name.trim() || 'value'
    let name = base
    for (let n = 2; taken.has(name); n++) name = `${base}_${n}`
    taken.add(name)
    return { ...pick, name, id: newId() }
  })
}

function Checklist({
  items,
  chosen,
  onChange,
  title,
}: {
  items: { id: string; label: string; detail?: string; kind?: ColumnKind }[]
  chosen: Set<string>
  onChange: (chosen: Set<string>) => void
  title: string
}) {
  const t = useT()
  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
          {title} ({chosen.size}/{items.length})
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(new Set(items.map((item) => item.id)))}>
          {t.inspect.select.all}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange(new Set())}>
          {t.inspect.select.none}
        </Button>
      </div>
      <ul className="max-h-64 overflow-y-auto rounded-xl bg-white ring-1 ring-ink-200">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-brand-50">
              <input type="checkbox" className="size-4 accent-brand-600" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-mono">{item.label}</span>
                {item.detail !== undefined && <span className="text-ink-400"> = {item.detail}</span>}
              </span>
              {item.kind && <span className="text-xs text-ink-400">{t.kinds[item.kind].label}</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NameInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT()
  return (
    <label className="block">
      <span className={labelClass}>{t.inspect.select.name}</span>
      <input className={cn(inputClass, 'font-mono')} value={value} onChange={(event) => onChange(event.target.value)} />
      <span className="mt-1 block text-xs text-ink-400">{t.inspect.select.nameHint}</span>
    </label>
  )
}

/** One block (a value outside lists, or one value per list item) with a name to edit. */
function SingleForm({ pick, onAdd }: { pick: Pick; onAdd: (picks: Pick[]) => void }) {
  const t = useT()
  const [name, setName] = useState(pick.name)
  return (
    <div className="space-y-3">
      <NameInput value={name} onChange={setName} />
      <Button variant="primary" disabled={!name.trim()} onClick={() => onAdd([{ ...pick, name }])}>
        <Plus /> {pick.output === 'column' ? t.inspect.select.addColumn : t.inspect.select.addValue}
      </Button>
    </div>
  )
}

/** Several fields at once: of each list item (column blocks) or of one object (value blocks). */
function FieldsForm({
  structure,
  base,
  fields,
  output,
  dataset,
  onAdd,
}: {
  structure: JsonNode
  base: JsonPath
  fields: { path: JsonPath; example?: string }[]
  output: Selection['output']
  dataset: string
  onAdd: (picks: Pick[]) => void
}) {
  const t = useT()
  const [chosen, setChosen] = useState<Set<string>>(() => new Set())
  const id = (path: JsonPath) => JSON.stringify(path)
  const items = fields.map((field) => ({
    id: id(field.path),
    label: field.path.slice(base.length).join('.'),
    detail: field.example,
    kind: JSON_KINDS[nodeAt(structure, field.path)?.type ?? ''],
  }))
  const add = () => {
    const picked = fields.filter((field) => chosen.has(id(field.path)))
    onAdd(
      picked.map((field): Pick => {
        const node = nodeAt(structure, field.path)
        return {
          name: suggestName(field.path, 'value'),
          output,
          ref: { kind: 'json', dataset, path: field.path },
          type: output === 'column' ? jsonColumnType(node) : jsonValueType(node),
        }
      }),
    )
    setChosen(new Set())
  }
  return (
    <div className="space-y-3">
      <Checklist items={items} chosen={chosen} onChange={setChosen} title={t.inspect.select.columns} />
      <Button variant="primary" disabled={chosen.size === 0} onClick={add}>
        <Plus /> {format(output === 'column' ? t.inspect.select.addColumns : t.inspect.select.addValues, { count: String(chosen.size) })}
      </Button>
    </div>
  )
}

/** Paths of the single-value fields of the objects at `path` (nested objects flattened: last.value). */
const fieldPaths = (structure: JsonNode, path: JsonPath): JsonPath[] => {
  const visit = (node: JsonNode | null, at: JsonPath): JsonPath[] =>
    (node?.children ?? []).flatMap((child) => {
      const next = [...at, child.key ?? '']
      const kinds = child.type.split('|')
      if (kinds.includes('object') && child.children?.length) return visit(child, next)
      return kinds.some((kind) => VALUE_TYPES[kind]) ? [next] : []
    })
  return visit(nodeAt(structure, path), path)
}

/** What to do with the node clicked in the JSON tree. */
function ChoicePanel({ profile, path, choice, onAdd }: { profile: DatasetProfile; path: JsonPath; choice: Choice; onAdd: (picks: Pick[]) => void }) {
  const t = useT()
  const structure = profile.json!.structure
  const describe = (p: JsonPath) => describePath(p, t.blocks.eachItem, t.blocks.wholeFile)

  if (choice.kind === 'value') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-700">{format(t.inspect.select.value, { example: choice.example ?? '…' })}</p>
        <SingleForm
          pick={{
            name: suggestName(path, 'value'),
            output: 'value',
            ref: { kind: 'json', dataset: profile.name, path: choice.path },
            type: jsonValueType(nodeAt(structure, choice.path)),
          }}
          onAdd={onAdd}
        />
      </div>
    )
  }

  const { selection } = choice
  const list = selection.path.at(-1) === EACH ? selection.path.slice(0, -1) : selection.path
  if (selection.shape === 'values') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-700">{format(t.inspect.select.column, { path: describe(list) })}</p>
        <SingleForm
          pick={{
            name: suggestName(selection.path, 'value'),
            output: 'column',
            ref: { kind: 'json', dataset: profile.name, path: selection.path },
            type: jsonColumnType(nodeAt(structure, selection.path)),
          }}
          onAdd={onAdd}
        />
      </div>
    )
  }

  if (selection.shape === 'records') {
    const fields = fieldPaths(structure, selection.path).map((p) => ({ path: p, example: nodeAt(structure, p)?.example }))
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-700">{format(t.inspect.select.fieldsOf, { path: describe(list) })}</p>
        <FieldsForm structure={structure} base={selection.path} fields={fields} output="column" dataset={profile.name} onAdd={onAdd} />
      </div>
    )
  }

  // An object outside lists: its single values.
  const values = valueChoices(structure).filter(
    (c): c is ValueChoice => c.kind === 'value' && c.path.length > selection.path.length && selection.path.every((key, i) => c.path[i] === key),
  )
  if (!values.length) return <p className="text-sm text-ink-500">{t.inspect.select.notTakeable}</p>
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">{format(t.inspect.select.properties, { path: describe(selection.path) })}</p>
      <FieldsForm
        structure={structure}
        base={selection.path}
        fields={values.map((c) => ({ path: c.path, example: c.example }))}
        output="value"
        dataset={profile.name}
        onAdd={onAdd}
      />
    </div>
  )
}

function FromStructure({ profile, onAdd }: { profile: DatasetProfile; onAdd: (picks: Pick[]) => void }) {
  const t = useT()
  const [path, setPath] = useState<JsonPath | null>(null)
  const json = profile.json!
  const choice = path ? choiceAt(json.structure, path) : null

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <JsonTree info={json} select={{ selected: path, onSelect: setPath }} />
      <div className={cn(cardClass, 'p-3.5 md:self-start')}>
        {!path && (
          <p className="flex items-start gap-2 text-sm text-ink-500">
            <MousePointerClick className="mt-0.5 size-4 shrink-0" /> {t.inspect.select.treeHint}
          </p>
        )}
        {path && !choice && <p className="text-sm text-ink-500">{t.inspect.select.notTakeable}</p>}
        {path && choice && <ChoicePanel key={JSON.stringify(path)} profile={profile} path={path} choice={choice} onAdd={onAdd} />}
      </div>
    </div>
  )
}

function FromColumns({ profile, onAdd }: { profile: DatasetProfile; onAdd: (picks: Pick[]) => void }) {
  const t = useT()
  const columns = profile.columns.filter((column) => column.kind !== 'geometry')
  const [chosen, setChosen] = useState<Set<string>>(() => new Set())
  const add = () => {
    onAdd(
      columns
        .filter((column) => chosen.has(column.name))
        .map(
          (column): Pick => ({
            name: column.name,
            output: 'column',
            ref: { kind: 'column', dataset: profile.name, column: column.name },
            type: COLUMN_TYPES[column.kind],
          }),
        ),
    )
    setChosen(new Set())
  }
  return (
    <div className={cn(cardClass, 'space-y-3 p-3.5')}>
      <p className="flex items-start gap-2 text-sm text-ink-700">
        <Columns3 className="mt-0.5 size-4 shrink-0 text-brand-600" /> {t.inspect.select.columnsHint}
      </p>
      <Checklist
        items={columns.map((column) => ({ id: column.name, label: column.name, kind: column.kind }))}
        chosen={chosen}
        onChange={setChosen}
        title={t.inspect.select.columns}
      />
      <Button variant="primary" disabled={chosen.size === 0} onClick={add}>
        <Plus /> {format(t.inspect.select.addColumns, { count: String(chosen.size) })}
      </Button>
    </div>
  )
}

/** A single value computed from a column (mean, maximum, first value, …): for any table. */
function StatForm({ profile, onAdd }: { profile: DatasetProfile; onAdd: (picks: Pick[]) => void }) {
  const t = useT()
  const columns = profile.columns.filter((column) => column.kind !== 'geometry')
  const numeric = columns.find((column) => column.kind === 'number')
  const [column, setColumn] = useState(numeric?.name ?? columns[0]?.name ?? '')
  const [agg, setAgg] = useState(numeric ? 'mean' : 'first')
  const [name, setName] = useState(`${agg}_${column}`)
  const [renamed, setRenamed] = useState(false)
  if (!columns.length) return null
  const kind = columns.find((c) => c.name === column)?.kind
  // Mean, sum, … only make sense for numbers; count, minimum, maximum and the first value work for all.
  const aggs = ['count', 'nunique', 'min', 'max', 'first', ...(kind === 'number' ? ['mean', 'median', 'sum', 'std'] : [])]

  const change = (nextAgg: string, nextColumn: string) => {
    const nextKind = columns.find((c) => c.name === nextColumn)?.kind
    const fixedAgg = nextKind !== 'number' && ['mean', 'median', 'sum', 'std'].includes(nextAgg) ? 'first' : nextAgg
    setAgg(fixedAgg)
    setColumn(nextColumn)
    if (!renamed) setName(`${fixedAgg}_${nextColumn}`)
  }
  const type = NUMERIC_AGGS.includes(agg) || kind === 'number' ? 'Number' : kind === 'boolean' ? 'Boolean' : 'String'

  return (
    <div className={cn(cardClass, 'space-y-3 p-3.5')}>
      <p className="flex items-start gap-2 text-sm font-semibold text-ink-700">
        <Sigma className="mt-0.5 size-4 shrink-0 text-brand-600" /> {t.inspect.select.statTitle}
      </p>
      <p className="text-xs text-ink-500">{t.inspect.select.statHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{t.inspect.select.statAgg}</span>
          <select className={inputClass} value={agg} onChange={(event) => change(event.target.value, column)}>
            {aggs.map((option) => (
              <option key={option} value={option}>
                {t.blocks.agg[option as keyof typeof t.blocks.agg]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t.inspect.select.statColumn}</span>
          <select className={cn(inputClass, 'font-mono')} value={column} onChange={(event) => change(agg, event.target.value)}>
            {columns.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <NameInput
        value={name}
        onChange={(value) => {
          setRenamed(true)
          setName(value)
        }}
      />
      <Button
        disabled={!name.trim() || !column}
        onClick={() => onAdd([{ name, output: 'value', ref: { kind: 'stat', dataset: profile.name, column, agg }, type }])}
      >
        <Plus /> {t.inspect.select.addValue}
      </Button>
    </div>
  )
}

/** The blocks already made from this dataset, each removable. */
function Existing({ selections, remove }: { selections: Selection[]; remove: (id: string) => void }) {
  const t = useT()
  if (!selections.length) return null
  return (
    <div>
      <span className={labelClass}>{t.inspect.select.existing}</span>
      <ul className="flex flex-wrap gap-1.5">
        {selections.map((selection) => (
          <li
            key={selection.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg py-0.5 pr-0.5 pl-2 font-mono text-xs text-white',
              // Same colours as the column and value blocks.
              selection.output === 'column' ? 'bg-[#0b7285]' : 'bg-[#4f6f86]',
            )}
          >
            {selection.output === 'column' ? <Columns3 className="size-3" /> : <Hash className="size-3" />}
            {selection.name}
            <button
              type="button"
              className="grid size-5 place-items-center rounded-md hover:bg-white/20"
              aria-label={format(t.inspect.select.remove, { name: selection.name })}
              onClick={() => remove(selection.id)}
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The "Select" tab: pick columns and values of a dataset. Each pick becomes a named block
 * in the analysis toolbox that reads directly from the dataset (stations["temperature"]);
 * no new dataset is created.
 */
export function DataSelector({ profile, selections, add, remove }: Props) {
  const t = useT()
  // GeoJSON is already one row per feature: its columns are what learners need there.
  const [mode, setMode] = useState<'structure' | 'columns'>(profile.json?.kind === 'json' ? 'structure' : 'columns')
  const [added, setAdded] = useState<string | null>(null)
  const own = selections.filter((selection) => selection.ref.dataset === profile.name)

  const onAdd = (picks: Pick[]) => {
    const fresh = named(picks, selections)
    add(fresh)
    setAdded(format(t.inspect.select.added, { names: fresh.map((selection) => selection.name).join(', ') }))
  }

  return (
    <div className="space-y-3">
      <Callout tone="gray" icon={<Info />}>
        {t.inspect.select.intro}
      </Callout>
      <Existing selections={own} remove={remove} />
      {profile.json && (
        <Segmented
          label={t.inspect.tabs.select}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'structure', label: t.inspect.select.fromStructure },
            { value: 'columns', label: t.inspect.select.fromColumns },
          ]}
        />
      )}
      {added && (
        <Callout tone="green" icon={<Check />}>
          {added}
        </Callout>
      )}
      {mode === 'structure' && profile.json ? (
        <FromStructure profile={profile} onAdd={onAdd} />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <FromColumns profile={profile} onAdd={onAdd} />
          <StatForm profile={profile} onAdd={onAdd} />
        </div>
      )}
    </div>
  )
}
