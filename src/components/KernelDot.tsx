import { useT } from '../i18n'
import { useKernelStore } from '../kernel/kernel'
import { Tooltip } from './ui'
import { cn } from './ui/styles'

const DOT = {
  idle: 'bg-amber-400 status-pulse',
  loading: 'bg-amber-400 status-pulse',
  ready: 'bg-leaf-500',
  failed: 'bg-red-500',
}

/** Python status as a small pill: a coloured dot, with the label on wider screens. */
export function KernelDot() {
  const t = useT()
  const status = useKernelStore((state) => state.status)
  return (
    <Tooltip content={t.kernel.hint}>
      <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white px-2.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200">
        <span className={cn('status-dot', DOT[status])} />
        <span className="hidden lg:inline">{t.kernel.status[status]}</span>
      </span>
    </Tooltip>
  )
}
