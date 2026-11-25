import { create } from 'zustand'

export type PickValue = string | number | boolean

export type PickRequest = {
  column: string
  /** Dialog title; defaults to "Values of <column>". */
  title?: string
  /** Values the column has (empty when Python has not run yet). */
  options: PickValue[]
  selected: PickValue[]
  done: (values: PickValue[]) => void
}

/** Open request of the value picker dialog (rendered by ValuePickerDialog). */
export const useValuePicker = create<{ request: PickRequest | null }>(() => ({ request: null }))

export const openValuePicker = (request: PickRequest) => useValuePicker.setState({ request })

/** The field stores the chosen values as a JSON array. */
export const parseValues = (text: string): PickValue[] => {
  try {
    const parsed = JSON.parse(text || '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is PickValue => ['string', 'number', 'boolean'].includes(typeof v)) : []
  } catch {
    return []
  }
}
