import { beforeEach, describe, expect, it } from 'vitest'

import { normalizeFileParams } from './mapping'
import { loadFile, loadFileOperation } from './operation'
import { addFile, clearFiles, getFile, pythonFiles } from './store'

// A hand-made spreadsheet export, as a class might write it.
const CSV = 'Datum;Ort;Temperatur;Breite;Länge\n01.10.2026;Schulhof;12,5;51,96;7,62\n02.10.2026;Schulhof;11,0;51,96;7,62\n'

beforeEach(() => clearFiles())

describe('file store', () => {
  it('keeps a picked file under an id, with a name Python can open', () => {
    const { id, file } = addFile('Messung Klasse 9b.csv', CSV)
    expect(file).toBe('Messung_Klasse_9b.csv')
    expect(getFile(id)?.text).toBe(CSV)
    expect(pythonFiles()).toEqual({ 'Messung_Klasse_9b.csv': CSV })
  })

  it('gives the same file the same id again, and a different file of the same name its own Python name', () => {
    const first = addFile('daten.csv', CSV)
    expect(addFile('daten.csv', CSV)).toEqual(first)
    expect(addFile('daten.csv', 'a;b\n1;2\n').file).toBe('daten_2.csv')
  })
})

describe('loadFile', () => {
  it('reads the picked file with the settings from the setup window', async () => {
    const { id, file } = addFile('messung.csv', CSV)
    const table = await loadFile({ fileId: id, name: 'messung.csv', file, read: { format: 'csv', delimiter: ';' } })
    expect(table.rows[0]).toEqual({ Datum: '2026-10-01', Ort: 'Schulhof', Temperatur: 12.5, Breite: 51.96, Länge: 7.62 })
    expect(table.columns.map((c) => c.semanticType)).toEqual(['timestamp', 'category', 'measurement', 'latitude', 'longitude'])
    expect(table.meta.title.de).toBe('messung.csv')
    expect(table.meta.description?.de).toContain('wird nirgendwohin hochgeladen')
  })

  it('asks for the file again when it is gone (a saved block after closing the tab)', async () => {
    await expect(loadFile({ fileId: 'old-id', name: 'messung.csv', file: 'messung.csv' })).rejects.toMatchObject({ code: 'load.file.missing' })
    await expect(loadFile(normalizeFileParams(null))).rejects.toMatchObject({ code: 'load.file.none' })
  })

  it('reads GeoJSON files too', async () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: 'Schulgarten' }, geometry: { type: 'Point', coordinates: [7.62, 51.96] } }],
    })
    const { id, file } = addFile('orte.geojson', geojson)
    const table = await loadFile({ fileId: id, name: 'orte.geojson', file })
    expect(table.rows[0]).toEqual({ name: 'Schulgarten', geometry: { type: 'Point', coordinates: [7.62, 51.96] } })
  })
})

describe('Python', () => {
  it('opens the file by its Python name, read like the app reads it', () => {
    const code = loadFileOperation.toCode!({ fileId: 'x', name: 'Messung 9b.csv', file: 'Messung_9b.csv', read: { format: 'csv', delimiter: ';' } }, { output: 'messung' }).python
    expect(code).toContain('messung = pd.read_csv("Messung_9b.csv", sep=";", decimal=",")')
  })
})
