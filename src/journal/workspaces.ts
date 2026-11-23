import { toIdentifier } from '../blockly/python'
import type { InspectRequest } from '../kernel/protocol'

/** Helpers to build serialized Blockly workspaces (used for defaults and the example journal). */

export type BlockState = {
  type: string
  fields?: Record<string, string | number>
  inputs?: Record<string, unknown>
  next?: unknown
}

const chain = (blocks: BlockState[]) =>
  blocks.reduceRight<object | undefined>(
    (next, block) => ({ block: { ...block, ...(next ? { next } : {}) } }),
    undefined,
  )

const workspace = (top: object[]) => ({ blocks: { languageVersion: 0, blocks: top } })

/** One "use dataset" pipeline with a chain of steps. */
export const pipelineWorkspace = (dataset: string, steps: BlockState[]) => {
  const stepChain = chain(steps)
  return workspace([
    { type: 'spk_pipeline', x: 24, y: 24, fields: { DATASET: dataset }, inputs: stepChain ? { STEPS: stepChain } : {} },
  ])
}

/** A stack of load blocks for a data cell. */
export const loadWorkspace = (loads: BlockState[]) => workspace([{ x: 24, y: 24, ...(chain(loads) as { block: object }).block }])

export const loadExample = (example: string, name = example): BlockState => ({
  type: 'spk_load_example',
  fields: { EXAMPLE: example, NAME: name },
})

/** Every dataset name created by load blocks in a serialized workspace. */
export const loadedNames = (state: unknown): string[] => {
  const names: string[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      const record = node as { type?: unknown; fields?: { NAME?: unknown } }
      if (typeof record.type === 'string' && record.type.startsWith('spk_load_') && record.fields?.NAME) {
        names.push(String(record.fields.NAME))
      }
      Object.values(node).forEach(visit)
    }
  }
  visit(state)
  return names
}

const SOURCES: Record<string, { kind: InspectRequest['kind']; field: string }> = {
  spk_load_example: { kind: 'example', field: 'EXAMPLE' },
  spk_load_url: { kind: 'url', field: 'URL' },
  spk_load_file: { kind: 'file', field: 'FILE' },
  spk_load_gis_file: { kind: 'file', field: 'FILE' },
  spk_load_gis_url: { kind: 'url', field: 'URL' },
}

/** The datasets a data block's workspace loads, so Python can profile them after running. */
export const inspectRequests = (state: unknown): InspectRequest[] => {
  const requests = new Map<string, InspectRequest>()
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === 'object') {
      const record = node as { type?: unknown; fields?: Record<string, unknown> }
      const source = typeof record.type === 'string' ? SOURCES[record.type] : undefined
      if (source && record.fields?.NAME) {
        const name = toIdentifier(String(record.fields.NAME))
        if (!requests.has(name)) requests.set(name, { name, kind: source.kind, ref: String(record.fields[source.field] ?? '') })
      }
      Object.values(node).forEach(visit)
    }
  }
  visit(state)
  return [...requests.values()]
}
