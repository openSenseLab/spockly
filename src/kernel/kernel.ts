import { create } from 'zustand'

import type { CellOutput, FieldInfo } from '../journal/types'
import type { InspectRequest, KernelRequest, KernelResponse, KernelStatus } from './protocol'

export type Schemas = Record<string, FieldInfo[]>

type KernelState = {
  status: KernelStatus
  /** Column info for every dataset currently held by Python; drives block dropdowns. */
  schemas: Schemas
  /** Layers inside GIS files, by file name or URL (for the layer dropdown). */
  layers: Record<string, string[]>
  /** Coordinate system of every GeoDataFrame, e.g. { nrw: { crs: 'EPSG:25832', projected: true } }. */
  crs: Record<string, CoordinateSystem>
}

export type CoordinateSystem = { crs: string; projected: boolean }

export const useKernelStore = create<KernelState>(() => ({ status: 'idle', schemas: {}, layers: {}, crs: {} }))

export class KernelError extends Error {
  /** Learner-facing error code (mapped from the Python exception in the worker) or null for raw Python errors. */
  code: string | null
  arg: string

  constructor(raw: string) {
    super(raw)
    const match = raw.match(/^SPK\|([^|]*)\|(.*)$/)
    this.code = match ? match[1] : null
    this.arg = match ? match[2] : ''
  }
}

type Pending = { resolve: (payload: string) => void; reject: (error: Error) => void }

let worker: Worker | null = null

const discardWorker = (reason: string) => {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) request.reject(new KernelError(reason))
  pending.clear()
  useKernelStore.setState({ schemas: {}, crs: {} })
}
let nextRequestId = 1
const pending = new Map<number, Pending>()

const handleMessage = ({ data }: MessageEvent<KernelResponse>) => {
  if (data.type === 'status') {
    useKernelStore.setState({ status: data.status })
    // After a crash Python cannot continue: answer waiting requests and start fresh next time.
    if (data.status === 'failed') discardWorker('SPK|kernel_crashed|')
    return
  }
  const request = pending.get(data.requestId)
  if (!request) return
  pending.delete(data.requestId)
  if (data.ok) request.resolve(data.payload)
  else request.reject(new KernelError(data.error))
}

const getWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = handleMessage
    worker.onerror = (event) => {
      useKernelStore.setState({ status: 'failed' })
      for (const request of pending.values()) request.reject(new KernelError(event.message))
      pending.clear()
    }
    worker.postMessage({ type: 'init' } satisfies KernelRequest)
  }
  return worker
}

type WithoutId<T> = T extends unknown ? Omit<T, 'requestId'> : never

const send = (request: WithoutId<Exclude<KernelRequest, { type: 'init' }>>) =>
  new Promise<string>((resolve, reject) => {
    const requestId = nextRequestId++
    pending.set(requestId, { resolve, reject })
    getWorker().postMessage({ ...request, requestId })
  })

/** Start downloading Python + pandas early so the first run feels fast. */
export const warmUpKernel = () => void getWorker()

export const runCode = async (code: string, files: Record<string, string> = {}, inspect: InspectRequest[] = []) => {
  const result = JSON.parse(await send({ type: 'run', code, files, inspect })) as {
    outputs: CellOutput[]
    schemas: Schemas
    crs: Record<string, CoordinateSystem>
  }
  const layers = { ...useKernelStore.getState().layers }
  for (const output of result.outputs) {
    if (output.type === 'inspection' && output.profile.layers?.length) layers[output.source.ref] = output.profile.layers
  }
  useKernelStore.setState({ schemas: result.schemas, layers, crs: result.crs ?? {} })
  return result.outputs
}

/** Kill the Python process (e.g. an endless loop) and start a fresh one. */
export const restartKernel = () => {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) request.reject(new KernelError('SPK|stopped|'))
  pending.clear()
  useKernelStore.setState({ status: 'idle', schemas: {}, crs: {} })
  warmUpKernel()
}

/** Forget all datasets (e.g. when another journal is opened) but keep Python loaded. */
export const resetKernel = async () => {
  useKernelStore.setState({ schemas: {}, crs: {} })
  if (worker) await send({ type: 'reset' }).catch(() => undefined)
}
