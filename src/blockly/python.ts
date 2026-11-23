/** Helpers for writing readable, valid Python from block fields. */

const KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '),
)

/** Dataset names are Python variables: letters, digits and underscores, not starting with a digit. */
export const toIdentifier = (name: string) => {
  let id = String(name ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\W+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!id) id = 'data'
  if (/^\d/.test(id)) id = `data_${id}`
  return KEYWORDS.has(id) ? `${id}_` : id
}

/** JSON string literals are valid Python string literals. */
export const str = (value: unknown) => JSON.stringify(String(value ?? ''))

/** Turn a typed-in filter value into a Python literal, guided by the column's kind. */
export const literal = (value: string, kind?: string) => {
  const text = String(value ?? '').trim()
  const number = text.replace(',', '.')
  if (kind !== 'text' && kind !== 'category' && kind !== 'date' && /^-?\d+(\.\d+)?$/.test(number)) return number
  if (kind === 'boolean' || /^(true|false|wahr|falsch)$/i.test(text)) {
    if (/^(true|wahr|ja|yes|1)$/i.test(text)) return 'True'
    if (/^(false|falsch|nein|no|0)$/i.test(text)) return 'False'
  }
  return str(text)
}

export type DataFormat = 'csv' | 'geojson' | 'json'

/** Guess the format of a URL or file name (APIs without an extension usually return JSON). */
export const formatOf = (source: string, content?: string): DataFormat => {
  const lower = source.toLowerCase()
  if (/\.geojson(\?|$)|format=geojson/.test(lower)) return 'geojson'
  if (/\.(csv|tsv|txt)(\?|$)|format=csv/.test(lower)) return 'csv'
  if (/\.json(\?|$)/.test(lower)) return content && /"FeatureCollection"/.test(content.slice(0, 2000)) ? 'geojson' : 'json'
  if (content !== undefined) {
    const start = content.trimStart()[0]
    if (start === '{' || start === '[') return /"FeatureCollection"/.test(content.slice(0, 2000)) ? 'geojson' : 'json'
    return 'csv'
  }
  return 'json'
}

/** read_csv arguments for a known file: separator and decimal comma (German CSV). */
export const csvOptions = (content?: string) => {
  if (!content) return ''
  const firstLine = content.replace(/^﻿/, '').split('\n', 1)[0]
  const counts = { ',': firstLine.split(',').length, ';': firstLine.split(';').length, '\t': firstLine.split('\t').length }
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as ',' | ';' | '\t'
  if (sep === ';') return ', sep=";", decimal=","'
  if (sep === '\t') return ', sep="\\t"'
  return ''
}
