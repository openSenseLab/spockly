import { useRef, useState } from 'react'
import { Box, Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes'

import { setFileParams, type FileBlock } from '../blocks'
import { FILE_TYPES, MAX_FILE_BYTES } from '../blocks/load_file/mapping'
import { addFile, getFile } from '../blocks/load_file/store'
import { readData, type Delimiter, type ReadResult } from '../core/tabular'
import { formatNumber, t } from '../i18n'
import { ReadPreview } from './ReadPreview'

type Picked =
  | { state: 'none' }
  | { state: 'reading' }
  | { state: 'ok'; name: string; text: string; read: ReadResult }
  | { state: 'error'; code: string; vars?: Record<string, string> }

/** Reads a picked file as text; the problems as i18n keys. */
async function readFile(file: File): Promise<Picked> {
  if (file.size > MAX_FILE_BYTES) return { state: 'error', code: 'file.tooBig', vars: { size: formatNumber(Math.round(file.size / 1e6)) } }
  const text = await file.text()
  try {
    const read = readData(text, { name: file.name })
    if (read.records.length === 0 || read.fields.length === 0) return { state: 'error', code: 'load.file.empty' }
    return { state: 'ok', name: file.name, text, read }
  } catch {
    return { state: 'error', code: 'load.file.badJson' }
  }
}

/** Settings of a "own file" block: pick (or drop) a file, see how it was read, apply. */
export function FileSetupForm({ block, onDone }: { block: FileBlock; onDone: () => void }) {
  const current = block.fileParams
  const stored = current.fileId ? getFile(current.fileId) : undefined
  const [picked, setPicked] = useState<Picked>(() =>
    stored ? { state: 'ok', name: stored.name, text: stored.text, read: readData(stored.text, { settings: current.read, name: stored.name }) } : { state: 'none' },
  )
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const take = async (file: File | undefined) => {
    if (!file) return
    setPicked({ state: 'reading' })
    setPicked(await readFile(file))
  }

  const setDelimiter = (delimiter: Delimiter) => {
    if (picked.state !== 'ok') return
    setPicked({ ...picked, read: readData(picked.text, { settings: { format: 'csv', delimiter } }) })
  }

  const apply = () => {
    if (picked.state !== 'ok') return
    const { id, file } = addFile(picked.name, picked.text)
    const { format, delimiter, path } = picked.read
    setFileParams(block, { fileId: id, name: picked.name, file, read: { format, delimiter, path } })
    onDone()
  }

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Dialog.Title>{t('file.dialog.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {t('file.dialog.description')}
        </Dialog.Description>
      </Box>

      {current.name && !stored && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{t('file.dialog.pickAgain', { name: current.name })}</Callout.Text>
        </Callout.Root>
      )}

      <div
        className={`file-drop${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void take(e.dataTransfer.files[0])
        }}
      >
        <Flex direction="column" align="center" gap="2">
          <Text size="2">{t('file.dialog.drop')}</Text>
          <Button variant="soft" onClick={() => input.current?.click()}>
            {t('file.dialog.choose')}
          </Button>
          <input
            ref={input}
            type="file"
            accept={FILE_TYPES}
            hidden
            onChange={(e) => {
              void take(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Text size="1" color="gray">
            {t('file.dialog.types')}
          </Text>
        </Flex>
      </div>

      <Text size="1" color="gray">
        🔒 {t('file.dialog.private')}
      </Text>

      {picked.state === 'reading' && (
        <Text size="2" color="gray">
          {t('file.dialog.reading')}
        </Text>
      )}
      {picked.state === 'error' && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{t(picked.code, picked.vars)}</Callout.Text>
        </Callout.Root>
      )}
      {picked.state === 'ok' && (
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            {picked.name}
          </Text>
          <ReadPreview read={picked.read} onDelimiter={setDelimiter} />
        </Flex>
      )}

      <Flex gap="3" justify="end">
        <Dialog.Close>
          <Button variant="soft" color="gray">
            {t('dialog.cancel')}
          </Button>
        </Dialog.Close>
        <Button disabled={picked.state !== 'ok'} onClick={apply}>
          {t('dialog.apply')}
        </Button>
      </Flex>
    </Flex>
  )
}
