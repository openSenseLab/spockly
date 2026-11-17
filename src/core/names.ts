/** Longest variable name we generate; longer ones are cut at a word boundary. */
const MAX_LENGTH = 40

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' }

const PYTHON_KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  ),
)

/** "Temperatur Münster-Mitte" → "temperatur_muenster_mitte": a valid, readable Python name. */
export function toPythonName(text: string, fallback = 'daten'): string {
  let name = text
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (name.length > MAX_LENGTH) name = name.slice(0, MAX_LENGTH).replace(/_[^_]*$/, '') || name.slice(0, MAX_LENGTH)
  if (!name) return fallback
  if (/^[0-9]/.test(name)) name = `daten_${name}`
  return PYTHON_KEYWORDS.has(name) ? `${name}_` : name
}

/**
 * Makes names unique in the given order: the first keeps its name, later ones
 * get _2, _3, … so each dataset has its own variable.
 */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    let candidate = name
    for (let n = 2; used.has(candidate); n++) candidate = `${name}_${n}`
    used.add(candidate)
    return candidate
  })
}
