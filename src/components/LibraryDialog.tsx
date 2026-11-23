import { Download, Puzzle, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { useLibraryStore, type Snippet } from '../blockly/library'
import { format, useLanguageStore, useT } from '../i18n'
import { downloadFile } from '../journal/share'
import { Button, Callout, Dialog, IconButton, Tooltip } from './ui'
import { cn } from './ui/styles'

/** Rename, delete, export and import the blocks saved under "My blocks". */
export function LibraryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)
  const { snippets, rename, remove, importSnippets } = useLibraryStore()
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const exportAll = () =>
    downloadFile('spockly-my-blocks.json', JSON.stringify({ spocklyLibrary: 1, snippets } satisfies { spocklyLibrary: 1; snippets: Snippet[] }))

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { snippets?: Snippet[] }
      if (!Array.isArray(parsed.snippets)) throw new Error('invalid')
      setMessage(format(t.library.imported, { count: importSnippets(parsed.snippets) }))
    } catch {
      setMessage(t.library.importFailed)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setMessage(null)
        onOpenChange(next)
      }}
      title={t.library.title}
      description={t.library.description}
    >
      <div className="space-y-4">
        {snippets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-ink-50 px-6 py-8 text-center ring-1 ring-ink-100">
            <span className="grid size-11 place-items-center rounded-xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf-100">
              <Puzzle className="size-5" />
            </span>
            <p className="max-w-sm text-sm text-ink-500">{t.library.emptyLong}</p>
          </div>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-ink-100 overflow-y-auto rounded-xl ring-1 ring-ink-200">
            {snippets.map((snippet) => (
              <li key={snippet.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-leaf-50 text-leaf-700">
                  <Puzzle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    className="-mx-1 w-full rounded-md bg-transparent px-1 text-sm font-medium text-ink-900 outline-none hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-200"
                    value={snippet.name}
                    onChange={(event) => rename(snippet.id, event.target.value)}
                    aria-label={t.library.rename}
                  />
                  <p className="text-xs text-ink-500">
                    {format(t.library.blockCount, { count: snippet.blockCount })} ·{' '}
                    {new Date(snippet.createdAt).toLocaleDateString(language)}
                  </p>
                </div>
                <Tooltip content={t.library.delete}>
                  <IconButton
                    label={t.library.delete}
                    className="text-ink-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => window.confirm(format(t.library.deleteConfirm, { name: snippet.name })) && remove(snippet.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}

        {message && <Callout tone="brand">{message}</Callout>}

        <div className={cn('flex flex-wrap gap-2', snippets.length ? 'justify-between' : 'justify-end')}>
          {snippets.length > 0 && (
            <Button onClick={exportAll}>
              <Download /> {t.library.export}
            </Button>
          )}
          <Button onClick={() => fileInput.current?.click()}>
            <Upload /> {t.library.import}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFile(file)
              event.target.value = ''
            }}
          />
        </div>
      </div>
    </Dialog>
  )
}
