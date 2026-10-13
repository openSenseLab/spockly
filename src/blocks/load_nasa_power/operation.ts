import { getJson, LoadError } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { checkParams, requestUrl, toDataTable, type LoadNasaParams, type PowerResponse } from './mapping'

const today = () => new Date().toISOString().slice(0, 10)

export async function loadNasaPower(params: LoadNasaParams, { signal }: ExecContext = {}): Promise<DataTable> {
  const problem = checkParams(params, today())
  if (problem) throw new LoadError(problem)
  let response: PowerResponse
  try {
    response = await getJson<PowerResponse>(requestUrl(params), signal)
  } catch (error) {
    // POWER answers 422 with a reason for settings it rejects; the reason goes to the console.
    if (error instanceof LoadError && error.code === 'load.failed' && error.message.startsWith('422')) {
      throw new LoadError('load.nasaRejected', error.message)
    }
    throw error
  }
  if (!response.properties?.parameter) throw new LoadError('load.failed', 'no properties.parameter')
  return toDataTable(params, response, today())
}

export const loadNasaPowerOperation: OperationDef<LoadNasaParams> = {
  op: 'load_nasa_power',
  kind: 'load',
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadNasaPower(params, ctx),
  // Runs in Pyodide (downloads go through the browser via open_url).
  toCode: (params, { output = 'df' } = {}) => {
    const monthly = params.resolution === 'monthly'
    return {
      python:
        `import json\n` +
        `import pandas as pd\n` +
        `from pyodide.http import open_url\n\n` +
        `url = "${requestUrl(params)}"\n` +
        `antwort = json.load(open_url(url))\n` +
        `${output} = pd.DataFrame(antwort["properties"]["parameter"])\n` +
        (monthly ? `${output} = ${output}[~${output}.index.str.endswith("13")]  # Monat 13 = Jahreswert\n` : '') +
        `${output}.index = pd.to_datetime(${output}.index, format="${monthly ? '%Y%m' : '%Y%m%d'}")\n` +
        `${output} = ${output}.replace(antwort["header"]["fill_value"], float("nan"))  # fehlende Werte\n` +
        `print(${output})`,
    }
  },
}
