import { getJson, LoadError } from '../../core/http'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { fileUrl, toDataTable, type NeFeatureCollection } from './mapping'
import { NE_DATASETS, neDataset } from './presets'

export interface LoadNaturalEarthParams {
  dataset: string
}

export const DEFAULT_NE_DATASET = NE_DATASETS[0].id

export async function loadNaturalEarth({ dataset }: LoadNaturalEarthParams, { signal }: ExecContext = {}): Promise<DataTable> {
  const preset = neDataset(dataset)
  if (!preset) throw new LoadError('load.failed', `unknown Natural Earth dataset ${dataset}`)
  const collections = await Promise.all(preset.files.map((file) => getJson<NeFeatureCollection>(fileUrl(file), signal)))
  if (collections.some((c) => !Array.isArray(c?.features))) throw new LoadError('load.failed', 'no features')
  return toDataTable(preset, collections)
}

export const loadNaturalEarthOperation: OperationDef<LoadNaturalEarthParams> = {
  op: 'load_natural_earth',
  kind: 'load',
  // The columns are fixed per dataset, but kept with the data for now like the other loaders.
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadNaturalEarth(params, ctx),
  // Runs in Pyodide: one GeoJSON file; the shapes stay as dicts in a "geometry" column.
  toCode: ({ dataset }, { output = 'df' } = {}) => {
    const preset = neDataset(dataset) ?? NE_DATASETS[0]
    const fields = JSON.stringify(Object.fromEntries(preset.columns.map((c) => [c.name, c.from])))
    return {
      python:
        `import json\n` +
        `import pandas as pd\n` +
        `from pyodide.http import open_url\n\n` +
        `dateien = ${JSON.stringify(preset.files.map(fileUrl))}\n` +
        `# Spalte → Eigenschaften in der Datei (die erste vorhandene zählt; -99 heißt unbekannt)\n` +
        `felder = ${fields}\n` +
        `zeilen = []\n` +
        `objekte = [objekt for url in dateien for objekt in json.load(open_url(url))["features"]]\n` +
        `for objekt in objekte:\n` +
        `    p = objekt["properties"]\n` +
        `    zeile = {spalte: next((p[k] for k in keys if p.get(k) not in (None, "", -99, "-99")), None) for spalte, keys in felder.items()}\n` +
        `    zeile["geometry"] = objekt["geometry"]\n` +
        `    zeilen.append(zeile)\n\n` +
        `${output} = pd.DataFrame(zeilen)\n` +
        `print(${output})`,
    }
  },
}
