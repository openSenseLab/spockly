/** Web address → DataTable, and the block's settings. No network access here. */
import { LoadError } from '../../core/http'
import { DELIMITERS, guessTable, readData, toTable, type ReadSettings } from '../../core/tabular'
import type { DataTable, LocalizedText } from '../../core/types'
import { exampleFor, URL_EXAMPLES } from './presets'

export interface LoadUrlParams {
  url: string
  /** How the answer was read when the address was checked in the setup window. */
  read?: ReadSettings
}

export const DEFAULT_URL_PARAMS: LoadUrlParams = { url: URL_EXAMPLES[0].url, read: { format: 'geojson', path: ['features'] } }

/** Problems with an address before asking for it, as i18n keys. */
export function checkUrl(text: string): string | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return 'url.check.notAddress'
  }
  // The app runs on https; browsers block plain http requests from there.
  if (url.protocol === 'http:') return 'url.check.notHttps'
  if (url.protocol !== 'https:') return 'url.check.notAddress'
  return null
}

/** "earthquake.usgs.gov/…/2.5_week.geojson", short enough for a block. */
export function shortUrl(text: string, max = 42): string {
  try {
    const url = new URL(text)
    const last = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    const full = `${url.hostname}${url.pathname}`
    if (full.length <= max) return full
    const short = last ? `${url.hostname}/…/${decodeURIComponent(last)}` : url.hostname
    return short.length <= max ? short : `${short.slice(0, max - 1)}…`
  } catch {
    return text.slice(0, max)
  }
}

const isReadSettings = (v: unknown): v is ReadSettings => {
  const r = v as ReadSettings | undefined
  return (
    !!r &&
    (r.format === 'csv' || r.format === 'json' || r.format === 'geojson') &&
    (r.delimiter === undefined || DELIMITERS.includes(r.delimiter)) &&
    (r.path === undefined || (Array.isArray(r.path) && r.path.every((k) => typeof k === 'string')))
  )
}

/** Checks params coming from a saved block; anything odd falls back to the defaults. */
export function normalizeUrlParams(raw: unknown): LoadUrlParams {
  const r = (raw ?? {}) as Partial<LoadUrlParams>
  if (typeof r.url !== 'string' || checkUrl(r.url)) return { ...DEFAULT_URL_PARAMS }
  return { url: r.url.trim(), read: isReadSettings(r.read) ? r.read : undefined }
}

const LICENCE_NOTE: LocalizedText = {
  de: 'Die Lizenz dieser Daten kennt SPOCKLY nicht. Schau bei der Quelle nach, bevor du die Daten weitergibst oder veröffentlichst.',
  en: 'SPOCKLY doesn’t know the licence of this data. Check with the source before passing the data on or publishing it.',
}

/** The answer as a table: read like before (if it still fits), column types guessed. */
export function toUrlTable(params: LoadUrlParams, text: string, contentType: string): DataTable {
  if (/text\/html/i.test(contentType) && !/^\s*[[{]/.test(text.slice(0, 200))) throw new LoadError('load.url.html', params.url)
  let read
  try {
    read = readData(text, { settings: params.read, contentType, name: new URL(params.url).pathname })
  } catch (error) {
    throw new LoadError('load.url.badJson', String(error))
  }
  if (read.records.length === 0 || read.fields.length === 0) throw new LoadError('load.url.empty', params.url)

  const url = new URL(params.url)
  const example = exampleFor(params.url)
  const name = example ? undefined : shortUrl(params.url, 60)
  return toTable(guessTable(read.fields, read.records), {
    id: `url:${params.url}`,
    title: example?.label ?? { de: name, en: name },
    description: {
      de:
        `${example ? `${example.about.de} ` : ''}Geladen von ${url.hostname}. ` +
        'Welche Spalte Zahlen, Zeiten oder Orte enthält, hat SPOCKLY aus den Werten erraten – prüf es in der Tabelle.',
      en:
        `${example ? `${example.about.en} ` : ''}Loaded from ${url.hostname}. ` +
        'Which columns hold numbers, times or places was guessed from the values – check it in the table.',
    },
    source: example ? { name: example.source.name, url: example.source.page } : { name: url.hostname, url: params.url },
    keywords: [url.hostname],
    knownIssues: [LICENCE_NOTE],
  })
}
