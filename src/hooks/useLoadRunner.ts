import { useEffect, useRef } from 'react'

import { loadOperations } from '../blocks'
import { LoadError } from '../core/http'
import type { DataTable } from '../core/types'
import { useAppStore } from '../store/useAppStore'

/** Wait until the student stops typing in the block before hitting the network. */
const DEBOUNCE_MS = 600

/** Loaded tables by params; kept until the page reloads (spike — Phase 1 moves this into the executor). */
const cache = new Map<string, DataTable>()

/**
 * Spike runner for load steps. Runs on the main thread: fetch is async, and
 * mapping a few thousand rows is cheap. Phase 1 replaces this with the cached
 * executor in a worker.
 */
export function useLoadRunner() {
  const loadSteps = useAppStore((state) => state.loadSteps)
  const timers = useRef(new Map<string, number>())
  const controllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    const { loads, setLoadState } = useAppStore.getState()
    const ids = new Set(loadSteps.map((s) => s.id))

    // Blocks that were deleted: cancel and forget.
    for (const id of Object.keys(loads)) {
      if (ids.has(id)) continue
      window.clearTimeout(timers.current.get(id))
      controllers.current.get(id)?.abort()
      setLoadState(id, null)
    }

    for (const step of loadSteps) {
      const key = JSON.stringify([step.op, step.params])
      const current = loads[step.id]
      const inFlight = controllers.current.get(step.id)?.signal.aborted === false
      const run = loadOperations[step.op]
      if (!run || step.disabled || (current?.key === key && (current.status !== 'loading' || inFlight))) {
        continue
      }

      window.clearTimeout(timers.current.get(step.id))
      controllers.current.get(step.id)?.abort()

      const cached = cache.get(key)
      if (cached) {
        setLoadState(step.id, { key, status: 'ready', table: cached })
        continue
      }

      setLoadState(step.id, { key, status: 'loading' })
      const controller = new AbortController()
      controllers.current.set(step.id, controller)

      timers.current.set(
        step.id,
        window.setTimeout(async () => {
          const isCurrent = () => !controller.signal.aborted
          try {
            const table = await run(step.params, {
              signal: controller.signal,
              onProgress: (done, total, unit = 'rows') => {
                if (isCurrent()) setLoadState(step.id, { key, status: 'loading', progress: { done, total, unit } })
              },
            })
            cache.set(key, table)
            if (isCurrent()) setLoadState(step.id, { key, status: 'ready', table })
          } catch (error) {
            if (!isCurrent()) return
            console.error(`[${step.op}]`, error)
            const errorCode = error instanceof LoadError ? error.code : 'load.failed'
            setLoadState(step.id, { key, status: 'error', errorCode })
          }
        }, DEBOUNCE_MS),
      )
    }
  }, [loadSteps])

  useEffect(() => {
    const pendingTimers = timers.current
    const pendingControllers = controllers.current
    return () => {
      pendingTimers.forEach((timer) => window.clearTimeout(timer))
      pendingControllers.forEach((controller) => controller.abort())
    }
  }, [])
}
