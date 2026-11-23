import { useRef } from 'react'

type Props = {
  height: number
  onChange: (height: number) => void
  min?: number
  label: string
}

/**
 * Drag handle to change a workspace's height (also with the arrow keys). Replaces CSS
 * `resize`, which needs a clipping container and would cut off Blockly's dropdown menus.
 */
export function ResizeHandle({ height, onChange, min = 140, label }: Props) {
  const start = useRef<{ y: number; height: number } | null>(null)

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(height)}
      tabIndex={0}
      className="group flex h-4 cursor-row-resize touch-none items-center justify-center outline-none"
      onPointerDown={(event) => {
        start.current = { y: event.clientY, height }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (start.current) onChange(Math.max(min, start.current.height + event.clientY - start.current.y))
      }}
      onPointerUp={() => (start.current = null)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') onChange(height + 40)
        if (event.key === 'ArrowUp') onChange(Math.max(min, height - 40))
      }}
    >
      <span className="h-1.5 w-12 rounded-full bg-ink-200 transition-colors group-hover:bg-brand-300 group-focus-visible:bg-brand-500" />
    </div>
  )
}
