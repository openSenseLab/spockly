import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Flex, IconButton, Link, Popover, Text } from '@radix-ui/themes'

import type { GlossaryEntry } from '../glossary'
import { pick, t } from '../i18n'

/** Hovering opens after a short delay, so passing over the button doesn't flash it. */
const OPEN_DELAY_MS = 250
/** Leaving closes after a short delay, so the pointer can move into the box. */
const CLOSE_DELAY_MS = 200

/**
 * A small "?" that explains a measured quantity: what it is, a reference
 * value to compare with, and where the facts come from. With a mouse it opens
 * on hover; a click (or a tap on touch screens) keeps it open.
 */
export function GlossaryInfo({ entry }: { entry: GlossaryEntry | undefined }) {
  const [open, setOpen] = useState(false)
  /** Opened by a click/tap: stays open until clicked again or closed outside. */
  const [pinned, setPinned] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!entry) return null
  const reference = pick(entry.reference)

  const later = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(fn, ms)
  }
  // Touch has no hover: only the mouse opens on pointing.
  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') later(() => setOpen(true), OPEN_DELAY_MS)
  }
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !pinned) later(() => setOpen(false), CLOSE_DELAY_MS)
  }
  /** Click, tap or Enter/Space: pin it open, or close it if it was pinned. */
  const toggle = () => {
    window.clearTimeout(timer.current)
    setPinned(!pinned)
    setOpen(!pinned)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, pinned or not.
        if (!next) {
          setOpen(false)
          setPinned(false)
        }
      }}
    >
      <Popover.Trigger>
        {/*
          A <span>, not a <button>: the selectable cards are <label>s, and a
          click on a label goes to the first button inside it. A real button
          here would take every click on the card away from its checkbox.
        */}
        <IconButton
          asChild
          size="1"
          variant="soft"
          radius="full"
          className="glossary-trigger"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            // preventDefault also stops the surrounding label from ticking its card.
            e.preventDefault()
            e.stopPropagation()
            toggle()
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            e.stopPropagation()
            toggle()
          }}
        >
          <span
            role="button"
            tabIndex={0}
            aria-label={t('glossary.whatIs', { name: pick(entry.title) ?? '' })}
            title={t('glossary.whatIs', { name: pick(entry.title) ?? '' })}
          >
            ?
          </span>
        </IconButton>
      </Popover.Trigger>
      <Popover.Content
        maxWidth="340px"
        size="1"
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={() => window.clearTimeout(timer.current)}
        onPointerLeave={onPointerLeave}
        // Hovering shouldn't pull focus away from where the student is working.
        onOpenAutoFocus={(e) => {
          if (!pinned) e.preventDefault()
        }}
      >
        <Flex direction="column" gap="2">
          <Text weight="bold" size="2">
            {pick(entry.title)}
          </Text>
          <Text size="2">{pick(entry.explanation)}</Text>
          {reference && (
            <Text size="2">
              <Text weight="bold">{t('glossary.reference')}</Text> {reference}
            </Text>
          )}
          {entry.sources.length > 0 && (
            <Text size="1" color="gray">
              {t('glossary.sources')}{' '}
              {entry.sources.map((source, i) => (
                <span key={source.url}>
                  {i > 0 && ' · '}
                  <Link href={source.url} target="_blank" rel="noreferrer">
                    {source.label}
                  </Link>
                </span>
              ))}
            </Text>
          )}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )
}
