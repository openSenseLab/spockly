import { LoaderCircle } from 'lucide-react'
import { DropdownMenu, Dialog as DialogPrimitive, HoverCard as HoverCardPrimitive, Tabs as TabsPrimitive, ToggleGroup, Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

import { buttonClass, cn, type ButtonSize, type ButtonVariant } from './styles'

/* Buttons ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({ variant, size, loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonClass({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" />}
      {children}
    </button>
  )
}

export function IconButton({
  variant = 'ghost',
  size = 'sm',
  label,
  className,
  children,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(buttonClass({ variant, size, iconOnly: true }), className)}
      {...props}
    >
      {children}
    </button>
  )
}

/* Badge & callout ------------------------------------------------------------ */

const TONES = {
  gray: 'bg-ink-100 text-ink-600 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  orange: 'bg-orange-50 text-orange-700 ring-orange-100',
  green: 'bg-leaf-50 text-leaf-700 ring-leaf-100',
  purple: 'bg-violet-50 text-violet-700 ring-violet-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  brown: 'bg-stone-100 text-stone-700 ring-stone-200',
} as const

export type Tone = keyof typeof TONES

export function Badge({ tone = 'gray', className, ...props }: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Callout({ tone = 'brand', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 ring-inset [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', TONES[tone], className)}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* Tooltip & hover card -------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-72 animate-fade-in rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function HoverCard({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <HoverCardPrimitive.Root openDelay={150}>
      <HoverCardPrimitive.Trigger asChild>{trigger}</HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          sideOffset={6}
          className="z-50 w-72 animate-fade-in rounded-xl bg-white p-3 text-sm text-ink-700 shadow-xl ring-1 ring-ink-200"
        >
          {children}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  )
}

/* Menus ------------------------------------------------------------------------ */

export const Menu = DropdownMenu.Root
export const MenuTrigger = (props: ComponentProps<typeof DropdownMenu.Trigger>) => <DropdownMenu.Trigger asChild {...props} />

export function MenuContent({ className, align = 'end', ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-52 animate-fade-in rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-ink-200', className)}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({ className, danger, ...props }: ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-40 [&>svg]:size-4 [&>svg]:shrink-0',
        danger ? 'text-red-600 data-[highlighted]:bg-red-50' : 'text-ink-700 data-[highlighted]:bg-ink-100',
        className,
      )}
      {...props}
    />
  )
}

export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-ink-100" />

/* Dialog ------------------------------------------------------------------------ */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink-900/30 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-ink-200">
          <DialogPrimitive.Title className="text-lg font-semibold text-ink-900">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1.5 text-sm text-ink-600">{description}</DialogPrimitive.Description>
          )}
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* Tabs ---------------------------------------------------------------------------- */

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 overflow-x-auto border-b border-ink-200', className)} {...props} />
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-500 transition-colors hover:text-ink-800 data-[state=active]:border-brand-600 data-[state=active]:text-brand-700 [&>svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('pt-4 outline-none', className)} {...props} />
}

/* Segmented control ---------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className="inline-flex shrink-0 items-center rounded-lg bg-ink-100 p-0.5 ring-1 ring-ink-200/60"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-800 data-[state=on]:bg-white data-[state=on]:text-ink-900 data-[state=on]:shadow-sm [&>svg]:size-3.5"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/* Misc ------------------------------------------------------------------------------ */

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-brand-500 transition-[width] duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin text-brand-600', className)} />
}

/** The spockly mark: stacked blocks in a gradient tile. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-leaf-500 to-brand-500 shadow-sm shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="currentColor" aria-hidden>
          <rect x="3" y="4" width="11" height="6" rx="2" />
          <rect x="7" y="12" width="14" height="6" rx="2" opacity="0.75" />
        </svg>
      </span>
      {!compact && <span className="hidden text-lg font-semibold tracking-tight text-ink-900 sm:inline">spockly</span>}
    </span>
  )
}
