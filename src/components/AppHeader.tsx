import type { ReactNode } from 'react'

import { Logo } from './ui'
import { cn, pageWidthClass } from './ui/styles'

/** Sticky top bar shared by editor, lab and viewer. */
export function AppHeader({ left, right, wide = false }: { left?: ReactNode; right?: ReactNode; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/80 backdrop-blur-lg">
      <div className={cn('flex h-14 items-center gap-3 px-4', wide ? 'mx-auto' : pageWidthClass)}>
        <a href={`${import.meta.env.BASE_URL}#/`} className="shrink-0 rounded-lg" aria-label="spockly">
          <Logo />
        </a>
        {left}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 sm:gap-2">{right}</div>
      </div>
    </header>
  )
}
