/** Shared fetch helpers for load operations. */

/** Error with an i18n key, so the block can show a friendly message. */
export class LoadError extends Error {
  readonly code: string
  constructor(code: string, detail?: string) {
    super(detail ?? code)
    this.code = code
  }
}

/** Wait before the one retry, so a briefly overloaded server can recover. */
const RETRY_DELAY_MS = 1000

/** Problems that often go away on a second try. */
const isTransient = (error: unknown) =>
  error instanceof LoadError && (error.code === 'load.unreachable' || error.code === 'load.serverTrouble')

/**
 * GET a JSON document; network and HTTP problems become LoadErrors. A network
 * error, a server error (5xx) or a cut-off response is tried once more.
 */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    return await getJsonOnce<T>(url, signal)
  } catch (error) {
    if (signal?.aborted || !isTransient(error)) throw error
    await wait(RETRY_DELAY_MS, signal)
    return getJsonOnce<T>(url, signal)
  }
}

async function getJsonOnce<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    // DNS failure, offline, CORS — fetch only tells us "TypeError".
    throw new LoadError('load.unreachable', String(error))
  }
  if (res.status === 404) throw new LoadError('load.notFound', url)
  if (res.status === 401 || res.status === 403) throw new LoadError('load.notPublic', url)
  if (res.status === 429) throw new LoadError('load.tooManyRequests', url)
  if (res.status >= 500) throw new LoadError('load.serverTrouble', `${res.status} ${url}`)
  if (!res.ok) throw new LoadError('load.failed', `${res.status} ${url}`)
  try {
    return (await res.json()) as T
  } catch (error) {
    if (signal?.aborted) throw error
    // Seen on openSenseMap under load: the connection drops in the middle of the data.
    throw new LoadError('load.serverTrouble', `${String(error)} ${url}`)
  }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

/** Runs `task` for every item, at most `limit` at a time, in input order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
