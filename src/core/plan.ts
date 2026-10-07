/**
 * Workspace → Plan. Framework-free: works on any block-like objects, so it can
 * be tested without Blockly (Blockly.Block satisfies PlanBlock).
 */
import type { Plan, PlanStep, Strand, Warning } from './types'

export interface PlanBlock {
  id: string
  type: string
  isEnabled(): boolean
  getNextBlock(): PlanBlock | null
}

/** Turns one block into a plan step; one entry per block type. */
export type StepGenerator = (block: PlanBlock) => PlanStep

export interface PlanInput {
  /** Top-level blocks of the workspace (each starts a stack). */
  topBlocks: PlanBlock[]
  generators: Record<string, StepGenerator>
  /** Block types that start a strand (load blocks, drawn with a hat). */
  hatTypes: ReadonlySet<string>
}

export interface PlanResult {
  plan: Plan
  /** Warnings per block id. */
  warnings: Record<string, Warning[]>
}

export function buildPlan({ topBlocks, generators, hatTypes }: PlanInput): PlanResult {
  const strands: Strand[] = []
  const warnings: PlanResult['warnings'] = {}

  for (const top of topBlocks) {
    if (!hatTypes.has(top.type)) {
      // Blocks without data above them: tell the student on the first one.
      // Blocks without a generator (e.g. the dev toolbox) aren't part of the plan.
      if (generators[top.type]) {
        warnings[top.id] = [{ code: 'plan.needsData', severity: 'warning' }]
      }
      continue
    }

    const steps: PlanStep[] = []
    for (let block: PlanBlock | null = top; block; block = block.getNextBlock()) {
      const generate = generators[block.type]
      if (generate) steps.push(generate(block))
    }
    strands.push({ id: top.id, steps })
  }

  return { plan: { strands }, warnings }
}
