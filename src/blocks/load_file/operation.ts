import { LoadError } from '../../core/http'
import { pythonReader } from '../../core/tabular'
import type { DataTable, OperationDef } from '../../core/types'
import { toFileTable, type LoadFileParams } from './mapping'
import { getFile } from './store'

export async function loadFile(params: LoadFileParams): Promise<DataTable> {
  if (!params.fileId) throw new LoadError('load.file.none')
  const stored = getFile(params.fileId)
  // Saved blocks keep only the file's name: after closing the tab, the file must be picked again.
  if (!stored) throw new LoadError('load.file.missing', params.name)
  return toFileTable(params, stored)
}

export const loadFileOperation: OperationDef<LoadFileParams> = {
  op: 'load_file',
  kind: 'load',
  inferSchema: () => ({ columns: [], warnings: [] }),
  execute: (_input, params) => loadFile(params),
  // Before a run, the app writes the picked files into Pyodide's file system under their Python names.
  toCode: (params, { output = 'df' } = {}) => ({
    python: params.file
      ? `import json\n` +
        `import pandas as pd\n\n` +
        `# Die Datei bleibt im Browser; zum Ausführen legt SPOCKLY sie für Python bereit.\n` +
        `${pythonReader(params.read ?? { format: 'csv', delimiter: ',' }, { file: params.file }, output)}\n` +
        `print(${output})`
      : `# Noch keine Datei gewählt.`,
  }),
}
