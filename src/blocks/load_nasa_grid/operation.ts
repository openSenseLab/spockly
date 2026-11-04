import { appUrl, getJson, LoadError } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { checkGridParams, gridRequestUrl, toGridTable, type LoadNasaGridParams, type PowerGridResponse } from './mapping'
// The outlines the app uses, also as a file of its own for the Python code.
import outlinesUrl from './outlines.json?url'

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
  // Runs in Pyodide (downloads go through the browser via open_url). Keeps only the cells
  // touching the area's outline, with the same test as the app (core/geometry: rectTouches).
  toCode: (params, { output = 'df' } = {}) => ({
    python:
      `import json\n` +
      `import pandas as pd\n` +
      `from pyodide.http import open_url\n\n` +
      `url = "${gridRequestUrl(params)}"\n` +
      `antwort = json.load(open_url(url))\n` +
      `fehlt = antwort["header"]["fill_value"]\n\n` +
      `# Die Anfrage ist ein Rechteck; die Frage gilt dem Gebiet. Nur Zellen, die seinen Umriss berühren, bleiben.\n` +
      `umriss = json.load(open_url("${appUrl(outlinesUrl)}"))["${params.area}"]\n` +
      `flaechen = [umriss["coordinates"]] if umriss["type"] == "Polygon" else umriss["coordinates"]\n\n` +
      `def im_ring(lon, lat, ring):  # Strahl nach rechts: wie oft kreuzt er den Rand?\n` +
      `    drin = False\n` +
      `    for (x1, y1), (x2, y2) in zip(ring, ring[-1:] + ring[:-1]):\n` +
      `        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:\n` +
      `            drin = not drin\n` +
      `    return drin\n\n` +
      `def im_gebiet(lon, lat):  # im äußeren Ring, aber in keinem Loch\n` +
      `    return any(im_ring(lon, lat, aussen) and not any(im_ring(lon, lat, loch) for loch in loecher) for aussen, *loecher in flaechen)\n\n` +
      `def beruehrt(w, s, o, n):  # eine Ecke oder die Mitte im Gebiet, oder ein Punkt des Umrisses in der Zelle\n` +
      `    proben = [(w, s), (w, n), (o, s), (o, n), ((w + o) / 2, (s + n) / 2)]\n` +
      `    punkte = [punkt for flaeche in flaechen for ring in flaeche for punkt in ring]\n` +
      `    return any(im_gebiet(x, y) for x, y in proben) or any(w <= x <= o and s <= y <= n for x, y in punkte)\n\n` +
      `def schritt(werte):  # Zellgröße: kleinster Abstand benachbarter Zellmitten\n` +
      `    werte = sorted(set(werte))\n` +
      `    return min((round(b - a, 6) for a, b in zip(werte, werte[1:]) if round(b - a, 6) > 0), default=None)\n\n` +
      `zellen = antwort["features"]\n` +
      `d_lon = schritt(z["geometry"]["coordinates"][0] for z in zellen)\n` +
      `d_lat = schritt(z["geometry"]["coordinates"][1] for z in zellen)\n` +
      `zeilen = []\n` +
      `for zelle in zellen:\n` +
      `    lon, lat, hoehe = zelle["geometry"]["coordinates"]\n` +
      `    if d_lon and d_lat:\n` +
      `        if not beruehrt(lon - d_lon / 2, lat - d_lat / 2, lon + d_lon / 2, lat + d_lat / 2):\n` +
      `            continue\n` +
      `    elif not im_gebiet(lon, lat):\n` +
      `        continue\n` +
      `    for monat, wert in zelle["properties"]["parameter"]["${params.parameter}"].items():\n` +
      `        if monat.endswith("13"):  # Monat 13 = Jahreswert\n` +
      `            continue\n` +
      `        zeilen.append({"date": monat, "${params.parameter}": None if wert == fehlt else wert, "lat": lat, "lon": lon, "hoehe": hoehe})\n\n` +
      `${output} = pd.DataFrame(zeilen)\n` +
      `${output}["date"] = pd.to_datetime(${output}["date"], format="%Y%m")\n` +
      `print(${output})`,
  }),
}
