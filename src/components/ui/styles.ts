/** Join class names, skipping falsy values (a dependency-free clsx). */
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-white text-ink-700 ring-1 ring-ink-200 shadow-xs hover:bg-ink-50 hover:ring-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-sm [&_svg]:size-4',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm [&_svg]:size-4',
}

/** Shared button look, also usable on links (<a className={buttonClass()}>). */
export const buttonClass = ({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
}: { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean } = {}) =>
  cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    iconOnly && (size === 'sm' ? 'w-8 px-0' : 'w-9 px-0'),
  )

export const inputClass =
  'w-full rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-200 shadow-xs placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none'

/** Page width of editor and top bar: 66 % of the viewport, at least 64rem (1024 px), at most the screen. */
export const pageWidthClass = 'mx-auto w-[min(100%,max(66vw,64rem))]'

export const cardClass = 'rounded-2xl bg-white ring-1 ring-ink-200/80 shadow-sm shadow-ink-200/50'
