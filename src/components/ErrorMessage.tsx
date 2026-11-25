import { CircleAlert } from 'lucide-react'

import { useT } from '../i18n'

/** Shows a learner-friendly message for coded errors (SPK|code|arg), or Python's own message. */
export function ErrorMessage({ message }: { message: string }) {
  const t = useT()
  const match = message.match(/^SPK\|([^|]*)\|(.*)$/)
  const code = match?.[1] as keyof typeof t.errors | undefined
  const known = !!code && code in t.errors
  const text = known ? t.errors[code].replace('{arg}', match![2]) : message
  return (
    <div className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100" role="alert">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{t.errors.title}</p>
        <p className="break-words">{text}</p>
        {!known && <p className="text-xs text-red-700/70">{t.errors.pythonHint}</p>}
      </div>
    </div>
  )
}
