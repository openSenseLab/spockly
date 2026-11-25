import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { JournalEditor } from './components/editor/JournalEditor'
import { Spinner } from './components/ui'
import { JournalViewer } from './components/viewer/JournalViewer'
import { useT } from './i18n'
import { ShareError, decodeJournal, fetchSharedJournal, publish } from './journal/share'
import { useJournalStore } from './journal/store'
import { Lab } from './lab/Lab'
import { useLabStore } from './lab/labStore'
import type { PublishedJournal } from './journal/types'

const subscribeHash = (callback: () => void) => {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
const useHash = () => useSyncExternalStore(subscribeHash, () => window.location.hash)

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3">{children}</div>
  )
}

/** A shared journal: from the server (short link /s/<id>) or from the URL itself (long link). */
function SharedJournal({ id, payload }: { id?: string; payload?: string }) {
  const t = useT()
  const [state, setState] = useState<{ journal?: PublishedJournal; error?: 'invalid' | 'notFound' }>({})

  useEffect(() => {
    let cancelled = false
    const load = id ? fetchSharedJournal(id) : decodeJournal(payload ?? '')
    load
      .then((journal) => !cancelled && setState({ journal }))
      .catch((error) => !cancelled && setState({ error: error instanceof ShareError && error.status === 404 ? 'notFound' : 'invalid' }))
    return () => {
      cancelled = true
    }
  }, [id, payload])

  if (state.error) {
    return (
      <Centered>
        <div className="max-w-md space-y-3 text-center">
          <p className="text-ink-700">{state.error === 'notFound' ? t.viewer.notFound : t.viewer.invalidLink}</p>
          <a className="font-medium text-brand-600 underline" href={import.meta.env.BASE_URL}>
            {t.viewer.createOwn}
          </a>
        </div>
      </Centered>
    )
  }
  if (!state.journal) return <Centered><Spinner /></Centered>
  return <JournalViewer journal={state.journal} />
}

function Preview() {
  const journal = useJournalStore((state) => state.journal)
  const published = useMemo(() => publish(journal), [journal])
  return <JournalViewer journal={published} onBack={() => (window.location.hash = '#/')} />
}

export default function App() {
  const hash = useHash()
  const hydrated = useJournalStore((state) => state.hydrated)
  const labHydrated = useLabStore((state) => state.hydrated)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [hash])

  // Short links are real paths (/s/<id>); everything else uses hash routes.
  const shortId = window.location.pathname.slice(import.meta.env.BASE_URL.length).match(/^s\/([A-Za-z0-9]{10})\/?$/)?.[1]
  if (shortId) return <SharedJournal id={shortId} />
  if (hash.startsWith('#/view/')) return <SharedJournal payload={hash.slice('#/view/'.length)} />
  if (!hydrated || !labHydrated) return <Centered><Spinner /></Centered>
  if (hash === '#/lab') return <Lab />
  if (hash === '#/preview') return <Preview />
  return <JournalEditor />
}
