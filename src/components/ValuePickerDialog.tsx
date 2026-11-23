import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useValuePicker, type PickRequest, type PickValue } from '../blockly/valuePicker'
import { format, useT } from '../i18n'
import { Button, Dialog } from './ui'
import { cn, inputClass } from './ui/styles'

const key = (value: PickValue) => `${typeof value}:${String(value)}`

/** Typed-in extra values: one per line; numbers stay numbers. */
const parseTyped = (text: string): PickValue[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/^-?\d+([.,]\d+)?$/.test(line) ? Number(line.replace(',', '.')) : line))

function PickerBody({ request, close }: { request: PickRequest; close: () => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const known = useMemo(() => new Set(request.options.map(key)), [request.options])
  const [chosen, setChosen] = useState(() => new Set(request.selected.filter((v) => known.has(key(v))).map(key)))
  const [typed, setTyped] = useState(() => request.selected.filter((v) => !known.has(key(v))).map(String).join('\n'))

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? request.options.filter((value) => String(value).toLowerCase().includes(needle)) : request.options
  }, [query, request.options])

  const toggle = (value: PickValue) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(key(value))) next.delete(key(value))
      else next.add(key(value))
      return next
    })

  const setVisible = (on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      for (const value of visible) {
        if (on) next.add(key(value))
        else next.delete(key(value))
      }
      return next
    })

  const save = () => {
    // Keep the column's order; typed values follow.
    const picked = request.options.filter((value) => chosen.has(key(value)))
    const extra = parseTyped(typed).filter((value) => !chosen.has(key(value)))
    request.done([...picked, ...extra])
    close()
  }

  return (
    <div className="space-y-3">
      {request.options.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                className={cn(inputClass, 'pl-9')}
                placeholder={t.picker.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <Button size="sm" variant="ghost" onClick={() => setVisible(true)}>
              {t.picker.all}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVisible(false)}>
              {t.picker.none}
            </Button>
          </div>
          <ul className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-ink-200" role="listbox" aria-multiselectable>
            {visible.map((value) => (
              <li key={key(value)}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-brand-50">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={chosen.has(key(value))} onChange={() => toggle(value)} />
                  <span className="truncate">{String(value)}</span>
                </label>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">{t.picker.noMatch}</li>}
          </ul>
          <p className="text-xs text-ink-500">{format(t.picker.selected, { count: chosen.size, total: request.options.length })}</p>
        </>
      ) : (
        <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-sm text-ink-600 ring-1 ring-ink-100">{t.picker.unknown}</p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-500 uppercase">{t.picker.typed}</span>
        <textarea className={cn(inputClass, 'resize-y')} rows={request.options.length ? 2 : 5} value={typed} onChange={(event) => setTyped(event.target.value)} />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={close}>{t.common.cancel}</Button>
        <Button variant="primary" onClick={save}>
          {t.common.ok}
        </Button>
      </div>
    </div>
  )
}

/** Multi-select of a column's values for the "is one of" filter block. */
export function ValuePickerDialog() {
  const t = useT()
  const request = useValuePicker((state) => state.request)
  const close = () => useValuePicker.setState({ request: null })
  if (!request) return null
  return (
    <Dialog open onOpenChange={(open) => !open && close()} title={format(t.picker.title, { column: request.column || '…' })}>
      <PickerBody request={request} close={close} />
    </Dialog>
  )
}
