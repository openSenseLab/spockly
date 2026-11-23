import { Download, EllipsisVertical, Eye, FastForward, FilePlus2, FolderOpen, Puzzle, RotateCcw, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import { useT } from '../../i18n'
import { runAll } from '../../journal/runner'
import { downloadFile, fileSlug } from '../../journal/share'
import { useJournalStore } from '../../journal/store'
import type { Journal } from '../../journal/types'
import { restartKernel } from '../../kernel/kernel'
import { LibraryDialog } from '../LibraryDialog'
import { IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui'

type Props = {
  onOpen: (journal: Journal) => void
  onNew: () => void
  onExample: () => void
}

export function JournalMenu({ onOpen, onNew, onExample }: Props) {
  const t = useT()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const confirmReplace = () => window.confirm(t.menu.replaceConfirm)

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Journal
      if (!Array.isArray(parsed.cells)) throw new Error('invalid')
      onOpen({ ...parsed, share: undefined })
    } catch {
      window.alert(t.menu.importFailed)
    }
  }

  const save = () => {
    const journal = useJournalStore.getState().journal
    // The share token stays private: a copy of the file must not be able to change the shared link.
    const { share: _share, ...exported } = journal
    void _share
    downloadFile(`${fileSlug(journal.title)}.spockly.json`, JSON.stringify(exported))
  }

  return (
    <>
      <Menu>
        <MenuTrigger>
          <IconButton label={t.menu.journal}>
            <EllipsisVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          {/* On phones the top bar has no room for these. */}
          <div className="sm:hidden">
            <MenuItem onSelect={() => void runAll()}>
              <FastForward /> {t.run.runAll}
            </MenuItem>
            <MenuItem onSelect={() => (window.location.hash = '#/preview')}>
              <Eye /> {t.menu.preview}
            </MenuItem>
            <MenuSeparator />
          </div>
          <MenuItem onSelect={() => confirmReplace() && onNew()}>
            <FilePlus2 /> {t.menu.new}
          </MenuItem>
          <MenuItem onSelect={() => confirmReplace() && onExample()}>
            <Sparkles /> {t.menu.example}
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => fileInput.current?.click()}>
            <FolderOpen /> {t.menu.openFile}
          </MenuItem>
          <MenuItem onSelect={save}>
            <Download /> {t.menu.saveFile}
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => setLibraryOpen(true)}>
            <Puzzle /> {t.library.manage}
          </MenuItem>
          <MenuItem onSelect={restartKernel}>
            <RotateCcw /> {t.menu.restart}
          </MenuItem>
        </MenuContent>
      </Menu>
      <input
        ref={fileInput}
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file && confirmReplace()) void importFile(file)
          event.target.value = ''
        }}
      />
      <LibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </>
  )
}
