import { useEffect, useRef, useState } from 'react'
import { Box, Button, Callout, Dialog, Flex, Link, RadioCards, Spinner, Text, TextField } from '@radix-ui/themes'

import { setUrlParams, type UrlBlock } from '../blocks'
import { checkUrl } from '../blocks/load_url/mapping'
import { fetchUrlText } from '../blocks/load_url/operation'
import { URL_EXAMPLES } from '../blocks/load_url/presets'
import { LoadError } from '../core/http'
import { readData, type Delimiter, type ReadResult } from '../core/tabular'
import { pick, t } from '../i18n'
import { ReadPreview } from './ReadPreview'

type Check =
  | { state: 'idle' }
  | { state: 'loading'; url: string }
  | { state: 'ok'; url: string; text: string; contentType: string; read: ReadResult }
  | { state: 'error'; url: string; code: string }

/**
 * Settings of a "web address" block: an example or an own address, checked
 * by loading it once, so the block knows how to read it (and the Python code
 * reads it the same way).
 */
export function UrlSetupForm({ block, onDone }: { block: UrlBlock; onDone: () => void }) {
  const [url, setUrl] = useState(block.urlParams.url)
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const controller = useRef<AbortController | null>(null)

  const run = async (address: string) => {
    controller.current?.abort()
    const problem = checkUrl(address)
    if (problem) return setCheck({ state: 'error', url: address, code: problem })
    const ctrl = new AbortController()
    controller.current = ctrl
    setCheck({ state: 'loading', url: address })
    try {
      const { text, contentType } = await fetchUrlText(address.trim(), ctrl.signal)
      const read = readData(text, { contentType, name: new URL(address).pathname })
      if (ctrl.signal.aborted) return
      if (read.records.length === 0) return setCheck({ state: 'error', url: address, code: 'load.url.empty' })
      setCheck({ state: 'ok', url: address, text, contentType, read })
    } catch (error) {
      if (ctrl.signal.aborted) return
      const code = error instanceof LoadError ? error.code : error instanceof SyntaxError ? 'load.url.badJson' : 'load.failed'
      setCheck({ state: 'error', url: address, code })
    }
  }

  // The address the block already has is checked right away.
  useEffect(() => {
    void run(block.urlParams.url)
    return () => controller.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setDelimiter = (delimiter: Delimiter) => {
    if (check.state !== 'ok') return
    setCheck({ ...check, read: readData(check.text, { settings: { format: 'csv', delimiter } }) })
  }

  const checked = check.state === 'ok' && check.url === url
  const apply = () => {
    if (check.state !== 'ok') return
    const { format, delimiter, path } = check.read
    setUrlParams(block, { url: url.trim(), read: { format, delimiter, path } })
    onDone()
  }
  const chosenExample = URL_EXAMPLES.find((e) => e.url === url)?.id ?? ''

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Dialog.Title>{t('url.dialog.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {t('url.dialog.description')}
        </Dialog.Description>
      </Box>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('url.dialog.examples')}
        </Text>
        <RadioCards.Root
          size="1"
          columns={{ initial: '1', sm: '2' }}
          value={chosenExample}
          onValueChange={(id) => {
            const example = URL_EXAMPLES.find((e) => e.id === id)
            if (!example) return
            setUrl(example.url)
            void run(example.url)
          }}
        >
          {URL_EXAMPLES.map((e) => (
            <RadioCards.Item key={e.id} value={e.id}>
              <Flex direction="column" width="100%">
                <Text weight="bold">{pick(e.label)}</Text>
                <Text size="1" color="gray">
                  {pick(e.about)} {e.source.name}
                </Text>
              </Flex>
            </RadioCards.Item>
          ))}
        </RadioCards.Root>
      </Flex>

      <Flex direction="column" gap="2">
        <Text as="label" weight="bold" size="2" htmlFor="url-input">
          {t('url.dialog.address')}
        </Text>
        <Flex gap="2">
          <Box flexGrow="1">
            <TextField.Root
              id="url-input"
              type="url"
              value={url}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void run(url)}
            />
          </Box>
          <Button variant="soft" onClick={() => void run(url)} disabled={check.state === 'loading'}>
            {t('url.dialog.check')}
          </Button>
        </Flex>
        <Text size="1" color="gray">
          {t('url.dialog.hint')}
        </Text>
        <Text size="1" color="gray">
          {t('url.dialog.moreGeojson')}{' '}
          <Link href="https://geojson.xyz/" target="_blank" rel="noreferrer">
            geojson.xyz
          </Link>
        </Text>
      </Flex>

      {check.state === 'loading' && (
        <Flex gap="2" align="center">
          <Spinner />
          <Text size="2" color="gray">
            {t('url.dialog.loading')}
          </Text>
        </Flex>
      )}
      {check.state === 'error' && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{t(check.code)}</Callout.Text>
        </Callout.Root>
      )}
      {check.state === 'ok' && (
        <>
          <ReadPreview read={check.read} onDelimiter={setDelimiter} />
          {!checked && (
            <Text size="1" color="amber">
              {t('url.dialog.changed')}
            </Text>
          )}
          {check.url !== url ? null : (
            <Text size="1" color="gray">
              <Link href={url} target="_blank" rel="noreferrer">
                {t('url.dialog.open')}
              </Link>
            </Text>
          )}
        </>
      )}

      <Flex gap="3" justify="end">
        <Dialog.Close>
          <Button variant="soft" color="gray">
            {t('dialog.cancel')}
          </Button>
        </Dialog.Close>
        <Button disabled={!checked} onClick={apply}>
          {t('dialog.apply')}
        </Button>
      </Flex>
    </Flex>
  )
}
