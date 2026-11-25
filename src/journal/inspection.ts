import type { DatasetProfile } from './types'

/**
 * Guided inspection questions, generated from the dataset profile.
 * They nudge learners to look at size, column types, missing values and geometry
 * before they start analysing.
 */
export type Question =
  | { id: 'rows'; kind: 'number'; answer: number }
  | { id: 'numeric'; kind: 'choice'; options: string[]; answer: string }
  | { id: 'missing'; kind: 'choice'; options: string[]; answer: string }
  | { id: 'hasMissing'; kind: 'choice'; options: string[]; answer: string }
  | { id: 'geometry'; kind: 'choice'; options: string[]; answer: string }

/** Deterministic shuffle so options keep their order across re-renders. */
const shuffle = <T>(items: T[], seed: string) => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return [...items].sort((a, b) => {
    const score = (value: T) => {
      let h = hash
      for (const char of String(value)) h = (h * 33 + char.charCodeAt(0)) | 0
      return h
    }
    return score(a) - score(b)
  })
}

export const buildQuestions = (profile: DatasetProfile): Question[] => {
  const questions: Question[] = [{ id: 'rows', kind: 'number', answer: profile.rows }]
  const columns = profile.columns.filter((column) => column.kind !== 'geometry')

  const numeric = columns.filter((column) => column.kind === 'number')
  const others = columns.filter((column) => column.kind !== 'number')
  if (numeric.length && others.length) {
    const answer = numeric[0].name
    const options = shuffle([answer, ...others.slice(0, 3).map((c) => c.name)], profile.name)
    questions.push({ id: 'numeric', kind: 'choice', options, answer })
  }

  const withMissing = [...columns].sort((a, b) => b.missing - a.missing)
  if (withMissing[0]?.missing > 0) {
    const options = shuffle(withMissing.slice(0, 4).map((c) => c.name), `${profile.name}-missing`)
    questions.push({ id: 'missing', kind: 'choice', options, answer: withMissing[0].name })
  } else {
    questions.push({ id: 'hasMissing', kind: 'choice', options: ['yes', 'no'], answer: 'no' })
  }

  if (profile.spatial && profile.geometryTypes.length === 1) {
    const types = ['Point', 'LineString', 'Polygon']
    const answer = profile.geometryTypes[0].replace(/^Multi/, '')
    if (types.includes(answer)) questions.push({ id: 'geometry', kind: 'choice', options: types, answer })
  }
  return questions
}
