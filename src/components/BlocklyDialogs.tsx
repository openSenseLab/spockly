import { useEffect, useRef, useState } from 'react'

import { useDialogStore } from '../blockly/dialogs'
import { useT } from '../i18n'
import { Button, Dialog } from './ui'
import { inputClass } from './ui/styles'

export function BlocklyDialogs() {
  const t = useT()
  const request = useDialogStore((state) => state.request)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (request?.kind !== 'prompt') return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [request])

  if (!request) return null

  const close = (confirmed: boolean) => {
    useDialogStore.setState({ request: null })
    if (request.kind === 'alert') request.done()
    else if (request.kind === 'confirm') request.done(confirmed)
    else request.done(confirmed ? value : null)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close(false)} title={request.message}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          close(true)
        }}
      >
        {request.kind === 'prompt' && (
          <input
            ref={inputRef}
            autoFocus
            className={inputClass}
            defaultValue={request.defaultValue}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => setValue(event.target.value)}
            aria-label={request.message}
          />
        )}
        <div className="flex justify-end gap-2">
          {request.kind !== 'alert' && <Button onClick={() => close(false)}>{t.common.cancel}</Button>}
          <Button type="submit" variant="primary">
            {t.common.ok}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
