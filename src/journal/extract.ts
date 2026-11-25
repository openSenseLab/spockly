import type { JsonNode } from './types'

/**
 * Selecting parts of a loaded dataset ("take … as dataset / value").
 *
 * A JSON path is a list of keys; "[]" steps into the items of an array, e.g.
 * ["boxes", "[]", "sensors"] = the sensors list of every box. The structure
 * summary from Python (JsonNode) tells what sits at a path, which decides how
 * the selection becomes a table:
 *
 * - records: the path ends at objects (array items, or one object per outer item) → one row per object
 * - values: the path ends at plain values inside a list → a one-column table
 * - fields: the path ends at a single object outside any list → one row per field (key, value)
 * - value: the path ends at a single plain value → a variable, not a table
 */

export const EACH = '[]'

export type JsonPath = string[]
export type Shape = 'records' | 'values' | 'fields'

/**
 * What the "take list" block stores: the path to the row units and how rows are built.
 * For lists the path ends with "[]" (each item is a row); a path ending with a key inside
 * list items (features › each › properties) gives one row per outer item.
 */
export type TableSelection = { path: JsonPath; shape: Shape }

/** Something in a JSON structure that can be taken. */
export type Choice =
  | { kind: 'table'; selection: TableSelection; columns: string[]; rows?: number }
  | { kind: 'value'; path: JsonPath; example?: string }

const types = (node: JsonNode) => node.type.split('|')
const isArray = (node: JsonNode) => types(node).includes('array')
const isObject = (node: JsonNode) => types(node).includes('object') && !isArray(node)

export const nodeAt = (root: JsonNode, path: JsonPath): JsonNode | null => {
  let node: JsonNode | undefined = root
  for (const key of path) {
    if (!node) return null
    node = key === EACH ? node.items : node.children?.find((child) => child.key === key)
  }
  return node ?? null
}

/** Column names json_normalize produces for objects shaped like `node` ("a.b" for nested objects). */
export const flatColumns = (node: JsonNode | null | undefined, prefix = ''): string[] => {
  if (!node?.children) return []
  return node.children.flatMap((child) => {
    const name = `${prefix}${child.key ?? ''}`
    return isObject(child) && child.children?.length ? flatColumns(child, `${name}.`) : [name]
  })
}

/** Selecting "each item" of a list means the same as selecting the list. */
const trimEach = (path: JsonPath) => {
  const trimmed = [...path]
  while (trimmed.at(-1) === EACH) trimmed.pop()
  return trimmed
}

const lastKey = (path: JsonPath) => [...path].reverse().find((key) => key !== EACH) ?? 'value'

/** What selecting the node at `path` would give, or null if it cannot be taken (e.g. only nulls). */
export const choiceAt = (root: JsonNode, rawPath: JsonPath): Choice | null => {
  const path = trimEach(rawPath)
  const node = nodeAt(root, path)
  if (!node) return null
  const insideList = path.includes(EACH)

  if (isArray(node)) {
    const items = node.items
    if (!items || isArray(items)) return null
    const units = [...path, EACH]
    // The length is exact only for a list outside other lists (otherwise: the longest one).
    const rows = insideList ? undefined : node.length
    if (isObject(items)) return { kind: 'table', selection: { path: units, shape: 'records' }, columns: flatColumns(items), rows }
    return { kind: 'table', selection: { path: units, shape: 'values' }, columns: [toColumnName(lastKey(path))], rows }
  }
  if (isObject(node)) {
    if (insideList) return { kind: 'table', selection: { path, shape: 'records' }, columns: flatColumns(node) }
    const children = node.children ?? []
    const nested = children.length > 0 && children.every(isObject)
    // Lookup tables such as {"2024-01": 3, "2024-02": 5} or {"A": {...}, "B": {...}}: one row per key.
    const merged = nested ? [...new Set(children.flatMap((child) => flatColumns(child)))] : ['value']
    return { kind: 'table', selection: { path, shape: 'fields' }, columns: ['key', ...merged] }
  }
  if (node.type === 'null') return null
  if (insideList) return { kind: 'table', selection: { path, shape: 'values' }, columns: [toColumnName(lastKey(path))] }
  return { kind: 'value', path, example: node.example }
}

/** Every path in the structure that can be taken as a table (for the block dropdown). */
export const tableChoices = (root: JsonNode) => allChoices(root).filter((choice) => choice.kind === 'table')

/** Every single value outside lists (for the block dropdown). */
export const valueChoices = (root: JsonNode) => allChoices(root).filter((choice) => choice.kind === 'value')

const allChoices = (root: JsonNode): Choice[] => {
  const result: Choice[] = []
  const seen = new Set<string>()
  const visit = (node: JsonNode, path: JsonPath) => {
    const choice = choiceAt(root, path)
    const key = choice ? JSON.stringify(choice.kind === 'table' ? choice.selection.path : choice.path) : ''
    if (choice && !seen.has(key)) {
      seen.add(key)
      result.push(choice)
    }
    for (const child of node.children ?? []) visit(child, [...path, child.key ?? ''])
    if (node.items) visit(node.items, [...path, EACH])
  }
  visit(root, [])
  return result
}

/** Readable path for labels: "boxes › each › sensors". */
export const describePath = (path: JsonPath, each: string, whole: string) =>
  path.length ? path.map((key) => (key === EACH ? each : key)).join(' › ') : whole

/** A good default dataset or value name for a selection. */
export const suggestName = (path: JsonPath, fallback: string) => toColumnName(lastKey(trimEach(path))) || fallback

const toColumnName = (key: string) => key.trim()

export const parseSelection = (text: string): TableSelection | null => {
  try {
    const parsed = JSON.parse(text) as Partial<TableSelection>
    if (Array.isArray(parsed.path) && ['records', 'values', 'fields'].includes(String(parsed.shape))) return parsed as TableSelection
  } catch {
    // not set yet
  }
  return null
}

export const parsePath = (text: string): JsonPath | null => {
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) && parsed.every((key) => typeof key === 'string') ? parsed : null
  } catch {
    return null
  }
}

// --- Python -------------------------------------------------------------------------

const py = (value: string) => JSON.stringify(value)

/** Split a path at its list steps: ["a", "[]", "b", "c"] → [["a"], ["b", "c"]]. */
const segments = (path: JsonPath) =>
  path.reduce<string[][]>(
    (parts, key) => {
      if (key === EACH) parts.push([])
      else parts[parts.length - 1].push(key)
      return parts
    },
    [[]],
  )

/** Strict access from the top: data["a"]["b"]. A missing key is an error the learner should see. */
const strict = (base: string, keys: string[]) => base + keys.map((key) => `[${py(key)}]`).join('')

/** Forgiving access inside list items, where some items may lack a field: item.get("a"), (….get("a") or {}).get("b"). */
const lenient = (base: string, keys: string[]) =>
  keys.reduce((expression, key, index) => (index === 0 ? `${expression}.get(${py(key)})` : `(${expression} or {}).get(${py(key)})`), base)

/**
 * Python expression for what a table selection takes from `source` (the parsed JSON):
 * a list (records, values) or a dict (fields).
 */
export const pythonRows = (source: string, { path, shape }: TableSelection) => {
  const parts = segments(path)
  if (parts.length === 1) return strict(source, parts[0])
  // A single list taken as it is: data["boxes"]
  if (parts.length === 2 && parts[1].length === 0) return strict(source, parts[0])

  const loops: string[] = []
  let current = source
  parts.slice(0, -1).forEach((keys, index) => {
    const name = index === 0 ? 'item' : `item${index + 1}`
    const iterable = index === 0 ? strict(current, keys) : keys.length ? `(${lenient(current, keys)} or [])` : current
    loops.push(`for ${name} in ${iterable}`)
    current = name
  })
  const last = parts.at(-1)!
  let value = last.length ? lenient(current, last) : current
  if (shape === 'records' && last.length) value = `${value} or {}`
  return `[${value} ${loops.join(' ')}]`
}

/** Python code that builds the table `name` from a selection, keeping the chosen columns (all when empty). */
export const pythonTable = (name: string, source: string, selection: TableSelection, columns: string[]) => {
  const rows = pythonRows(source, selection)
  const column = toColumnName(lastKey(selection.path))
  const select = columns.length ? `[[${columns.map(py).join(', ')}]]` : ''
  switch (selection.shape) {
    case 'records':
      return `${name} = pd.json_normalize(${rows})${select}\n`
    case 'values':
      return `${name} = pd.DataFrame({${py(column)}: ${rows}})${select}\n`
    case 'fields':
      return (
        `${name} = pd.json_normalize(\n` +
        `    [{"key": key, **(value if isinstance(value, dict) else {"value": value})} for key, value in ${rows}.items()]\n` +
        `)${select}\n`
      )
  }
}

/** Python code that stores one value from the JSON as the variable `name`. */
export const pythonValue = (name: string, source: string, path: JsonPath) => `${name} = ${strict(source, path)}\n`

/** Python expression for the value at `path` outside any list: data["meta"]["total"]. */
export const pythonAt = (source: string, path: JsonPath) => strict(source, path)
