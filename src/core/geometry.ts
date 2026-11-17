import type { Geometry } from './types'

/** What students see: a point, a line or an area. */
export type ShapeKind = 'point' | 'line' | 'area'

const KIND: Record<Geometry['type'], ShapeKind> = {
  Point: 'point',
  MultiPoint: 'point',
  LineString: 'line',
  MultiLineString: 'line',
  Polygon: 'area',
  MultiPolygon: 'area',
}

/** A GeoJSON geometry we can draw (GeometryCollection is not supported). */
export function isGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== 'object') return false
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown }
  return typeof type === 'string' && type in KIND && Array.isArray(coordinates)
}

export const shapeKind = (geometry: Geometry): ShapeKind => KIND[geometry.type]

/** Number of coordinate pairs; a rough measure of how detailed (and heavy) a shape is. */
export function vertexCount(geometry: Geometry): number {
  const count = (c: unknown): number =>
    Array.isArray(c) && typeof c[0] === 'number' ? 1 : Array.isArray(c) ? c.reduce((n: number, x) => n + count(x), 0) : 0
  return count(geometry.coordinates)
}

/** Ray casting: is the point inside the ring? (Points on the edge may go either way.) */
function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Is the point inside the area (outer ring, not in a hole)? False for points and lines. */
export function containsPoint(area: Geometry, lon: number, lat: number): boolean {
  const polygons = area.type === 'Polygon' ? [area.coordinates] : area.type === 'MultiPolygon' ? area.coordinates : []
  return polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((hole) => inRing(lon, lat, hole)))
}

/**
 * Does the rectangle [minLon, minLat, maxLon, maxLat] touch the area? True if
 * a corner or the centre lies inside the area, or a vertex of the area lies
 * in the rectangle. That misses only an edge that cuts a corner of the
 * rectangle without a vertex in it — rare with outlines whose vertices are a
 * few km apart and cells of 50 km.
 */
export function rectTouches(rect: [number, number, number, number], area: Geometry): boolean {
  const [minLon, minLat, maxLon, maxLat] = rect
  const probes = [
    [minLon, minLat], [minLon, maxLat], [maxLon, minLat], [maxLon, maxLat],
    [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
  ]
  if (probes.some(([lon, lat]) => containsPoint(area, lon, lat))) return true
  let hit = false
  const visit = (c: unknown): void => {
    if (hit || !Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      hit = c[0] >= minLon && c[0] <= maxLon && c[1] >= minLat && c[1] <= maxLat
      return
    }
    for (const x of c) visit(x)
  }
  visit(area.coordinates)
  return hit
}

/** The rectangle around all geometries, [minLon, minLat, maxLon, maxLat]. */
export function boundsOf(geometries: Geometry[]): [number, number, number, number] | undefined {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const visit = (c: unknown): void => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0])
      minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1])
      return
    }
    for (const x of c) visit(x)
  }
  for (const g of geometries) visit(g.coordinates)
  return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : undefined
}

/**
 * Reads a geometry from a source value: a GeoJSON geometry, or a Feature
 * wrapping one (Huwise sends geo_shape fields as Features). Anything else is
 * null.
 */
export function toGeometry(value: unknown): Geometry | null {
  if (isGeometry(value)) return value
  const feature = value as { type?: unknown; geometry?: unknown } | null
  if (feature && typeof feature === 'object' && feature.type === 'Feature' && isGeometry(feature.geometry)) {
    return feature.geometry
  }
  return null
}
