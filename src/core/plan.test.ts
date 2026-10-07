import { describe, expect, it } from 'vitest'

import { buildPlan, type PlanBlock, type StepGenerator } from './plan'

// Minimal stand-ins for Blockly blocks.
interface FakeBlock extends PlanBlock {
  fields: Record<string, string>
}

let nextId = 0

function stack(...specs: [type: string, fields?: Record<string, string>, enabled?: boolean][]) {
  const blocks: FakeBlock[] = specs.map(([type, fields = {}, enabled = true]) => ({
    id: `${type}-${nextId++}`,
    type,
    fields,
    isEnabled: () => enabled,
    getNextBlock: () => null,
  }))
  blocks.forEach((block, i) => (block.getNextBlock = () => blocks[i + 1] ?? null))
  return blocks
}

const generate: StepGenerator = (block) => ({
  id: block.id,
  op: block.type,
  params: { ...(block as FakeBlock).fields },
  disabled: !block.isEnabled() || undefined,
})

const plan = (...stacks: FakeBlock[][]) =>
  buildPlan({
    topBlocks: stacks.map((s) => s[0]),
    generators: { load: generate, filter: generate },
    hatTypes: new Set(['load']),
  })

describe('buildPlan', () => {
  it('makes one strand per hat block, with steps in stack order', () => {
    const a = stack(['load', { dataset: 'a' }], ['filter', { column: 'x' }])
    const b = stack(['load', { dataset: 'b' }])
    const { plan: result, warnings } = plan(a, b)

    expect(result.strands).toHaveLength(2)
    expect(result.strands[0].id).toBe(a[0].id)
    expect(result.strands[0].steps.map((s) => s.op)).toEqual(['load', 'filter'])
    expect(result.strands[0].steps[0].params).toEqual({ dataset: 'a' })
    expect(result.strands[1].steps).toHaveLength(1)
    expect(warnings).toEqual({})
  })

  it('warns on stacks that do not start with data', () => {
    const orphan = stack(['filter'], ['filter'])
    const { plan: result, warnings } = plan(orphan)
    expect(result.strands).toHaveLength(0)
    expect(warnings[orphan[0].id]).toEqual([{ code: 'plan.needsData', severity: 'warning' }])
    expect(warnings[orphan[1].id]).toBeUndefined()
  })

  it('ignores blocks that are not part of the plan', () => {
    const devBlock = stack(['controls_if'])
    const a = stack(['load'], ['text_print'], ['filter'])
    const { plan: result, warnings } = plan(devBlock, a)
    expect(warnings).toEqual({})
    expect(result.strands[0].steps.map((s) => s.op)).toEqual(['load', 'filter'])
  })

  it('keeps disabled blocks in the plan, marked as disabled', () => {
    const a = stack(['load'], ['filter', {}, false])
    const { plan: result } = plan(a)
    expect(result.strands[0].steps[1].disabled).toBe(true)
  })
})
