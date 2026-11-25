/** Helpers for writing readable, valid Python from block fields. */

const KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '),
)

/** Dataset names are Python variables: letters, digits and underscores, not starting with a digit. */
export const toIdentifier = (name: string) => {
  let id = String(name ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\W+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!id) id = 'data'
  if (/^\d/.test(id)) id = `data_${id}`
  return KEYWORDS.has(id) ? `${id}_` : id
}

/** JSON string literals are valid Python string literals. */
export const str = (value: unknown) => JSON.stringify(String(value ?? ''))

/** Turn a typed-in filter value into a Python literal, guided by the column's kind. */
export const literal = (value: string, kind?: string) => {
  const text = String(value ?? '').trim()
  const number = text.replace(',', '.')
  if (kind !== 'text' && kind !== 'category' && kind !== 'date' && /^-?\d+(\.\d+)?$/.test(number)) return number
  if (kind === 'boolean' || /^(true|false|wahr|falsch)$/i.test(text)) {
    if (/^(true|wahr|ja|yes|1)$/i.test(text)) return 'True'
    if (/^(false|falsch|nein|no|0)$/i.test(text)) return 'False'
  }
  return str(text)
}

export type DataFormat = 'csv' | 'geojson' | 'json' | 'gis'

/**
 * Formats read with gpd.read_file (GDAL). In the browser, zipped Shapefiles and FlatGeobuf work;
 * GeoPackage, KML, GML and GPX are recognised so the worker can explain that they are not supported yet.
 */
export const GIS_EXTENSIONS = ['.zip', '.gpkg', '.kml', '.gml', '.fgb', '.gpx']

export const isGisFile = (source: string) => {
  const path = source.toLowerCase().split('?')[0]
  return GIS_EXTENSIONS.some((extension) => path.endsWith(extension))
}

/** Local file name for a downloaded GIS file (the runtime uses the same rule to list its layers). */
export const downloadName = (url: string) => {
  const name = url.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() ?? ''
  return name.replace(/[^\w.-]+/g, '_') || 'download.zip'
}

/** What gpd.read_file opens: zip archives through GDAL's zip:// prefix. */
export const gisPath = (fileName: string) => (fileName.toLowerCase().endsWith('.zip') ? `zip://${fileName}` : fileName)

/** Guess the format of a URL or file name (APIs without an extension usually return JSON). */
export const formatOf = (source: string, content?: string): DataFormat => {
  const lower = source.toLowerCase()
  if (isGisFile(lower)) return 'gis'
  if (/\.geojson(\?|$)|format=geojson/.test(lower)) return 'geojson'
  if (/\.(csv|tsv|txt)(\?|$)|format=csv/.test(lower)) return 'csv'
  if (/\.json(\?|$)/.test(lower)) return content && /"FeatureCollection"/.test(content.slice(0, 2000)) ? 'geojson' : 'json'
  if (content !== undefined) {
    const start = content.trimStart()[0]
    if (start === '{' || start === '[') return /"FeatureCollection"/.test(content.slice(0, 2000)) ? 'geojson' : 'json'
    return 'csv'
  }
  return 'json'
}

/** read_csv arguments for a known file: separator and decimal comma (German CSV). */
export const csvOptions = (content?: string) => {
  if (!content) return ''
  const firstLine = content.replace(/^﻿/, '').split('\n', 1)[0]
  const counts = { ',': firstLine.split(',').length, ';': firstLine.split(';').length, '\t': firstLine.split('\t').length }
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as ',' | ';' | '\t'
  if (sep === ';') return ', sep=";", decimal=","'
  if (sep === '\t') return ', sep="\\t"'
  return ''
}
