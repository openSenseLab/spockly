import { Check, Copy, ExternalLink, Info, Link2Off, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { format, useLanguageStore, useT } from '../../i18n'
import {
  ShareError,
  createShortLink,
  deleteShortLink,
  encodeJournal,
  publish,
  shareUrl,
  shortUrl,
  updateShortLink,
} from '../../journal/share'
import { useJournalStore } from '../../journal/store'
import { copyText } from '../../utils/clipboard'
import { Button, Callout, Dialog } from '../ui'
import { cn, inputClass } from '../ui/styles'

/** Long links longer than this get cut off by some chat and mail apps. */
const LONG_LINK = 8000

type State =
  | { kind: 'working' }
  | { kind: 'short'; url: string; updated: boolean }
  | { kind: 'long'; url: string }
  | { kind: 'stopped' }

/**
 * Publish the journal under a short link (created once, then updated in place).
 * Without a reachable server, fall back to a long link that contains the journal.
 */
const shareJournal = async (): Promise<State> => {
  const store = useJournalStore.getState()
  const { journal } = store
  const published = publish(journal)
  try {
    if (journal.share) {
      try {
        await updateShortLink(journal.share.id, journal.share.token, published)
        store.setShare({ ...journal.share, updatedAt: new Date().toISOString() })
        return { kind: 'short', url: shortUrl(journal.share.id), updated: true }
      } catch (error) {
        // The link was deleted on the server (or the token is invalid): create a new one.
        if (!(error instanceof ShareError) || ![403, 404].includes(error.status)) throw error
      }
    }
    const { id, token } = await createShortLink(published)
    store.setShare({ id, token, updatedAt: new Date().toISOString() })
    return { kind: 'short', url: shortUrl(id), updated: false }
  } catch {
    return { kind: 'long', url: shareUrl(await encodeJournal(published)) }
  }
}

export function ShareDialog({ open, onOpenChange, onShared }: { open: boolean; onOpenChange: (open: boolean) => void; onShared: () => void }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const share = useJournalStore((state) => state.journal.share)
  const setShare = useJournalStore((state) => state.setShare)
  const [state, setState] = useState<State>({ kind: 'working' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void shareJournal().then((next) => !cancelled && setState(next))
    return () => {
      cancelled = true
    }
  }, [open])

  const close = (next: boolean) => {
    if (!next) {
      setState({ kind: 'working' })
      setCopied(false)
    }
    onOpenChange(next)
  }

  const url = state.kind === 'short' || state.kind === 'long' ? state.url : ''

  const copy = async () => {
    setCopied(await copyText(url))
    onShared()
  }

  const stopSharing = async () => {
    if (!share || !window.confirm(t.share.stopConfirm)) return
    try {
      await deleteShortLink(share.id, share.token)
    } catch (error) {
      // Already gone on the server: forgetting it locally is all that is left to do.
      if (!(error instanceof ShareError) || error.status !== 404) {
        window.alert(t.share.stopFailed)
        return
      }
    }
    setShare(undefined)
    setState({ kind: 'stopped' })
  }

  return (
    <Dialog open={open} onOpenChange={close} title={t.share.title} description={t.share.description}>
      <div className="space-y-3">
        {state.kind === 'working' && (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <LoaderCircle className="size-4 animate-spin" /> {t.share.preparing}
          </p>
        )}

        {state.kind === 'stopped' && (
          <Callout tone="gray" icon={<Link2Off />}>
            {t.share.stopped}
          </Callout>
        )}

        {url && (
          <>
            <input
              readOnly
              className={cn(inputClass, state.kind === 'short' ? 'text-base font-medium text-ink-800' : 'font-mono text-xs text-ink-600')}
              value={url}
              onFocus={(event) => event.target.select()}
              aria-label={t.share.title}
            />
            {/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) && (
              <Callout tone="amber" icon={<TriangleAlert />}>
                {t.share.localhostOnly}
              </Callout>
            )}
            {state.kind === 'short' && (
              <Callout tone="brand" icon={<Info />}>
                <p>{state.updated ? t.share.updated : t.share.created}</p>
                {share && (
                  <p className="mt-1 text-xs opacity-80">
                    {format(t.share.lastUpdate, {
                      date: new Date(share.updatedAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }),
                    })}
                  </p>
                )}
              </Callout>
            )}
            {state.kind === 'long' && (
              <Callout tone="amber" icon={<TriangleAlert />}>
                <p>{t.share.noServer}</p>
                <p className="mt-1">{format(t.share.length, { length: url.length.toLocaleString(language) })}</p>
                {url.length > LONG_LINK && <p className="mt-1">{t.share.longWarning}</p>}
              </Callout>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {state.kind === 'short' && share && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void stopSharing()}>
              <Link2Off /> {t.share.stop}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            disabled={!url}
            onClick={() => {
              window.open(url, '_blank', 'noopener')
              onShared()
            }}
          >
            <ExternalLink /> {t.share.open}
          </Button>
          <Button variant="primary" disabled={!url} onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />} {copied ? t.share.copied : t.share.copy}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
