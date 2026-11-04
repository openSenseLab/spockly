import { getJson, LoadError } from '../../core/http'
import type { DataTable, OperationDef } from '../../core/types'
import {
  isSupportedField,
  UNSUPPORTED_TYPES,
  isValidDatasetId,
  isValidDomain,
  toDataTable,
  type HuwiseDatasetResponse,
  type HuwiseRecordsResponse,
} from './mapping'

export interface LoadHuwiseParams {
  domain: string
  datasetId: string
  maxRows: number
}

/** Explore API v2.1 limits: limit ≤ 100 per request, offset + limit ≤ 10 000. */
export const PAGE_SIZE = 100
export const MAX_ROWS = 10_000

export { LoadError }

const apiBase = (domain: string) => `https://${domain}/api/explore/v2.1`

export async function loadHuwise(
  { domain, datasetId, maxRows }: LoadHuwiseParams,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<DataTable> {
  const host = domain.trim().toLowerCase()
  const id = datasetId.trim()
  if (!isValidDomain(host)) throw new LoadError('load.invalidDomain', domain)
  if (!isValidDatasetId(id)) throw new LoadError('load.invalidDataset', datasetId)

  const datasetUrl = `${apiBase(host)}/catalog/datasets/${encodeURIComponent(id)}`
  const dataset = await getJson<HuwiseDatasetResponse>(datasetUrl, signal)

  const select = dataset.fields.filter(isSupportedField).map((f) => f.name)
  if (select.length === 0) throw new LoadError('load.noUsableFields', id)

  const wanted = Math.max(1, Math.min(maxRows, MAX_ROWS))
  const records: Record<string, unknown>[] = []
  let total = Infinity

  while (records.length < Math.min(wanted, total)) {
    const limit = Math.min(PAGE_SIZE, wanted - records.length)
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(records.length),
      select: select.join(','),
    })
    const page = await getJson<HuwiseRecordsResponse>(`${datasetUrl}/records?${query}`, signal)
    total = page.total_count
    records.push(...page.results)
    onProgress?.(records.length, Math.min(wanted, total))
    if (page.results.length < limit) break
  }

  return toDataTable(host, dataset, records, total === Infinity ? records.length : total)
}

export const loadHuwiseOperation: OperationDef<LoadHuwiseParams> = {
  op: 'load_huwise',
  kind: 'load',
  // Columns are only known after asking the portal, so a load step can't
  // infer its schema synchronously (open question for Phase 1).
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadHuwise(params, ctx),
  // Runs in Pyodide: Python can't open network connections in the browser,
  // so the download goes through the browser via open_url.
  // Like the app, it takes each column's type from the portal's description of the dataset.
  toCode: ({ domain, datasetId, maxRows }, { output = 'df' } = {}) => ({
    python:
      `import json\n` +
      `import pandas as pd\n` +
      `from pyodide.http import open_url\n\n` +
      `datensatz = "${apiBase(domain.trim().toLowerCase())}/catalog/datasets/${datasetId.trim()}"\n` +
      `# Das Portal beschreibt jede Spalte: Name und Typ (Zahl, Datum, Punkt, Form …); Anhänge bleiben weg\n` +
      `felder = [f for f in json.load(open_url(datensatz))["fields"] if f["type"] not in ${JSON.stringify([...UNSUPPORTED_TYPES])}]\n` +
      `url = datensatz + "/exports/json?limit=${Math.max(1, Math.min(maxRows, MAX_ROWS))}&select=" + ",".join(f["name"] for f in felder)\n` +
      `datensaetze = json.load(open_url(url))\n\n` +
      `spalten = {}\n` +
      `for f in felder:\n` +
      `    werte = [d.get(f["name"]) for d in datensaetze]\n` +
      `    if f["type"] == "geo_point_2d":  # ein Punkt → Breiten- und Längengrad\n` +
      `        spalten[f["name"] + "_lat"] = [w["lat"] if w else None for w in werte]\n` +
      `        spalten[f["name"] + "_lon"] = [w["lon"] if w else None for w in werte]\n` +
      `    elif f["type"] == "geo_shape":  # eine Form: nur ihre Geometrie\n` +
      `        spalten[f["name"]] = [w.get("geometry", w) if w else None for w in werte]\n` +
      `    elif f["type"] in ("int", "double"):\n` +
      `        spalten[f["name"]] = pd.to_numeric(pd.Series(werte, dtype="object"), errors="coerce")\n` +
      `    elif f["type"] in ("date", "datetime"):\n` +
      `        spalten[f["name"]] = pd.to_datetime(pd.Series(werte, dtype="object"), errors="coerce", utc=f["type"] == "datetime")\n` +
      `    else:  # Listen (mehrere Werte) als Text\n` +
      `        spalten[f["name"]] = [", ".join(map(str, w)) if isinstance(w, list) else w for w in werte]\n\n` +
      `${output} = pd.DataFrame(spalten)\n` +
      `print(${output})`,
  }),
}
