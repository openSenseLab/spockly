import { getText, LoadError } from '../../core/http'
import { pythonReader } from '../../core/tabular'
import type { DataTable, ExecContext, OperationDef } from '../../core/types'
import { checkUrl, toUrlTable, type LoadUrlParams } from './mapping'
import { MAX_URL_BYTES } from './presets'

/** The general HTTP errors, said for a web address rather than a data portal. */
const URL_ERRORS: Record<string, string> = {
  'load.unreachable': 'load.url.unreachable',
  'load.notFound': 'load.url.notFound',
  'load.notPublic': 'load.url.notPublic',
}

/** Downloads the address's text (CSV, JSON or GeoJSON). */
export async function fetchUrlText(url: string, signal?: AbortSignal) {
  const problem = checkUrl(url)
  if (problem) throw new LoadError(problem)
  try {
    return await getText(url, signal, MAX_URL_BYTES)
  } catch (error) {
    if (error instanceof LoadError && URL_ERRORS[error.code]) throw new LoadError(URL_ERRORS[error.code], error.message)
    throw error
  }
}

export async function loadUrl(params: LoadUrlParams, { signal }: ExecContext = {}): Promise<DataTable> {
  const { text, contentType } = await fetchUrlText(params.url, signal)
  return toUrlTable(params, text, contentType)
}

export const loadUrlOperation: OperationDef<LoadUrlParams> = {
  op: 'load_url',
  kind: 'load',
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params, ctx) => loadUrl(params, ctx),
  // Runs in Pyodide: the text comes through the browser (open_url), then pandas reads it like the app does.
  toCode: (params, { output = 'df' } = {}) => ({
    python:
      `import io\n` +
      `import json\n` +
      `import pandas as pd\n` +
      `from pyodide.http import open_url\n\n` +
      `adresse = ${JSON.stringify(params.url)}\n` +
      `text = open_url(adresse).read()\n` +
      `${pythonReader(params.read ?? { format: 'csv', delimiter: ',' }, { text: 'text' }, output)}\n` +
      `print(${output})`,
  }),
}
