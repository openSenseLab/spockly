import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  RadioCards,
  SegmentedControl,
  Select,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'

import { setOsemParams, type OsemBlock } from '../blocks'
import {
  phenomenaIn,
  timeWindow,
  type LoadOsemParams,
  type OsemSource,
  type PhenomenonOption,
} from '../blocks/load_osem/mapping'
import { fetchBoxes, fetchTags } from '../blocks/load_osem/operation'
import { AREA_PRESETS, PERIODS, type PeriodId } from '../blocks/load_osem/presets'
import { LoadError } from '../core/http'
import { formatNumber, pick, t } from '../i18n'

/** Phenomena shown before "show all". */
const SHORT_LIST = 9
/** Wait for the student to stop typing a group tag. */
const TAG_DEBOUNCE_MS = 500

/** Result of asking which phenomena the stations measure; `key` says for which settings. */
type Search =
  | { key: string; status: 'ready'; options: PhenomenonOption[] }
  | { key: string; status: 'error'; errorCode: string }

const stationCount = (count: number) =>
  count === 1 ? t('osem.dialog.stationCountOne') : t('osem.dialog.stationCount', { count: formatNumber(count) })

/** Settings of an openSenseMap block; shown inside BlockSetupDialog. */
export function OsemSetupForm({ block, onDone }: { block: OsemBlock; onDone: () => void }) {
  const [draft, setDraft] = useState<LoadOsemParams>(block.osemParams)
  const [result, setResult] = useState<Search | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)

  const update = (patch: Partial<LoadOsemParams>) => setDraft((d) => ({ ...d, ...patch }))

  // Group tags for the suggestion list.
  useEffect(() => {
    if (draft.source.kind !== 'tag' || tags.length) return
    fetchTags().then(setTags, (error) => console.error('[load_osem] tags', error))
  }, [draft.source.kind, tags.length])

  // What do the active stations measure? Re-asked when stations or period change.
  // The source is passed as a string so a new object with the same content doesn't re-ask.
  const sourceKey = JSON.stringify(draft.source)
  const { outdoorOnly, period } = draft
  const searchKey = JSON.stringify([sourceKey, outdoorOnly, period])
  // No group typed yet: nothing to look up.
  const needsTag = draft.source.kind === 'tag' && !draft.source.tag.trim()
  // A result for older settings means we're still looking.
  const search = needsTag
    ? ({ status: 'needsTag' } as const)
    : result?.key === searchKey
      ? result
      : ({ status: 'loading' } as const)
  useEffect(() => {
    const source = JSON.parse(sourceKey) as OsemSource
    if (source.kind === 'tag' && !source.tag.trim()) return
    const controller = new AbortController()
    const delay = source.kind === 'tag' ? TAG_DEBOUNCE_MS : 0
    const timer = window.setTimeout(async () => {
      try {
        const boxes = await fetchBoxes(source, outdoorOnly, controller.signal)
        const { from } = timeWindow(period, new Date())
        setResult({ key: searchKey, status: 'ready', options: phenomenaIn(boxes, from) })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('[load_osem] stations', error)
        setResult({
          key: searchKey,
          status: 'error',
          errorCode: error instanceof LoadError ? error.code : 'load.failed',
        })
      }
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchKey, sourceKey, outdoorOnly, period])

  const options = search.status === 'ready' ? search.options : []
  const short = options.slice(0, SHORT_LIST)
  // Keep the current choice visible even if it's further down the list.
  const chosen = options.find((o) => o.title === draft.phenomenon)
  const visible = showAll || !chosen || short.includes(chosen) ? (showAll ? options : short) : [...short, chosen]

  const phenomenonAvailable = options.some((o) => o.title === draft.phenomenon)
  const canApply = search.status === 'ready' && phenomenonAvailable

  const apply = () => {
    setOsemParams(block, draft)
    onDone()
  }

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Dialog.Title>{t('osem.dialog.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {t('osem.dialog.description')}
        </Dialog.Description>
      </Box>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('osem.dialog.stations')}
        </Text>
        <SegmentedControl.Root
          value={draft.source.kind}
          onValueChange={(kind) =>
            update({
              source: kind === 'tag' ? { kind: 'tag', tag: '' } : { kind: 'area', area: AREA_PRESETS[0].id },
            })
          }
        >
          <SegmentedControl.Item value="area">{t('osem.dialog.byArea')}</SegmentedControl.Item>
          <SegmentedControl.Item value="tag">{t('osem.dialog.byTag')}</SegmentedControl.Item>
        </SegmentedControl.Root>

        {draft.source.kind === 'area' ? (
          <Select.Root
            value={draft.source.area}
            onValueChange={(area) => update({ source: { kind: 'area', area } })}
          >
            <Select.Trigger aria-label={t('osem.dialog.area')} />
            <Select.Content>
              {AREA_PRESETS.map((preset) => (
                <Select.Item key={preset.id} value={preset.id}>
                  {pick(preset.label)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        ) : (
          <Box>
            <TextField.Root
              aria-label={t('osem.dialog.tag')}
              placeholder={t('osem.dialog.tagPlaceholder')}
              value={draft.source.tag}
              list="osem-tags"
              autoComplete="off"
              onChange={(e) => update({ source: { kind: 'tag', tag: e.target.value } })}
            />
            <datalist id="osem-tags">
              {tags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <Text as="p" size="1" color="gray" mt="1">
              {t('osem.dialog.tagHint')}
            </Text>
          </Box>
        )}

        <Text as="label" size="2">
          <Flex gap="2" align="center">
            <Checkbox
              checked={draft.outdoorOnly}
              onCheckedChange={(checked) => update({ outdoorOnly: checked === true })}
            />
            {t('osem.dialog.outdoorOnly')}
          </Flex>
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('osem.dialog.period')}
        </Text>
        <SegmentedControl.Root value={draft.period} onValueChange={(period) => update({ period: period as PeriodId })}>
          {(Object.keys(PERIODS) as PeriodId[]).map((id) => (
            <SegmentedControl.Item key={id} value={id}>
              {pick(PERIODS[id].label)}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </Flex>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('osem.dialog.phenomenon')}
        </Text>

        {search.status === 'needsTag' && (
          <Text size="2" color="gray">
            {t('osem.dialog.enterTag')}
          </Text>
        )}

        {search.status === 'loading' && (
          <Flex gap="2" align="center">
            <Spinner />
            <Text size="2" color="gray">
              {t('osem.dialog.searching')}
            </Text>
          </Flex>
        )}

        {search.status === 'error' && (
          <Callout.Root color="red" size="1">
            <Callout.Text>{t(search.errorCode)}</Callout.Text>
          </Callout.Root>
        )}

        {search.status === 'ready' && options.length === 0 && (
          <Callout.Root color="amber" size="1">
            <Callout.Text>{t('osem.dialog.noneActive')}</Callout.Text>
          </Callout.Root>
        )}

        {search.status === 'ready' && options.length > 0 && (
          <>
            <RadioCards.Root
              value={phenomenonAvailable ? draft.phenomenon : ''}
              onValueChange={(phenomenon) => update({ phenomenon })}
              columns={{ initial: '1', sm: '3' }}
              size="1"
            >
              {visible.map((option) => (
                <RadioCards.Item key={option.title} value={option.title}>
                  <Flex direction="column" width="100%">
                    <Text weight="bold" className="osem-phenomenon">
                      {option.title}
                      {option.unit ? <Text color="gray" weight="regular"> ({option.unit})</Text> : null}
                    </Text>
                    <Text size="1" color="gray">
                      {stationCount(option.stations)}
                    </Text>
                  </Flex>
                </RadioCards.Item>
              ))}
            </RadioCards.Root>
            {options.length > SHORT_LIST && (
              <Box>
                <Button size="1" variant="ghost" onClick={() => setShowAll((s) => !s)}>
                  {showAll
                    ? t('osem.dialog.showFewer')
                    : t('osem.dialog.showAll', { count: formatNumber(options.length) })}
                </Button>
              </Box>
            )}
            {!phenomenonAvailable && (
              <Text size="1" color="amber">
                {t('osem.dialog.pickPhenomenon')}
              </Text>
            )}
          </>
        )}
      </Flex>

      <Flex gap="3" justify="end">
        <Dialog.Close>
          <Button variant="soft" color="gray">
            {t('dialog.cancel')}
          </Button>
        </Dialog.Close>
        <Button disabled={!canApply} onClick={apply}>
          {t('dialog.apply')}
        </Button>
      </Flex>
    </Flex>
  )
}
