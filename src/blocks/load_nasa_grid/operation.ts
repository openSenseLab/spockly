import { getJson, LoadError } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { checkGridParams, gridRequestUrl, toGridTable, type LoadNasaGridParams, type PowerGridResponse } from './mapping'

export const today = () => new Date().toISOString().slice(0, 10)

export async function loadNasaGrid(params: LoadNasaGridParams, { signal }: ExecContext = {}): Promise<DataTable> {
  const problem = checkGridParams(params, today())
  if (problem) throw new LoadError(problem)
  let response: PowerGridResponse
  try {
    response = await getJson<PowerGridResponse>(gridRequestUrl(params), signal)
  } catch (error) {
    // POWER answers 422 with a reason for settings it rejects; the reason goes to the console.
    if (error instanceof LoadError && error.code === 'load.failed' && error.message.startsWith('422')) {
      throw new LoadError('load.nasaRejected', error.message)
    }
    throw error
  }
  if (!Array.isArray(response.features) || response.features.length === 0) {
    throw new LoadError('load.failed', `no grid cells: ${JSON.stringify(response.messages ?? [])}`)
  }
  return toGridTable(params, response, today())
}

export const loadNasaGridOperation: OperationDef<LoadNasaGridParams> = {
  op: 'load_nasa_grid',
  kind: 'load',
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadNasaGrid(params, ctx),
  // Runs in Pyodide (downloads go through the browser via open_url).
  toCode: (params, { output = 'df' } = {}) => ({
    python:
      `import json\n` +
      `import pandas as pd\n` +
      `from pyodide.http import open_url\n\n` +
      `url = "${gridRequestUrl(params)}"\n` +
      `antwort = json.load(open_url(url))\n` +
      `fehlt = antwort["header"]["fill_value"]\n` +
      `zeilen = []\n` +
      `for zelle in antwort["features"]:\n` +
      `    lon, lat, hoehe = zelle["geometry"]["coordinates"]\n` +
      `    for monat, wert in zelle["properties"]["parameter"]["${params.parameter}"].items():\n` +
      `        if monat.endswith("13"):  # Monat 13 = Jahreswert\n` +
      `            continue\n` +
      `        zeilen.append({"date": monat, "${params.parameter}": None if wert == fehlt else wert, "lat": lat, "lon": lon, "hoehe": hoehe})\n\n` +
      `${output} = pd.DataFrame(zeilen)\n` +
      `${output}["date"] = pd.to_datetime(${output}["date"], format="%Y%m")\n` +
      `print(${output})`,
  }),
}
