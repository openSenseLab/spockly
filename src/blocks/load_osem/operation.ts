import { getJson, LoadError, mapLimit } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import {
  boxesInArea,
  phenomenonColumns,
  MAX_STATIONS,
  SENSOR_LIMIT,
  nextPageEnd,
  stationsFor,
  timeWindow,
  toDataTable,
  type LoadOsemParams,
  type OsemBox,
  type OsemMeasurement,
  type OsemSource,
  TO_HPA,
} from './mapping'
import { areaPreset, PERIODS } from './presets'

export const OSEM_API = 'https://api.opensensemap.org'

/** Sensor requests running at the same time. */
const PARALLEL_REQUESTS = 4
/** The box list changes slowly; reuse it between the setup window and the load. */
const BOX_CACHE_MS = 5 * 60 * 1000

const boxCache = new Map<string, { at: number; boxes: Promise<OsemBox[]> }>()

export function boxesUrl(source: OsemSource, outdoorOnly: boolean): string {
  const query = new URLSearchParams({ format: 'json' })
  if (source.kind === 'area') {
    const preset = areaPreset(source.area)
    if (!preset) throw new LoadError('load.osemUnknownArea', source.area)
    query.set('bbox', preset.bbox.join(','))
  } else {
    const tag = source.tag.trim()
    if (!tag) throw new LoadError('load.osemNoTag')
    query.set('grouptag', tag)
  }
  if (outdoorOnly) query.set('exposure', 'outdoor')
  return `${OSEM_API}/boxes?${query}`
}

export function fetchBoxes(source: OsemSource, outdoorOnly: boolean, signal?: AbortSignal) {
  const url = boxesUrl(source, outdoorOnly)
  const cached = boxCache.get(url)
  if (cached && Date.now() - cached.at < BOX_CACHE_MS) return cached.boxes
  // Not tied to one caller's signal: the cached request is shared.
  const preset = source.kind === 'area' ? areaPreset(source.area) : undefined
  const boxes = getJson<OsemBox[]>(url).then((all) => (preset ? boxesInArea(all, preset.bbox) : all))
  boxCache.set(url, { at: Date.now(), boxes })
  boxes.catch(() => boxCache.delete(url))
  return signal ? raceAbort(boxes, signal) : boxes
}

const raceAbort = <T>(promise: Promise<T>, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    promise.then(resolve, reject)
  })

let tagsPromise: Promise<string[]> | null = null

/** All group tags on openSenseMap, sorted. */
export function fetchTags(): Promise<string[]> {
  // The live list contains null entries next to the strings.
  tagsPromise ??= getJson<{ data?: unknown[] }>(`${OSEM_API}/tags`)
    .then((r) => {
      const tags = (r.data ?? []).filter((t): t is string => typeof t === 'string')
      return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'))
    })
    .catch((error) => {
      tagsPromise = null
      throw error
    })
  return tagsPromise
}

async function fetchSensorValues(
  boxId: string,
  sensorId: string,
  from: Date,
  to: Date,
  signal?: AbortSignal,
): Promise<OsemMeasurement[]> {
  const values: OsemMeasurement[] = []
  let end: Date | null = to
  while (end) {
    const query = new URLSearchParams({
      'from-date': from.toISOString(),
      'to-date': end.toISOString(),
      format: 'json',
    })
    const page = await getJson<OsemMeasurement[]>(
      `${OSEM_API}/boxes/${encodeURIComponent(boxId)}/data/${encodeURIComponent(sensorId)}?${query}`,
      signal,
    )
    values.push(...page)
    end = nextPageEnd(page, from)
  }
  return values
}

export async function loadOsem(
  params: LoadOsemParams,
  { signal, onProgress }: ExecContext = {},
  now = new Date(),
): Promise<DataTable> {
  if (!(params.period in PERIODS)) throw new LoadError('load.failed', `period ${params.period}`)
  const window = timeWindow(params.period, now)

  const boxes = await fetchBoxes(params.source, params.outdoorOnly, signal)
  const found = stationsFor(boxes, params.phenomena, window.from)
  if (found.length === 0) throw new LoadError('load.osemNoStations')
  const stations = found.slice(0, MAX_STATIONS)

  let done = 0
  onProgress?.(0, stations.length, 'stations')
  // A few stations at a time; each station's sensors one after another.
  const perStation = await mapLimit(stations, PARALLEL_REQUESTS, async ({ box, sensors }) => {
    const results = []
    for (const sensor of sensors) {
      const values = await fetchSensorValues(box._id, sensor._id, window.from, window.to, signal)
      results.push({ box, sensor, values })
    }
    onProgress?.(++done, stations.length, 'stations')
    return results
  })

  return toDataTable(params, perStation.flat(), window, found.length)
}

export const loadOsemOperation: OperationDef<LoadOsemParams> = {
  op: 'load_osem',
  kind: 'load',
  // Columns are fixed for this loader, but whether data exists is only known after asking.
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadOsem(params, ctx),
  // Runs in Pyodide (downloads go through the browser via open_url). Picks the stations and builds
  // the table as the app does (mapping.ts: boxesInArea, stationsFor, nextPageEnd, toDataTable).
  toCode: ({ source, phenomena, period, outdoorOnly }, { output = 'df' } = {}) => {
    const boxQuery = boxesUrl(source, outdoorOnly).slice(OSEM_API.length)
    const area = source.kind === 'area' ? areaPreset(source.area) : undefined
    // Sensor title → column name, as in the app's table.
    const names = phenomenonColumns(phenomena)
    const columns = JSON.stringify(Object.fromEntries(phenomena.map((title, i) => [title, names[i]])))
    return {
      python:
        `import json\n` +
        `import pandas as pd\n` +
        `from datetime import datetime, timedelta, timezone\n` +
        `from pyodide.http import open_url\n\n` +
        `api = "${OSEM_API}"\n` +
        `bis = datetime.now(timezone.utc)\n` +
        `von = bis - timedelta(days=${PERIODS[period].days})\n\n` +
        `def iso(t):  # Zeitpunkt, wie die API ihn erwartet\n` +
        `    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"\n\n` +
        `def zeitpunkt(text):\n` +
        `    return datetime.fromisoformat(text.replace("Z", "+00:00"))\n\n` +
        `boxen = json.load(open_url(api + "${boxQuery}"))\n` +
        (area
          ? `# Die API liefert auch Stationen, die inzwischen woanders stehen: nur die, die jetzt im Gebiet sind\n` +
            `w, s, o, n = ${JSON.stringify(area.bbox)}\n` +
            `boxen = [b for b in boxen if w <= b["currentLocation"]["coordinates"][0] <= o and s <= b["currentLocation"]["coordinates"][1] <= n]\n`
          : '') +
        `spalten = ${columns}  # Sensor → Spalte\n` +
        `# Stationen, die im Zeitraum gemessen haben und eine der Messgrößen haben; die zuletzt aktiven zuerst, höchstens ${MAX_STATIONS}\n` +
        `stationen = [b for b in boxen if b.get("lastMeasurementAt") and zeitpunkt(b["lastMeasurementAt"]) >= von\n` +
        `             and any(sensor["title"] in spalten for sensor in b.get("sensors", []))]\n` +
        `stationen.sort(key=lambda b: zeitpunkt(b["lastMeasurementAt"]), reverse=True)\n` +
        `stationen = stationen[:${MAX_STATIONS}]\n\n` +
        `# Luftdruck immer in hPa (ein paar Stationen melden Pa)\n` +
        `faktor = ${JSON.stringify(TO_HPA)}\n` +
        `zeilen = {}  # eine Zeile pro Station und Zeitpunkt, eine Spalte pro Messgröße\n` +
        `for box in stationen:\n` +
        `    for titel, spalte in spalten.items():\n` +
        `        sensor = next((x for x in box["sensors"] if x["title"] == titel), None)\n` +
        `        if sensor is None:\n` +
        `            continue\n` +
        `        umrechnung = faktor.get((sensor.get("unit") or "").strip(), 1)\n` +
        `        ende = bis\n` +
        `        while True:  # höchstens ${SENSOR_LIMIT} Werte pro Anfrage, die neuesten zuerst\n` +
        `            url = f"{api}/boxes/{box['_id']}/data/{sensor['_id']}?from-date={iso(von)}&to-date={iso(ende)}&format=json"\n` +
        `            seite = json.load(open_url(url))\n` +
        `            for wert in seite:\n` +
        `                ort = wert.get("location") or box["currentLocation"]["coordinates"]\n` +
        `                zeile = zeilen.setdefault((box["_id"], wert["createdAt"]), {\n` +
        `                    "time": wert["createdAt"], **{name: None for name in spalten.values()},\n` +
        `                    "station": box["name"], "station_id": box["_id"], "lat": ort[1], "lon": ort[0], "exposure": box.get("exposure")})\n` +
        `                try:\n` +
        `                    zeile[spalte] = float(f"{float(wert['value']) * umrechnung:.12g}")\n` +
        `                except ValueError:\n` +
        `                    zeile[spalte] = None\n` +
        `            # Volle Seite: die nächste endet kurz vor dem ältesten Wert\n` +
        `            if len(seite) < ${SENSOR_LIMIT}:\n` +
        `                break\n` +
        `            aeltester = min(zeitpunkt(wert["createdAt"]) for wert in seite)\n` +
        `            if aeltester <= von:\n` +
        `                break\n` +
        `            ende = aeltester - timedelta(milliseconds=1)\n\n` +
        `${output} = pd.DataFrame(sorted(zeilen.values(), key=lambda z: (z["time"], z["station"])))\n` +
        `print(${output})`,
    }
  },
}
