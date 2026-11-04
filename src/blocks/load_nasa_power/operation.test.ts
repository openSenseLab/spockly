import { afterEach, describe, expect, it, vi } from 'vitest'

import dailyJanuary from './__fixtures__/daily-muenster-2025-01.json'
import rejected from './__fixtures__/error-422-start-date.json'
import { DEFAULT_PARAMS } from './mapping'
import { loadNasaPower, loadNasaPowerOperation } from './operation'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('loadNasaPower', () => {
  it('loads one table from one request', async () => {
    const fetchMock = vi.fn(async () => json(dailyJanuary))
    vi.stubGlobal('fetch', fetchMock)
    const table = await loadNasaPower({ ...DEFAULT_PARAMS, from: '2025-01-01', to: '2025-01-10' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(table.rows).toHaveLength(10)
  })

  it('checks the settings before asking the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadNasaPower({ ...DEFAULT_PARAMS, variables: [] })).rejects.toMatchObject({ code: 'load.nasaNoVariables' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('turns a rejected request (HTTP 422) into a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(rejected, 422)))
    await expect(loadNasaPower(DEFAULT_PARAMS)).rejects.toMatchObject({ code: 'load.nasaRejected' })
  })
})

describe('Python code', () => {
  it('has the date, the values and the grid point as columns, like the app', () => {
    const code = loadNasaPowerOperation.toCode!(DEFAULT_PARAMS, { output: 'wetter' }).python
    expect(code).toContain('wetter = wetter.rename_axis("date").reset_index()')
    expect(code).toContain('lon, lat = antwort["geometry"]["coordinates"][:2]')
    expect(code).toContain('wetter = wetter[["date"] + werte + ["lat", "lon"]]')
  })
})
