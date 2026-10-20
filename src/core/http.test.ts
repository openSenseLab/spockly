import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getJson } from './http'

const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
const status = (code: number) => new Response('{}', { status: code })

describe('getJson', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** Runs getJson and lets the retry delay pass. */
  async function run(url = 'https://example.org/x', signal?: AbortSignal) {
    const result = getJson(url, signal).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    )
    await vi.runAllTimersAsync()
    return result
  }

  it('tries a server error once more', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok('[1]'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await run()).toEqual({ value: [1] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tries a cut-off response once more, then reports server trouble', async () => {
    const fetchMock = vi.fn(async () => ok('[{"value":"-40"},{"val'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await run()).toMatchObject({ error: { code: 'load.serverTrouble' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tries a network error once more', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok('{}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await run()).toEqual({ value: {} })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    [404, 'load.notFound'],
    [422, 'load.failed'],
    [429, 'load.tooManyRequests'],
  ])('does not retry HTTP %i', async (code, errorCode) => {
    const fetchMock = vi.fn(async () => status(code))
    vi.stubGlobal('fetch', fetchMock)
    expect(await run()).toMatchObject({ error: { code: errorCode } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops waiting for the retry when the load is cancelled', async () => {
    const fetchMock = vi.fn(async () => status(500))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const result = getJson('https://example.org/x', controller.signal).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    await vi.runAllTimersAsync()
    expect(await result).toBeInstanceOf(DOMException)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
