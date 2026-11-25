import { loadPyodide, version as pyodideVersion, type PyodideInterface } from 'pyodide'

import type { KernelRequest, KernelResponse } from './protocol'
import runtimeSource from './runtime.py?raw'

type WorkerScope = {
  onmessage: ((event: MessageEvent<KernelRequest>) => void) | null
  postMessage: (message: KernelResponse) => void
}

type PyProxy = { destroy: () => void }

const scope = self as unknown as WorkerScope
const indexURL = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`
/** Uploaded files land in the working directory, so pd.read_csv("file.csv") just works. */
const HOME = '/home/pyodide'

/** Pure-Python packages that Pyodide does not ship; installed from PyPI when first used. */
const FOLIUM = ['branca==0.8.2', 'folium==0.20.0']

let pyodidePromise: Promise<PyodideInterface> | null = null
/** The notebook's global namespace: variables survive between cells, like a Jupyter kernel. */
let namespace: PyProxy | null = null
const installed = new Set<string>()

const newNamespace = (pyodide: PyodideInterface) => (pyodide.globals.get('dict') as () => PyProxy)()

const boot = async () => {
  scope.postMessage({ type: 'status', status: 'loading' })
  const pyodide = await loadPyodide({ indexURL })
  await pyodide.loadPackage(['numpy', 'pandas', 'pyodide-http', 'micropip'])
  pyodide.FS.writeFile(`${HOME}/spockly_runtime.py`, runtimeSource)
  // pyodide-http makes urllib (pd.read_csv(url)) and requests work in the browser.
  await pyodide.runPythonAsync('import pyodide_http\npyodide_http.patch_all()\nimport spockly_runtime')
  namespace = newNamespace(pyodide)
  scope.postMessage({ type: 'status', status: 'ready' })
  return pyodide
}

const getPyodide = () => {
  pyodidePromise ??= boot()
  return pyodidePromise
}

const installOnce = async (key: string, install: () => Promise<unknown>) => {
  if (installed.has(key)) return
  await install()
  installed.add(key)
}

/** URL of a wheel in Pyodide's own package repository. */
const wheelOf = async (name: string) => {
  const lock = (await (await fetch(`${indexURL}pyodide-lock.json`)).json()) as {
    packages: Record<string, { file_name: string }>
  }
  return `${indexURL}${lock.packages[name].file_name}`
}

/**
 * Load the packages the code imports. GeoPandas is installed without fiona
 * (11 MB, only needed for read_file); folium comes from PyPI.
 */
const ensurePackages = async (pyodide: PyodideInterface, code: string) => {
  const findImports = pyodide.pyimport('pyodide.code').find_imports as (code: string) => PyProxy & { toJs: () => string[] }
  const found = findImports(code)
  const imports = new Set(found.toJs())
  found.destroy()
  const micropip = pyodide.pyimport('micropip') as PyProxy & {
    install: { callKwargs: (pkgs: unknown, kwargs: Record<string, unknown>) => Promise<void> }
  }
  // deps=False: dependencies are loaded explicitly above (and fiona deliberately not at all).
  const install = (pkgs: string | string[]) => micropip.install.callKwargs(pyodide.toPy(pkgs), { deps: false })

  if (imports.has('geopandas')) {
    await installOnce('geopandas', async () => {
      await pyodide.loadPackage(['shapely', 'pyproj', 'packaging', 'certifi'])
      await install(await wheelOf('geopandas'))
    })
  }
  if (imports.has('folium') || imports.has('branca')) {
    await installOnce('folium', async () => {
      await pyodide.loadPackage(['jinja2', 'requests', 'xyzservices', 'markupsafe'])
      await install(FOLIUM)
    })
  }
  // gpd.read_file (Shapefile, GeoPackage, KML, …) needs GDAL, which comes with fiona (11 MB).
  if (code.includes('read_file(')) await installOnce('fiona', () => pyodide.loadPackage('fiona'))
  // pandas' Styler (df.style) needs jinja2 without the learner's code importing it.
  if (code.includes('.style.')) await installOnce('jinja2', () => pyodide.loadPackage('jinja2'))
  micropip.destroy()

  const rest = [...imports].filter((name) => !['geopandas', 'folium', 'branca'].includes(name))
  if (rest.length) await pyodide.loadPackagesFromImports(rest.map((name) => `import ${name}`).join('\n'))
  if (imports.has('requests') || imports.has('folium')) await pyodide.runPythonAsync('import pyodide_http\npyodide_http.patch_all()')
}

/**
 * Turn the last line of a Python traceback into a learner-friendly coded message
 * (translated in the browser), or keep Python's own message with its line number.
 */
const cleanError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const coded = message.match(/SPK\|[^\n]*/)
  if (coded) return coded[0]
  const lines = message.trim().split('\n').filter(Boolean)
  const last = lines.at(-1) ?? message
  const line = [...message.matchAll(/File "journal\.py", line (\d+)/g)].at(-1)?.[1]
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^NameError: name '([^']+)' is not defined/, (m) => `SPK|missing_dataset|${m[1]}`],
    [/^KeyError: ["']?(.+?)["']?$/, (m) => `SPK|missing_column|${m[1]}`],
    [/None of \[Index\(\[['"]?([^'"\]]+)/, (m) => `SPK|missing_column|${m[1]}`],
    [/has no attribute '(to_crs|estimate_utm_crs|geometry|within|union_all|dissolve|centroid|buffer|area|length|total_bounds|representative_point|to_json)'/, () => 'SPK|not_spatial|'],
    [/not supported between instances of/, () => 'SPK|type_mismatch|'],
    [/^FileNotFoundError: .*'([^']+)'/, (m) => `SPK|missing_file|${m[1]}`],
    [/(HTTPError|ConnectionError|NetworkError|URLError|Failed to fetch|status code \d+)/, () => 'SPK|fetch_failed|'],
    [/JSONDecodeError/, () => 'SPK|invalid_json|'],
    [/(DriverError|CPLE_\w+|not recognized as a supported file format|No such file or directory: 'zip:)/, () => `SPK|gis_read_failed|${last.replace(/^[\w.]+: /, '')}`],
    [/Layer '?([^']+)'? (not found|does not exist)|Null layer: '([^']+)'/, (m) => `SPK|missing_layer|${m[1] ?? m[3]}`],
    [/(ParserError|EmptyDataError)/, () => `SPK|parse_failed|${last.replace(/^\w+: /, '')}`],
  ]
  for (const [pattern, toCode] of rules) {
    const match = last.match(pattern)
    if (match) return toCode(match)
  }
  return line ? `${last} (line ${line})` : last
}

/** The request being worked on, so a crash of Python itself can still be answered. */
let currentRequest: number | null = null

/**
 * Pyodide can fail fatally (e.g. a crash inside GDAL). Its promises then never settle,
 * so report the crash ourselves; the app restarts Python for the next run.
 */
const reportCrash = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  if (currentRequest !== null) {
    scope.postMessage({ type: 'result', requestId: currentRequest, ok: false, error: `SPK|kernel_crashed|${message.split('\n')[0]}` })
    currentRequest = null
  }
  scope.postMessage({ type: 'status', status: 'failed', message })
}
self.addEventListener('error', (event) => reportCrash((event as ErrorEvent).error ?? (event as ErrorEvent).message))
self.addEventListener('unhandledrejection', (event) => reportCrash((event as PromiseRejectionEvent).reason))

scope.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      await getPyodide()
    } catch (error) {
      scope.postMessage({ type: 'status', status: 'failed', message: cleanError(error) })
    }
    return
  }

  const { requestId } = data
  currentRequest = requestId
  try {
    const pyodide = await getPyodide()
    let payload = '{}'

    if (data.type === 'reset') {
      namespace?.destroy()
      namespace = newNamespace(pyodide)
    } else {
      for (const [name, content] of Object.entries(data.files)) {
        // Binary uploads (zip, GeoPackage) arrive as "base64:…".
        const bytes = content.startsWith('base64:') ? Uint8Array.from(atob(content.slice(7)), (c) => c.charCodeAt(0)) : content
        pyodide.FS.writeFile(`${HOME}/${name.replace(/[/\\]/g, '_')}`, bytes)
      }
      // Pyodide's GDAL build crashes on GeoPackage and has no KML/GML/GPX driver: refuse early.
      const unsupported = data.code.match(/read_file\(\s*"[^"]*\.(gpkg|kml|kmz|gml|gpx)"/i)
      if (unsupported) throw new Error(`SPK|format_unsupported|.${unsupported[1].toLowerCase()}`)
      await ensurePackages(pyodide, data.code)
      const runtime = pyodide.pyimport('spockly_runtime') as PyProxy & {
        begin: () => void
        end: (ns: PyProxy, inspect: unknown) => string
      }
      runtime.begin()
      try {
        await pyodide.runPythonAsync(data.code, { globals: namespace as never, filename: 'journal.py' })
      } finally {
        payload = runtime.end(namespace!, pyodide.toPy(data.inspect))
        runtime.destroy()
      }
    }
    scope.postMessage({ type: 'result', requestId, ok: true, payload })
  } catch (error) {
    const message = cleanError(error)
    scope.postMessage({ type: 'result', requestId, ok: false, error: /fatal error|null function/i.test(message) ? `SPK|kernel_crashed|${message}` : message })
  } finally {
    currentRequest = null
  }
}
