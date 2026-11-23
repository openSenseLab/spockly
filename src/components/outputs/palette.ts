/** Validated categorical slots (fixed order, never cycled) and a one-hue sequential ramp. */
export const CATEGORICAL = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
]
export const OTHER = '#9a9893'
export const SEQUENTIAL = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b']
export const NEUTRAL_MARK = CATEGORICAL[0]

export const formatNumber = (value: unknown, language: string) =>
  typeof value === 'number'
    ? value.toLocaleString(language, { maximumFractionDigits: Math.abs(value) < 10 ? 3 : 2 })
    : value === null || value === undefined
      ? '–'
      : String(value)
