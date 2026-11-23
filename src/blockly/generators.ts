import type * as Blockly from 'blockly'
import { Order, pythonGenerator, type PythonGenerator } from 'blockly/python'

import { SAMPLES, sampleUrl } from '../journal/samples'
import { useKernelStore } from '../kernel/kernel'
import { CATEGORICAL, SEQUENTIAL } from '../components/outputs/palette'
import { getEditorContext } from './context'
import { csvOptions, formatOf, literal, str, toIdentifier } from './python'
import { PIPELINE, columnsForBlock, isNumericColumn } from './schema'

/**
 * Every block generates plain Python: pandas, GeoPandas, Altair and folium.
 * The only thing the app adds is display(), which works like in Jupyter.
 */

const f = (block: Blockly.Block, name: string) => String(block.getFieldValue(name) ?? '')
const num = (block: Blockly.Block, name: string) => Number(block.getFieldValue(name) ?? 0)
const col = (name: string) => `df[${str(name)}]`
const dataset = (block: Blockly.Block, name = 'DATASET') => toIdentifier(f(block, name))

const IMPORTS = {
  pd: 'import pandas as pd',
  gpd: 'import geopandas as gpd',
  np: 'import numpy as np',
  alt: 'import altair as alt',
  json: 'import json',
  requests: 'import requests',
  folium: 'import folium',
  branca: 'import branca',
  xyz: 'import xyzservices.providers as xyz',
  point: 'from shapely.geometry import Point',
  shapes: 'from shapely.geometry import Polygon, box',
} as const

/** Register an import; Blockly's Python generator puts all imports at the top of the code. */
const addImports = (generator: PythonGenerator, ...keys: (keyof typeof IMPORTS)[]) => {
  const definitions = (generator as unknown as { definitions_: Record<string, string> }).definitions_
  for (const key of keys) definitions[`import_${key}`] = IMPORTS[key]
}

/** Column kind (number, text, …) as last reported by Python, to write the right literal. */
const kindOf = (column: string) => {
  for (const fields of Object.values(useKernelStore.getState().schemas)) {
    const field = fields.find((candidate) => candidate.name === column)
    if (field) return field.kind
  }
  return undefined
}

const isNumeric = (column: string) => kindOf(column) === 'number'

pythonGenerator.addReservedWords(
  'df,pd,gpd,np,alt,json,requests,folium,branca,xyz,Point,Polygon,box,display,m,chart,joined,nearest,points,grid,cells,size,centre,centres,xmin,ymin,xmax,ymax,r',
)

type Generator = (block: Blockly.Block, generator: PythonGenerator) => string

// --- Loading data (data cells) ------------------------------------------------

const loadJson = (name: string, source: string, format: 'geojson' | 'json', fromFile: boolean, generator: PythonGenerator) => {
  addImports(generator, 'json', ...(fromFile ? [] : (['requests'] as const)))
  const read = fromFile ? `json.load(open(${str(source)}, encoding="utf-8"))` : `requests.get(${str(source)}).json()`
  if (format === 'geojson') {
    addImports(generator, 'gpd')
    return `${name}_json = ${read}\n${name} = gpd.GeoDataFrame.from_features(${name}_json, crs="EPSG:4326")\n`
  }
  addImports(generator, 'pd')
  return `${name}_json = ${read}\n${name} = pd.json_normalize(${name}_json)\n`
}

const toPoints = (name: string, lon: string, lat: string, generator: PythonGenerator) => {
  addImports(generator, 'gpd')
  return `${name} = gpd.GeoDataFrame(${name}, geometry=gpd.points_from_xy(${name}[${str(lon)}], ${name}[${str(lat)}]), crs="EPSG:4326")\n`
}

const loaders: Record<string, Generator> = {
  spk_load_example: (block, generator) => {
    const name = dataset(block, 'NAME')
    const sample = SAMPLES.find((s) => s.id === f(block, 'EXAMPLE')) ?? SAMPLES[0]
    if (sample.format === 'geojson') return loadJson(name, sampleUrl(sample), 'geojson', false, generator)
    addImports(generator, 'pd')
    const dates = sample.parseDates ? `, parse_dates=[${sample.parseDates.map(str).join(', ')}]` : ''
    let code = `${name} = pd.read_csv(${str(sampleUrl(sample))}${dates})\n`
    if (sample.lonLat) code += toPoints(name, sample.lonLat[0], sample.lonLat[1], generator)
    return code
  },
  spk_load_url: (block, generator) => {
    const name = dataset(block, 'NAME')
    const url = f(block, 'URL').trim()
    const format = formatOf(url)
    if (format !== 'csv') return loadJson(name, url, format, false, generator)
    addImports(generator, 'pd')
    return `${name} = pd.read_csv(${str(url)})\n`
  },
  spk_load_file: (block, generator) => {
    const name = dataset(block, 'NAME')
    const file = f(block, 'FILE')
    const content = getEditorContext().fileContent(file)
    const format = formatOf(file, content)
    if (format !== 'csv') return loadJson(name, file, format, true, generator)
    addImports(generator, 'pd')
    return `${name} = pd.read_csv(${str(file)}${csvOptions(content)})\n`
  },
  spk_make_spatial: (block, generator) => toPoints(dataset(block), f(block, 'LON'), f(block, 'LAT'), generator),
}

// --- Pipelines: df is the data flowing through the steps ------------------------

const OPERATORS: Record<string, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' }

const metric = 'df.to_crs(df.estimate_utm_crs())'

const steps: Record<string, Generator> = {
  [PIPELINE]: (block, generator) => {
    const first = block.getInputTargetBlock('STEPS')
    const body = first ? (generator.blockToCode(first) as string) : ''
    return `df = ${dataset(block)}.copy()\n${body}\n`
  },
  spk_save: (block) => `${dataset(block, 'NAME')} = df.copy()\n`,
  spk_join: (block) =>
    `df = df.merge(${dataset(block)}.drop(columns="geometry", errors="ignore"), on=${str(f(block, 'COLUMN'))}, how="left")\n`,
  spk_filter: (block) => {
    const column = f(block, 'COLUMN')
    const op = f(block, 'OP')
    if (op === 'missing') return `df = df[${col(column)}.isna()]\n`
    if (op === 'notmissing') return `df = df[${col(column)}.notna()]\n`
    if (op === 'contains') return `df = df[${col(column)}.astype(str).str.contains(${str(f(block, 'VALUE'))}, case=False, na=False)]\n`
    return `df = df[${col(column)} ${OPERATORS[op]} ${literal(f(block, 'VALUE'), kindOf(column))}]\n`
  },
  spk_sort: (block) => `df = df.sort_values(${str(f(block, 'COLUMN'))}, ascending=${f(block, 'DIR') === 'asc' ? 'True' : 'False'})\n`,
  spk_head: (block) => `df = df.head(${num(block, 'N')})\n`,
  spk_group: (block) => {
    const by = str(f(block, 'BY'))
    const agg = f(block, 'AGG')
    const column = f(block, 'COLUMN')
    const named = agg === 'count' ? `count=(${by}, "size")` : `${toIdentifier(`${agg}_${column}`)}=(${str(column)}, ${str(agg)})`
    return `df = df.groupby(${by}, as_index=False).agg(${named})\n`
  },
  spk_compute: (block, generator) => {
    const value = generator.valueToCode(block, 'VALUE', Order.NONE) || 'None'
    return `df[${str(f(block, 'NAME'))}] = ${value}\n`
  },
  spk_convert: (block, generator) => {
    addImports(generator, 'pd')
    const column = f(block, 'COLUMN')
    const to = f(block, 'TYPE')
    const expression =
      to === 'number' ? `pd.to_numeric(${col(column)}, errors="coerce")` : to === 'date' ? `pd.to_datetime(${col(column)}, errors="coerce")` : `${col(column)}.astype(str)`
    return `df[${str(column)}] = ${expression}\n`
  },
  spk_round: (block) => `df[${str(f(block, 'COLUMN'))}] = ${col(f(block, 'COLUMN'))}.round(${num(block, 'DIGITS')})\n`,
  spk_rename: (block) => `df = df.rename(columns={${str(f(block, 'COLUMN'))}: ${str(f(block, 'NAME'))}})\n`,
  spk_drop: (block) => `df = df.drop(columns=[${str(f(block, 'COLUMN'))}])\n`,
  spk_drop_missing: (block) => `df = df.dropna(subset=[${str(f(block, 'COLUMN'))}])\n`,

  // Spatial: GeoPandas. Measurements happen in a metric UTM projection estimated from the data.
  spk_points: (block, generator) => {
    addImports(generator, 'gpd')
    return `df = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(${col(f(block, 'LON'))}, ${col(f(block, 'LAT'))}), crs="EPSG:4326")\n`
  },
  spk_to_centroids: () => `df["geometry"] = ${metric}.centroid.to_crs(df.crs)\n`,
  spk_centroid: () => `centres = ${metric}.centroid.to_crs(df.crs)\ndf["centroid_lon"] = centres.x\ndf["centroid_lat"] = centres.y\n`,
  spk_near: (block, generator) => {
    addImports(generator, 'gpd', 'point')
    return (
      `centre = gpd.GeoSeries([Point(${num(block, 'LON')}, ${num(block, 'LAT')})], crs="EPSG:4326").to_crs(df.estimate_utm_crs())\n` +
      `df = df[df.to_crs(centre.crs).distance(centre.iloc[0]) <= ${num(block, 'KM')} * 1000]\n`
    )
  },
  spk_distance: (block, generator) => {
    addImports(generator, 'gpd', 'point')
    return (
      `centre = gpd.GeoSeries([Point(${num(block, 'LON')}, ${num(block, 'LAT')})], crs="EPSG:4326").to_crs(df.estimate_utm_crs())\n` +
      `df[${str(f(block, 'NAME'))}] = df.to_crs(centre.crs).distance(centre.iloc[0]) / 1000\n`
    )
  },
  spk_area: (block) => `df[${str(f(block, 'NAME'))}] = ${metric}.area / 1e6\n`,
  spk_length: (block) => `df[${str(f(block, 'NAME'))}] = ${metric}.length / 1000\n`,
  spk_nearest: (block, generator) => {
    addImports(generator, 'gpd')
    const name = str(f(block, 'NAME'))
    return (
      `nearest = gpd.sjoin_nearest(${metric}, ${dataset(block)}.to_crs(df.estimate_utm_crs())[["geometry"]], distance_col=${name})\n` +
      `df[${name}] = nearest.groupby(level=0)[${name}].min() / 1000\n`
    )
  },
  spk_inside: (block) => `df = df[${f(block, 'MODE') === 'outside' ? '~' : ''}df.within(${dataset(block)}.union_all())]\n`,
  spk_spatial_join: (block, generator) => {
    addImports(generator, 'gpd')
    return `df = gpd.sjoin(df, ${dataset(block)}, how="left", predicate="within").drop(columns="index_right")\n`
  },
  spk_count_within: (block, generator) => {
    addImports(generator, 'gpd')
    return (
      `joined = gpd.sjoin(${dataset(block)}[["geometry"]], df[["geometry"]], predicate="within")\n` +
      `df[${str(f(block, 'NAME'))}] = joined.groupby("index_right").size().reindex(df.index, fill_value=0)\n`
    )
  },
  spk_aggregate_within: (block, generator) => {
    addImports(generator, 'gpd')
    const agg = f(block, 'AGG')
    const column = f(block, 'COLUMN')
    const name = str(f(block, 'NAME') || `${agg}_${column}`)
    if (agg === 'count' || !column) {
      return (
        `joined = gpd.sjoin(${dataset(block)}[["geometry"]], df[["geometry"]], predicate="within")\n` +
        `df[${name}] = joined.groupby("index_right").size().reindex(df.index, fill_value=0)\n`
      )
    }
    return (
      `joined = gpd.sjoin(${dataset(block)}[[${str(column)}, "geometry"]], df[["geometry"]], predicate="within")\n` +
      `df[${name}] = joined.groupby("index_right")[${str(column)}].${agg}().reindex(df.index)\n`
    )
  },
  spk_buffer: (block) => `df["geometry"] = ${metric}.buffer(${num(block, 'METRES')}).to_crs(df.crs)\n`,
  spk_dissolve: (block) => (f(block, 'BY') ? `df = df.dissolve(by=${str(f(block, 'BY'))}, as_index=False)\n` : `df = df.dissolve()\n`),
  spk_convex_hull: (_block, generator) => {
    addImports(generator, 'gpd')
    return `df = gpd.GeoDataFrame(geometry=[df.union_all().convex_hull], crs=df.crs)\n`
  },
  spk_grid: (block, generator) => {
    addImports(generator, 'gpd', 'np', 'shapes')
    const hexagon = f(block, 'SHAPE') === 'hexagon'
    const cells = hexagon
      ? `r = size / np.sqrt(3)\n` +
        `cells = [\n` +
        `    Polygon([(x + r * np.cos(np.radians(a)), y + r * np.sin(np.radians(a))) for a in range(30, 390, 60)])\n` +
        `    for i, y in enumerate(np.arange(ymin, ymax + 1.5 * r, 1.5 * r))\n` +
        `    for x in np.arange(xmin - (i % 2) * size / 2, xmax + size, size)\n` +
        `]\n`
      : `cells = [box(x, y, x + size, y + size) for x in np.arange(xmin, xmax + size, size) for y in np.arange(ymin, ymax + size, size)]\n`
    return (
      `points = ${metric}\n` +
      `xmin, ymin, xmax, ymax = points.total_bounds\n` +
      `size = ${num(block, 'KM') * 1000}\n` +
      cells +
      `grid = gpd.GeoDataFrame(geometry=cells, crs=points.crs)\n` +
      `grid["count"] = gpd.sjoin(points[["geometry"]], grid, predicate="within").groupby("index_right").size().reindex(grid.index, fill_value=0)\n` +
      `df = grid[grid["count"] > 0].to_crs("EPSG:4326")\n`
    )
  },

  // Outputs
  spk_show_table: (block) => (f(block, 'TITLE') ? `display(df.style.set_caption(${str(f(block, 'TITLE'))}))\n` : `display(df)\n`),
  spk_show_summary: () => `display(df.describe())\n`,
  spk_show_stat: (block) => {
    const agg = f(block, 'AGG')
    const column = f(block, 'COLUMN')
    const label = f(block, 'LABEL') || `${agg} ${column}`.trim()
    const value = agg === 'count' ? 'len(df)' : agg === 'nunique' ? `${col(column)}.nunique()` : `round(${col(column)}.${agg}(), 2)`
    return `print(${str(`${label}:`)}, ${value})\n`
  },
  spk_show_chart: (block, generator) => {
    addImports(generator, 'alt', 'pd')
    const kind = f(block, 'KIND')
    const x = f(block, 'X')
    const y = f(block, 'Y')
    const color = f(block, 'COLOR')
    const title = f(block, 'TITLE')
    // Altair would draw a GeoDataFrame as shapes; for charts only the table matters.
    const data = columnsForBlock(block).includes('geometry') ? 'pd.DataFrame(df.drop(columns="geometry"))' : 'df'
    const mark = { bar: 'mark_bar()', line: 'mark_line(point=True)', scatter: 'mark_circle(size=60)', histogram: 'mark_bar()' }[kind] ?? 'mark_bar()'
    const encode = [
      kind === 'histogram' ? `x=alt.X(${str(x)}, bin=True)` : kind === 'bar' ? `x=alt.X(${str(x)}, sort=None, axis=alt.Axis(labelAngle=0))` : `x=${str(x)}`,
      kind === 'histogram' || !y ? 'y="count()"' : `y=${str(y)}`,
      ...(color ? [`color=${str(color)}`] : []),
    ]
    const properties = [...(title ? [`title=${str(title)}`] : []), 'width="container"']
    return `chart = alt.Chart(${data}).${mark}.encode(${encode.join(', ')}).properties(${properties.join(', ')})\ndisplay(chart)\n`
  },
  spk_map: (block, generator) => mapCode(block, generator),
  spk_show_map: (block, generator) =>
    mapCode(block, generator, [
      {
        source: 'df',
        name: currentName(block),
        style: 'auto',
        color: f(block, 'COLOR'),
        size: '',
        label: '',
        numeric: f(block, 'COLOR') ? isNumericColumn(block, f(block, 'COLOR')) : undefined,
      },
    ]),
  spk_map_layer: () => '',
}

// --- Maps: folium --------------------------------------------------------------

type Layer = { source: string; name: string; style: string; color: string; size: string; label: string; numeric?: boolean }

const BASEMAPS: Record<string, string> = {
  light: 'xyz.Esri.WorldGrayCanvas',
  osm: '"OpenStreetMap"',
  topo: 'xyz.OpenTopoMap',
  satellite: 'xyz.Esri.WorldImagery',
  dark: 'xyz.Esri.WorldGrayCanvas',
}

const currentName = (block: Blockly.Block) => {
  const root = block.getRootBlock()
  return root.type === PIPELINE ? dataset(root) : 'df'
}

const layersOf = (block: Blockly.Block): Layer[] => {
  const layers: Layer[] = []
  for (let layer = block.getInputTargetBlock('LAYERS'); layer; layer = layer.getNextBlock()) {
    if (layer.type !== 'spk_map_layer' || !layer.isEnabled()) continue
    const other = f(layer, 'DATASET')
    const color = f(layer, 'COLOR')
    layers.push({
      source: other ? toIdentifier(other) : 'df',
      name: other ? toIdentifier(other) : currentName(block),
      style: f(layer, 'STYLE'),
      color,
      size: f(layer, 'SIZE'),
      label: f(layer, 'LABEL'),
      numeric: color ? isNumericColumn(layer, color) : undefined,
    })
  }
  return layers.length ? layers : [{ source: 'df', name: currentName(block), style: 'auto', color: '', size: '', label: '' }]
}

const mapCode = (block: Blockly.Block, generator: PythonGenerator, layers = layersOf(block)) => {
  addImports(generator, 'folium', 'xyz')
  const title = f(block, 'TITLE')
  const used = new Map<string, number>()
  let code = `m = folium.Map(tiles=${BASEMAPS[f(block, 'BASEMAP')] ?? BASEMAPS.light})\n`
  if (title) code += `m.get_root().html.add_child(folium.Element(${str(`<h3 style="font-family:sans-serif;margin:6px 8px">${title.replace(/[<>&]/g, '')}</h3>`)}))\n`

  layers.forEach((layer, index) => {
    // Unique, readable prefix per layer, e.g. zones_style, stations_style
    const count = (used.get(layer.name) ?? 0) + 1
    used.set(layer.name, count)
    const prefix = toIdentifier(count > 1 ? `${layer.name}_${count}` : layer.name)
    const fallback = CATEGORICAL[index % CATEGORICAL.length]
    const asPoints = layer.style === 'points' || layer.style === 'bubbles'
    const data = asPoints ? `${layer.source}.assign(geometry=${layer.source}.representative_point())` : layer.source
    const numericColor = !!layer.color && (layer.numeric ?? isNumeric(layer.color))

    code += `\n# Layer: ${layer.name}\n`
    let fill = str(fallback)
    if (layer.color && numericColor) {
      addImports(generator, 'branca')
      code += `${prefix}_colors = branca.colormap.LinearColormap([${[SEQUENTIAL[0], SEQUENTIAL[2], SEQUENTIAL[4]].map(str).join(', ')}], vmin=${layer.source}[${str(layer.color)}].min(), vmax=${layer.source}[${str(layer.color)}].max(), caption=${str(layer.color)})\n`
      fill = `${prefix}_colors(value) if value is not None else "#cccccc"`
    } else if (layer.color) {
      code += `${prefix}_colors = dict(zip(${layer.source}[${str(layer.color)}].dropna().unique(), [${CATEGORICAL.map(str).join(', ')}]))\n`
      fill = `${prefix}_colors.get(value, "#9a9893")`
    }
    if (layer.size) code += `${prefix}_size_max = ${layer.source}[${str(layer.size)}].max()\n`

    const line = layer.style === 'lines'
    code += `\n\ndef ${prefix}_style(feature):\n`
    if (layer.color) code += `    value = feature["properties"][${str(layer.color)}]\n`
    code += `    return {\n`
    code += line ? `        "color": ${fill},\n        "weight": 3,\n` : `        "fillColor": ${fill},\n        "color": "white",\n        "weight": 1,\n        "fillOpacity": ${asPoints ? 0.6 : 0.7},\n`
    if (layer.size) code += `        "radius": 3 + 13 * ((feature["properties"][${str(layer.size)}] or 0) / ${prefix}_size_max) ** 0.5,\n`
    code += `    }\n\n\n`

    const tooltip = layer.label ? `,\n    tooltip=folium.GeoJsonTooltip(fields=[${str(layer.label)}])` : ''
    code += `folium.GeoJson(\n    ${data}.to_json(default=str),\n    name=${str(layer.name)},\n    marker=folium.CircleMarker(radius=6, fill=True),\n    style_function=${prefix}_style${tooltip},\n).add_to(m)\n`
    if (numericColor) code += `${prefix}_colors.add_to(m)\n`
  })

  if (layers.length > 1) code += `folium.LayerControl().add_to(m)\n`
  code += `m.fit_bounds(m.get_bounds())\ndisplay(m)\n`
  return code
}

for (const [type, generator] of Object.entries({ ...loaders, ...steps })) {
  pythonGenerator.forBlock[type] = generator as (typeof pythonGenerator.forBlock)[string]
}

pythonGenerator.forBlock.spk_column = (block) => [col(f(block, 'COLUMN')), Order.MEMBER]

export { pythonGenerator }
