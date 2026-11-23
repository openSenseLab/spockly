import type { Basemap, CellOutput, ColumnKind, MapLayer } from '../../journal/types'
import { CATEGORICAL, OTHER, SEQUENTIAL, formatNumber } from './palette'

export type LegendItem = { color: string; label: string }

export const BASEMAPS: Record<Basemap, { url: string; attribution: string; maxZoom: number }> = {
  // Esri's grey canvases need no API key (CARTO's basemaps now do).
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, GIS User Community',
    maxZoom: 19,
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
}

/** Colour per feature and legend: quantile classes for numbers, fixed slots for categories. */
export const colorScale = (layer: MapLayer, fallback: string, language: string) => {
  const { colorBy, colorKind } = layer
  if (!colorBy) return { colorOf: () => fallback, legend: [] as LegendItem[] }
  const values = layer.geojson.features.map((f) => f.properties?.[colorBy])

  if (colorKind === 'number') {
    const numbers = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b)
    if (!numbers.length) return { colorOf: () => OTHER, legend: [] }
    const wanted = Math.min(SEQUENTIAL.length, new Set(numbers).size)
    // Quantile breaks; with few distinct values several can coincide, so keep each once.
    const breaks = [
      ...new Set(Array.from({ length: wanted - 1 }, (_, i) => numbers[Math.floor(((i + 1) * numbers.length) / wanted)])),
    ].filter((b) => b > numbers[0])
    const classes = breaks.length + 1
    const offset = SEQUENTIAL.length - classes
    const colorOf = (value: unknown) => {
      if (typeof value !== 'number') return OTHER
      const index = breaks.findIndex((b) => value < b)
      return SEQUENTIAL[(index === -1 ? classes - 1 : index) + offset]
    }
    const bounds = [numbers[0], ...breaks, numbers.at(-1)!]
    const legend = Array.from({ length: classes }, (_, i) => ({
      color: SEQUENTIAL[i + offset],
      label: `${formatNumber(bounds[i], language)} – ${formatNumber(bounds[i + 1], language)}`,
    }))
    return { colorOf, legend }
  }

  const counts = new Map<string, number>()
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value)
  const shown = ranked.length > CATEGORICAL.length ? ranked.slice(0, CATEGORICAL.length - 1) : ranked
  const lookup = new Map(shown.map((value, i) => [value, CATEGORICAL[i]]))
  const legend = shown.map((value) => ({ color: lookup.get(value)!, label: value }))
  if (ranked.length > shown.length) legend.push({ color: OTHER, label: '…' })
  return { colorOf: (value: unknown) => lookup.get(String(value)) ?? OTHER, legend }
}

/** Radius in pixels for proportional symbols (area grows with the value). */
export const sizeScale = (layer: MapLayer) => {
  const { sizeBy } = layer
  if (!sizeBy) return null
  const numbers = layer.geojson.features
    .map((f) => f.properties?.[sizeBy])
    .filter((v): v is number => typeof v === 'number' && v >= 0)
  if (!numbers.length) return null
  const max = Math.max(...numbers)
  const min = Math.min(...numbers)
  const radius = (value: unknown) => (typeof value === 'number' && max > 0 ? 3 + 13 * Math.sqrt(Math.max(0, value) / max) : 3)
  return { radius, min, max }
}

/** A plain dataset as a single layer (inspection map tab). */
export const singleLayer = (geojson: GeoJSON.FeatureCollection, extra: Partial<MapLayer> = {}): MapLayer => ({
  name: '',
  style: 'auto',
  geojson,
  colorBy: null,
  colorKind: null as ColumnKind | null,
  sizeBy: null,
  label: null,
  totalFeatures: geojson.features.length,
  ...extra,
})

type LegacyMap = { type: 'map'; title: string; colorBy: string | null; colorKind: ColumnKind | null; geojson: GeoJSON.FeatureCollection; totalFeatures: number }

/** Journals saved before layered maps stored a single layer inline. */
export const mapLayersOf = (output: Extract<CellOutput, { type: 'map' }> | LegacyMap): { basemap: Basemap; layers: MapLayer[] } =>
  'layers' in output
    ? { basemap: output.basemap ?? 'light', layers: output.layers }
    : {
        basemap: 'osm',
        layers: [singleLayer(output.geojson, { colorBy: output.colorBy, colorKind: output.colorKind, totalFeatures: output.totalFeatures })],
      }
