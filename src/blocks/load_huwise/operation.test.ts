import { afterEach, describe, expect, it, vi } from 'vitest'

import landMeta from './__fixtures__/georef-germany-land.meta.json'
import landRecords from './__fixtures__/georef-germany-land.records.json'
import { LoadError, loadHuwise } from './operation'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('loadHuwise', () => {
  it('requests metadata, then pages of at most 100 records without polygons', async () => {
    // Serves the recorded records page by page, as the real API would with limit/offset.
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (!url.pathname.endsWith('/records')) return json(landMeta)
      const offset = Number(url.searchParams.get('offset'))
      const limit = Number(url.searchParams.get('limit'))
      return json({
        total_count: landRecords.total_count,
        results: landRecords.results.slice(offset, offset + limit),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const progress: number[] = []
    const table = await loadHuwise(
      { domain: 'hub.huwise.com', datasetId: 'georef-germany-land', maxRows: 1000 },
      { onProgress: (done) => progress.push(done) },
    )

    expect(table.rows).toHaveLength(16)
    expect(progress).toEqual([16])
    const recordsUrl = new URL(String(fetchMock.mock.calls[1][0]))
    expect(recordsUrl.searchParams.get('limit')).toBe('100')
    expect(recordsUrl.searchParams.get('select')).not.toContain('geo_shape')
  })

  it('stops at maxRows and reports the total', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input))
        if (!url.pathname.endsWith('/records')) return json(landMeta)
        const limit = Number(url.searchParams.get('limit'))
        return json({ total_count: 16, results: landRecords.results.slice(0, limit) })
      }),
    )
    const table = await loadHuwise({
      domain: 'hub.huwise.com',
      datasetId: 'georef-germany-land',
      maxRows: 5,
    })
    expect(table.rows).toHaveLength(5)
    expect(table.meta.totalRecords).toBe(16)
  })

  it.each([
    [404, 'load.notFound'],
    [403, 'load.notPublic'],
    [429, 'load.tooManyRequests'],
    [500, 'load.failed'],
  ])('turns HTTP %i into %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, status)))
    await expect(
      loadHuwise({ domain: 'hub.huwise.com', datasetId: 'x', maxRows: 10 }),
    ).rejects.toMatchObject({ code })
  })

  it('reports an unreachable portal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(
      loadHuwise({ domain: 'no-such-portal.example', datasetId: 'x', maxRows: 10 }),
    ).rejects.toMatchObject({ code: 'load.unreachable' })
  })

  it('rejects malformed input before any request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      loadHuwise({ domain: 'evil.com/path?x=', datasetId: 'a', maxRows: 10 }),
    ).rejects.toBeInstanceOf(LoadError)
    await expect(
      loadHuwise({ domain: 'hub.huwise.com', datasetId: '../catalog', maxRows: 10 }),
    ).rejects.toMatchObject({ code: 'load.invalidDataset' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
