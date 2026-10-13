import { useState } from 'react'
import {
  Box,
  Button,
  Callout,
  CheckboxCards,
  Dialog,
  Flex,
  SegmentedControl,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'

import { setNasaParams, type NasaBlock } from '../blocks'
import { checkParams, type LoadNasaParams, type Resolution } from '../blocks/load_nasa_power/mapping'
import { FIRST_DATE, PLACE_PRESETS, VARIABLES } from '../blocks/load_nasa_power/presets'
import { pick, t } from '../i18n'

const today = () => new Date().toISOString().slice(0, 10)
const lastFullYear = () => String(new Date().getUTCFullYear() - 1)

/** Keep the period sensible when switching between daily and monthly values. */
function switchResolution(draft: LoadNasaParams, resolution: Resolution): LoadNasaParams {
  if (resolution === draft.resolution) return draft
  if (resolution === 'monthly') {
    const to = String(Math.min(Number(draft.to.slice(0, 4)), Number(lastFullYear())))
    const from = String(Math.min(Number(draft.from.slice(0, 4)), Number(to)))
    return { ...draft, resolution, from, to }
  }
  const to = `${draft.to}-12-31` > today() ? today() : `${draft.to}-12-31`
  return { ...draft, resolution, from: `${draft.from}-01-01`, to }
}

/** Settings of a NASA POWER block; shown inside BlockSetupDialog. */
export function NasaSetupForm({ block, onDone }: { block: NasaBlock; onDone: () => void }) {
  const [draft, setDraft] = useState<LoadNasaParams>(block.nasaParams)
  const update = (patch: Partial<LoadNasaParams>) => setDraft((d) => ({ ...d, ...patch }))

  const problem = checkParams(draft, today())
  const daily = draft.resolution === 'daily'
  const coords = draft.place.kind === 'coords' ? draft.place : null

  const apply = () => {
    setNasaParams(block, draft)
    onDone()
  }

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Dialog.Title>{t('nasa.dialog.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {t('nasa.dialog.description')}
        </Dialog.Description>
      </Box>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('nasa.dialog.place')}
        </Text>
        <SegmentedControl.Root
          value={draft.place.kind}
          onValueChange={(kind) =>
            update({
              place:
                kind === 'coords'
                  ? { kind: 'coords', lat: PLACE_PRESETS[0].lat, lon: PLACE_PRESETS[0].lon }
                  : { kind: 'preset', id: PLACE_PRESETS[0].id },
            })
          }
        >
          <SegmentedControl.Item value="preset">{t('nasa.dialog.fromList')}</SegmentedControl.Item>
          <SegmentedControl.Item value="coords">{t('nasa.dialog.ownCoords')}</SegmentedControl.Item>
        </SegmentedControl.Root>

        {draft.place.kind === 'preset' ? (
          <Select.Root value={draft.place.id} onValueChange={(id) => update({ place: { kind: 'preset', id } })}>
            <Select.Trigger aria-label={t('nasa.dialog.place')} />
            <Select.Content>
              {PLACE_PRESETS.map((preset) => (
                <Select.Item key={preset.id} value={preset.id}>
                  {pick(preset.label)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        ) : (
          <Flex gap="3">
            {(['lat', 'lon'] as const).map((axis) => (
              <Box key={axis} flexGrow="1">
                <Text as="label" size="1" color="gray">
                  {t(axis === 'lat' ? 'nasa.dialog.lat' : 'nasa.dialog.lon')}
                  <TextField.Root
                    type="number"
                    step="0.0001"
                    value={coords ? String(coords[axis]) : ''}
                    onChange={(e) =>
                      coords && update({ place: { ...coords, [axis]: e.target.valueAsNumber } })
                    }
                  />
                </Text>
              </Box>
            ))}
          </Flex>
        )}
        <Text size="1" color="gray">
          {t('nasa.dialog.gridHint')}
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('nasa.dialog.values')}
        </Text>
        <CheckboxCards.Root
          value={draft.variables}
          onValueChange={(variables) =>
            // Keep the order of the list, whatever order they were ticked in.
            update({ variables: VARIABLES.map((v) => v.code).filter((code) => variables.includes(code)) })
          }
          columns={{ initial: '1', sm: '3' }}
          size="1"
        >
          {VARIABLES.map((v) => (
            <CheckboxCards.Item key={v.code} value={v.code}>
              <Text>
                {pick(v.label)} <Text color="gray">({v.unit})</Text>
              </Text>
            </CheckboxCards.Item>
          ))}
        </CheckboxCards.Root>
      </Flex>

      <Flex direction="column" gap="2">
        <Text weight="bold" size="2">
          {t('nasa.dialog.period')}
        </Text>
        <SegmentedControl.Root
          value={draft.resolution}
          onValueChange={(resolution) => setDraft((d) => switchResolution(d, resolution as Resolution))}
        >
          <SegmentedControl.Item value="daily">{t('nasa.dialog.daily')}</SegmentedControl.Item>
          <SegmentedControl.Item value="monthly">{t('nasa.dialog.monthly')}</SegmentedControl.Item>
        </SegmentedControl.Root>
        <Flex gap="3">
          {(['from', 'to'] as const).map((end) => (
            <Box key={end} flexGrow="1">
              <Text as="label" size="1" color="gray">
                {t(end === 'from' ? 'nasa.dialog.from' : 'nasa.dialog.to')}
                <TextField.Root
                  type={daily ? 'date' : 'number'}
                  min={daily ? FIRST_DATE : FIRST_DATE.slice(0, 4)}
                  max={daily ? today() : lastFullYear()}
                  value={draft[end]}
                  onChange={(e) => update({ [end]: e.target.value })}
                />
              </Text>
            </Box>
          ))}
        </Flex>
        <Text size="1" color="gray">
          {t(daily ? 'nasa.dialog.dailyHint' : 'nasa.dialog.monthlyHint')}
        </Text>
      </Flex>

      {problem && (
        <Callout.Root color="amber" size="1">
          <Callout.Text>{t(problem)}</Callout.Text>
        </Callout.Root>
      )}

      <Flex gap="3" justify="end">
        <Dialog.Close>
          <Button variant="soft" color="gray">
            {t('dialog.cancel')}
          </Button>
        </Dialog.Close>
        <Button disabled={!!problem} onClick={apply}>
          {t('dialog.apply')}
        </Button>
      </Flex>
    </Flex>
  )
}
