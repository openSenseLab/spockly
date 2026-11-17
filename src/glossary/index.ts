import type { ColumnMeta } from '../core/types'
import { GLOSSARY, type GlossaryEntry } from './entries'

export type { GlossaryEntry, Source } from './entries'

/** Lower case, underscores as spaces ("relative_humidity"), single spaces. */
const normalize = (text: string) => text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

const byName = new Map<string, GlossaryEntry>()
const byCode = new Map<string, GlossaryEntry>()
for (const entry of GLOSSARY) {
  for (const name of entry.names) byName.set(normalize(name), entry)
  for (const code of entry.codes ?? []) byCode.set(code, entry)
}

/**
 * The explanation for a measured quantity, if there is one. Matches an exact
 * column code (e.g. NASA's "T2M") or a known name ("rel. Luftfeuchte",
 * "Finedust PM10"). Names are matched as a whole, so "Bodentemperatur" does
 * not get the air-temperature text.
 */
export function glossaryFor(nameOrTitle: string): GlossaryEntry | undefined {
  return byCode.get(nameOrTitle.trim()) ?? byName.get(normalize(nameOrTitle))
}

/** The explanation for a table column: by its code, then by its labels. */
export function glossaryForColumn(column: ColumnMeta): GlossaryEntry | undefined {
  return (
    glossaryFor(column.name) ??
    (column.label?.de ? glossaryFor(column.label.de) : undefined) ??
    (column.label?.en ? glossaryFor(column.label.en) : undefined)
  )
}
