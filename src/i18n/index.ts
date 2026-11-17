import type { Lang, LocalizedText } from '../core/types'
import { de } from './de'
import { en } from './en'

export type MessageKey = keyof typeof de

const dictionaries: Record<Lang, Record<MessageKey, string>> = { de, en }

const LANG_KEY = 'spockly.lang'

const isLang = (value: unknown): value is Lang => value === 'de' || value === 'en'

function readStoredLang(): Lang | null {
  try {
    const stored = window.localStorage.getItem(LANG_KEY)
    return isLang(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Fixed for the lifetime of the page: Blockly resolves block text when a block
 * is created, so switching language reloads the page (see setLanguage).
 * Order: `?lang=` in the URL, then the saved choice, then German.
 */
const urlLang = new URLSearchParams(window.location.search).get('lang')
export const lang: Lang = isLang(urlLang) ? urlLang : (readStoredLang() ?? 'de')

/** Remembers the choice and reloads the page in that language. */
export function setLanguage(next: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, next)
  } catch {
    // Storage blocked (private mode): the URL parameter below still works for this visit.
  }
  const url = new URL(window.location.href)
  url.searchParams.set('lang', next)
  window.location.replace(url)
}

export function t(key: MessageKey | string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang]
  const template = (dict as Record<string, string>)[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars && name in vars ? String(vars[name]) : `{${name}}`,
  )
}

/** Pick the current language, fall back to the other one. */
export const pick = (text: LocalizedText | undefined): string | undefined =>
  text?.[lang] ?? text?.[lang === 'de' ? 'en' : 'de']

const numberFormat = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
export const formatNumber = (n: number) => numberFormat.format(n)

const dayFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Formats an ISO value at its own precision: year, month, day, or date with time. */
export function formatDate(iso: string): string {
  if (/^\d{4}$/.test(iso)) return iso
  if (/^\d{4}-\d{2}$/.test(iso)) return monthFormat.format(Date.parse(`${iso}-01T00:00:00Z`))
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const ms = Date.parse(`${iso}T00:00:00Z`)
    return Number.isNaN(ms) ? iso : dayFormat.format(ms)
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms)
    ? iso
    : new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
}
