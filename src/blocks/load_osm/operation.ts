import { getJson, LoadError } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { toOsmTable, type LoadOsmParams, type OverpassResponse } from './mapping'
import { osmArea, osmTopic, overpassQuery, OVERPASS_SERVERS, SERVER_TIMEOUT_MS, snapshotArea } from './presets'

/** Stored copies (public/data/osm), one per topic and area. */
export const snapshotUrl = ({ topic, area }: LoadOsmParams) => `${import.meta.env.BASE_URL}data/osm/${topic}-${area}.json`

/**
 * Asks the Overpass servers one after the other, each for at most
 * SERVER_TIMEOUT_MS. Null if none answered; a cancelled load still throws.
 */
async function askOverpass(query: string, { signal, onProgress }: ExecContext): Promise<OverpassResponse | null> {
  for (const [i, server] of OVERPASS_SERVERS.entries()) {
    onProgress?.(i + 1, OVERPASS_SERVERS.length, 'servers')
    const timeout = AbortSignal.timeout(SERVER_TIMEOUT_MS)
    try {
      const response = await getJson<OverpassResponse>(
        `${server}?data=${encodeURIComponent(query)}`,
        signal ? AbortSignal.any([signal, timeout]) : timeout,
      )
      if (Array.isArray(response?.elements)) return response
    } catch (error) {
      if (signal?.aborted) throw error
      console.info(`[osm] ${server} did not answer:`, error)
    }
  }
  return null
}

export async function loadOsm(params: LoadOsmParams, ctx: ExecContext = {}): Promise<DataTable> {
  const topic = osmTopic(params.topic)
  const area = osmArea(params.area)
  if (!topic || !area) throw new LoadError('load.failed', `unknown OSM topic or area ${params.topic}/${params.area}`)

  const live = await askOverpass(overpassQuery(topic, area.bbox), ctx)
  if (live) return toOsmTable(topic, params, live)

  // No server answered: the stored copy (Münster's, for cities without one), so students can keep working.
  const stored = { topic: params.topic, area: snapshotArea(params.area) }
  const copy = await getJson<OverpassResponse>(snapshotUrl(stored), ctx.signal)
  return toOsmTable(topic, stored, copy, { fromSnapshot: true, askedFor: params.area })
}

export const loadOsmOperation: OperationDef<LoadOsmParams> = {
  op: 'load_osm',
  kind: 'load',
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadOsm(params, ctx),
  // Runs in Pyodide: asks the servers in turn; the shapes stay as dicts in a "geometry" column.
  toCode: (params, { output = 'df' } = {}) => {
    const topic = osmTopic(params.topic)!
    const area = osmArea(params.area)!
    const derived = topic.derived
    const tags = JSON.stringify(Object.fromEntries(topic.columns.map((c) => [c.name, c.tag])))
    return {
      python:
        `import json\n` +
        `import pandas as pd\n` +
        `from urllib.parse import quote\n` +
        `from pyodide.http import open_url\n\n` +
        `abfrage = ${JSON.stringify(overpassQuery(topic, area.bbox))}\n` +
        `server = ${JSON.stringify(OVERPASS_SERVERS)}\n` +
        `antwort = None\n` +
        `for s in server:  # der erste Server, der antwortet\n` +
        `    try:\n` +
        `        antwort = json.load(open_url(s + "?data=" + quote(abfrage)))\n` +
        `        break\n` +
        `    except Exception as fehler:\n` +
        `        print("keine Antwort von", s, fehler)\n\n` +
        (derived ? `def ${derived.name}(t):  # die Art, aus mehreren Tags\n${derived.python}\n` : '') +
        `spalten = ${tags}  # Spalte → OpenStreetMap-Tag\n` +
        `zeilen = []\n` +
        `for e in antwort["elements"]:\n` +
        `    t = e.get("tags", {})\n` +
        `    zeile = {"name": t.get("name")}\n` +
        (derived ? `    zeile["${derived.name}"] = ${derived.name}(t)\n` : '') +
        `    zeile.update({spalte: t.get(tag) for spalte, tag in spalten.items()})\n` +
        `    zeile["osm_id"] = f"{e['type']}/{e['id']}"\n` +
        `    if "lat" in e:\n` +
        `        zeile["geometry"] = {"type": "Point", "coordinates": [e["lon"], e["lat"]]}\n` +
        `    elif "center" in e:\n` +
        `        zeile["geometry"] = {"type": "Point", "coordinates": [e["center"]["lon"], e["center"]["lat"]]}\n` +
        `    else:\n` +
        `        zeile["geometry"] = {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in e["geometry"]]}\n` +
        `    zeilen.append(zeile)\n\n` +
        `${output} = pd.DataFrame(zeilen)\n` +
        `print(${output})`,
    }
  },
}
