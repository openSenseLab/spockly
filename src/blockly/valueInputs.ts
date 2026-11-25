import type * as Blockly from 'blockly'

/**
 * Settings of analysis blocks that accept a value block (an extracted value, a number,
 * a calculation). Each slot holds a shadow block with the default, so the block works as
 * before; dropping a value block on it replaces the shadow. The check is Blockly's type
 * check: a text value does not fit a slot that needs a number.
 */

export type ValueType = 'Number' | 'String' | 'Boolean'

type Slot = { input: string; check: string[]; shadow: 'math_number' | 'text'; value: number | string }

const numberSlot = (input: string, value: number): Slot => ({ input, check: ['Number'], shadow: 'math_number', value })

export const VALUE_SLOTS: Record<string, Slot[]> = {
  // Compared with a column of any kind: the literal is written to match the column.
  // Another column of the same kind works too ("pm10 > pm25").
  spk_filter: [{ input: 'VALUE', check: ['Number', 'String', 'Boolean', 'NumberColumn', 'StringColumn', 'BooleanColumn'], shadow: 'text', value: '' }],
  spk_rows: [numberSlot('FROM', 1), numberSlot('TO', 10)],
  spk_head: [numberSlot('N', 10)],
  spk_round: [numberSlot('DIGITS', 1)],
  spk_near: [numberSlot('KM', 2), numberSlot('LAT', 51.96), numberSlot('LON', 7.63)],
  spk_distance: [numberSlot('LAT', 51.96), numberSlot('LON', 7.63)],
  spk_buffer: [numberSlot('METRES', 500)],
  spk_grid: [numberSlot('KM', 1)],
}

const slotOf = (type: string, input: string) => VALUE_SLOTS[type]?.find((slot) => slot.input === input)

/** Argument for a block definition: an inline value input with the slot's check. */
export const valueSlot = (type: string, input: string) => ({ type: 'input_value', name: input, check: slotOf(type, input)?.check })

const shadowState = (slot: Slot, value: unknown = slot.value) =>
  slot.shadow === 'math_number'
    ? { type: 'math_number', fields: { NUM: Number(value) || 0 } }
    : { type: 'text', fields: { TEXT: String(value ?? '') } }

/** Give every empty slot of a new block its default shadow. */
export const addDefaultShadows = (block: Blockly.Block) => {
  for (const slot of VALUE_SLOTS[block.type] ?? []) {
    const connection = block.getInput(slot.input)?.connection
    if (connection && !connection.getShadowState()) connection.setShadowState(shadowState(slot))
  }
}

/**
 * Workspaces saved before these settings became inputs store them as fields
 * ({"fields": {"KM": 2}}). Move such values into the slot's shadow block so nothing is lost.
 */
export const migrateValueSlots = <T>(state: T): T => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit)
    if (!node || typeof node !== 'object') return node
    const record = Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)])) as {
      type?: unknown
      fields?: Record<string, unknown>
      inputs?: Record<string, unknown>
    }
    const slots = typeof record.type === 'string' ? VALUE_SLOTS[record.type] : undefined
    if (!slots || !record.fields) return record
    const fields = { ...record.fields }
    const inputs = { ...(record.inputs ?? {}) }
    for (const slot of slots) {
      if (!(slot.input in fields)) continue
      if (!inputs[slot.input]) inputs[slot.input] = { shadow: shadowState(slot, fields[slot.input]) }
      delete fields[slot.input]
    }
    return { ...record, fields, inputs }
  }
  return visit(state) as T
}

/** The typed literal sitting in a slot's shadow, or undefined when a value block is plugged in. */
export const shadowValue = (block: Blockly.Block, input: string): string | undefined => {
  const target = block.getInputTargetBlock(input)
  if (!target) return slotOf(block.type, input) ? String(slotOf(block.type, input)!.value) : undefined
  if (!target.isShadow()) return undefined
  return String(target.getFieldValue(target.type === 'math_number' ? 'NUM' : 'TEXT') ?? '')
}
