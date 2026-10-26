import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Flex, Select, Slider, Text } from '@radix-ui/themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { classLimits, classOf, mapPointsOf, mapShapesOf, type MapPoint, type PlaceStat } from '../core/geo'
import { boundsOf, shapeKind, type ShapeKind } from '../core/geometry'
import type { ColumnMeta, DataTable, DatasetMeta, Geometry } from '../core/types'
import { glossaryForColumn } from '../glossary'
import { formatDate, formatNumber, lang, pick, t } from '../i18n'
import { GlossaryInfo } from './GlossaryInfo'

/**
 * Blue ramp, light → dark = low → high (one hue, so it reads as "more").
 * Checked with the dataviz palette validator (ordinal, light surface).
 * Canvas markers and the SVG icons can't use CSS variables, hence plain hex.
 */
const CLASS_COLORS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
/** All places have the same value, or no measurement is shown: the middle of the ramp. */
const SINGLE_COLOR = '#2a78d6'
/** A place without a value for the chosen measurement. */
const NO_VALUE_COLOR = '#b9bbc6'
/** Drawing on the icons: dark on the light fills, white on the dark ones. */
const INK_DARK = '#0d366b'
const INK_LIGHT = '#ffffff'
const AREA_COLOR = '#8b8d98'
/** Lines that show no value (e.g. rivers): darker than the ramp's middle, so they read as lines. */
const LINE_COLOR = '#1c5cab'
/** The outline of the area the data is about, drawn above the data. */
const OUTLINE_COLOR = '#1c2024'
/** A time slider only makes sense for a handful of steps (e.g. 12 months). */
const MAX_TIME_STEPS = 60
/** Pause between two months when playing. */
const PLAY_STEP_MS = 1100
/** Zoom for a single point: shows the town and its surroundings. */
const SINGLE_POINT_ZOOM = 9

const STATS: PlaceStat[] = ['mean', 'max', 'min', 'latest']

type PlaceKind = NonNullable<DatasetMeta['placeKind']>

/** Anything drawn on the map: a place (point or grid cell) or a shape, with its values. */
type MapItem = { label?: string; rows: number; values: MapPoint['values']; geometry?: Geometry; lat?: number; lon?: number }

/** Points from latitude/longitude, shapes from a geometry column, or the cells of a grid. */
type MapMode = 'points' | 'shapes' | 'grid'

/** How the legend draws a colour: like the marks on the map. */
type Swatch = 'circle' | 'square' | 'line'

/** One decimal is enough on a map; the tooltip keeps the full value. */
/**
 * Short numbers for legend and labels: one decimal for small values, three
 * significant digits for large ones (13 925 228 → 13 900 000). The tooltip
 * keeps the full value.
 */
function short(value: number): string {
  const abs = Math.abs(value)
  if (abs < 1000) return formatNumber(Math.round(value * 10) / 10)
  const factor = 10 ** (Math.floor(Math.log10(abs)) - 2)
  return formatNumber(Math.round(value / factor) * factor)
}

/** Grid sizes like 0.625° need three decimals. */
const degrees = new Intl.NumberFormat(lang, { maximumFractionDigits: 3 })

const withUnit = (value: number, column?: ColumnMeta) =>
  column?.unit ? `${formatNumber(value)} ${column.unit}` : formatNumber(value)

const nameOf = (column: ColumnMeta) => pick(column.label) ?? column.name

const rowsText = (rows: number) => (rows === 1 ? t('map.rowOne') : t('map.rows', { count: formatNumber(rows) }))

// ---- Icons ----

/** A senseBox: a small box with a sensor and an antenna. */
const boxSvg = (fill: string, ink: string) => `
<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
  <path d="M20 7V2.5" stroke="${INK_LIGHT}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M20 7V2.5" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="3" y="7" width="22" height="18" rx="4" fill="${fill}" stroke="${INK_LIGHT}" stroke-width="2"/>
  <path d="M4 12.5h20" stroke="${ink}" stroke-width="1.2" opacity="0.6"/>
  <circle cx="9.5" cy="18.5" r="2.4" fill="${ink}"/>
  <path d="M15 17h5.5M15 20.5h3.5" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
</svg>`

/** A satellite: body with two solar panels, on a round badge. */
const satelliteSvg = (fill: string, ink: string) => `
<svg viewBox="0 0 30 30" width="34" height="34" aria-hidden="true">
  <circle cx="15" cy="15" r="13" fill="${fill}" stroke="${INK_LIGHT}" stroke-width="2"/>
  <g transform="translate(15 15) rotate(-35) scale(0.8) translate(-15 -15)" fill="none" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round">
    <rect x="12.5" y="11.5" width="5" height="7" rx="1" fill="${ink}"/>
    <rect x="4.5" y="12.5" width="6" height="5"/>
    <path d="M7.5 12.5v5"/>
    <rect x="19.5" y="12.5" width="6" height="5"/>
    <path d="M22.5 12.5v5"/>
    <path d="M10.5 15h2M17.5 15h2M15 18.5v2.5M13 22h4"/>
  </g>
</svg>`

const iconCache = new Map<string, L.DivIcon>()

function iconFor(kind: PlaceKind, fill: string): L.DivIcon {
  const key = `${kind}|${fill}`
  let icon = iconCache.get(key)
  if (!icon) {
    const ink = fill === CLASS_COLORS[0] || fill === CLASS_COLORS[1] || fill === NO_VALUE_COLOR ? INK_DARK : INK_LIGHT
    const size = kind === 'sensor-station' ? 28 : 34
    icon = L.divIcon({
      className: 'map-icon',
      // Only our own constants go into this markup.
      html: kind === 'sensor-station' ? boxSvg(fill, ink) : satelliteSvg(fill, ink),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      tooltipAnchor: [size / 2, 0],
    })
    iconCache.set(key, icon)
  }
  return icon
}

// ---- Tooltip ----

/**
 * Tooltip as DOM nodes with plain text: station names are typed in by users,
 * not HTML. Lists every measurement shown on the map; the one the colour
 * stands for comes first and in bold.
 */
function tooltipFor(
  point: MapItem,
  measures: ColumnMeta[],
  colourBy: ColumnMeta | undefined,
  stat: PlaceStat,
  kind: PlaceKind | undefined,
  options: { heading?: string; extra?: string[] } = {},
): HTMLElement {
  const box = document.createElement('div')
  box.className = 'map-tooltip'
  const line = (text: string, className?: string) => {
    const element = document.createElement('div')
    element.textContent = text
    if (className) element.className = className
    box.append(element)
  }
  if (point.label) line(point.label, 'map-tooltip-title')
  if (kind) line(t(kind === 'sensor-station' ? 'map.kind.station' : 'map.kind.gridCell'), 'map-tooltip-kind')
  for (const text of options.extra ?? []) line(text, 'map-tooltip-kind')
  if (measures.length === 0) {
    line(rowsText(point.rows))
    return box
  }

  line(options.heading ?? `${t(`map.stat.${stat}`)}:`, 'map-tooltip-heading')
  const ordered = colourBy ? [colourBy, ...measures.filter((m) => m !== colourBy)] : measures
  for (const measure of ordered) {
    const value = point.values[measure.name]?.[stat]
    const text = `${nameOf(measure)}: ${value === undefined ? t('map.noValue') : withUnit(value, measure)}`
    line(text, measure === colourBy ? 'map-tooltip-chosen' : undefined)
  }

  const chosen = colourBy ? point.values[colourBy.name] : undefined
  if (chosen && colourBy) {
    if (stat === 'latest' && chosen.latestAt) line(t('map.measuredAt', { time: formatDate(chosen.latestAt) }), 'map-tooltip-note')
    if (chosen.count > 1) {
      line(
        t('map.rangeOf', { name: nameOf(colourBy), min: formatNumber(chosen.min), max: withUnit(chosen.max, colourBy) }),
        'map-tooltip-note',
      )
      line(t('map.valueCount', { count: formatNumber(chosen.count) }), 'map-tooltip-note')
    }
  }
  return box
}

// ---- Legend ----

/** "unter 11,2", "11,2 bis 12,4", …, "ab 14,8" */
function legendLabels(limits: number[]): string[] {
  return CLASS_COLORS.map((_, i) => {
    if (i === 0) return t('map.below', { value: short(limits[0]) })
    if (i === limits.length) return t('map.from', { value: short(limits[i - 1]) })
    return t('map.between', { from: short(limits[i - 1]), to: short(limits[i]) })
  })
}

function Legend({
  measure,
  stat,
  limits,
  single,
  missing,
  swatch,
  withStat,
  at,
}: {
  measure: ColumnMeta
  stat: PlaceStat
  limits: number[]
  single?: string
  missing: boolean
  swatch: Swatch
  /** Only when a place has several values, the statistic chosen matters. */
  withStat: boolean
  /** The month shown, if the map shows one month. */
  at?: string
}) {
  const title =
    (at
      ? t('map.legendAt', { name: nameOf(measure), time: at })
      : withStat
        ? t('map.legendTitle', { name: nameOf(measure), stat: t(`map.stat.${stat}`) })
        : nameOf(measure)) +
    (measure.unit ? ` (${measure.unit})` : '')
  const entries: [color: string, label: string][] = single
    ? [[SINGLE_COLOR, single]]
    : legendLabels(limits).map((label, i) => [CLASS_COLORS[i], label])
  if (missing) entries.push([NO_VALUE_COLOR, t('map.noValue')])
  return (
    <div className="map-legend" role="group" aria-label={title}>
      <Text as="div" size="1" weight="medium">
        {title} <GlossaryInfo entry={glossaryForColumn(measure)} />
      </Text>
      <Flex gap="3" wrap="wrap" mt="1">
        {entries.map(([color, label]) => (
          <Flex key={label} align="center" gap="1">
            <span
              className={`map-legend-swatch ${swatch}`}
              style={{ background: color }}
            />
            <Text size="1" color="gray">
              {label}
            </Text>
          </Flex>
        ))}
      </Flex>
    </div>
  )
}

// ---- Map ----

const SHAPE_COUNT: Record<ShapeKind, [many: string, one: string]> = {
  point: ['shape.points', 'shape.pointOne'],
  line: ['shape.lines', 'shape.lineOne'],
  area: ['shape.areas', 'shape.areaOne'],
}

/** "177 Flächen", "1 325 Linien · 3 Punkte" */
function shapeCounts(items: MapItem[]): string {
  const counts = new Map<ShapeKind, number>()
  for (const item of items) {
    if (item.geometry) counts.set(shapeKind(item.geometry), (counts.get(shapeKind(item.geometry)) ?? 0) + 1)
  }
  return [...counts]
    .map(([kind, n]) => (n === 1 ? t(SHAPE_COUNT[kind][1]) : t(SHAPE_COUNT[kind][0], { count: formatNumber(n) })))
    .join(' · ')
}

/**
 * Where the data is and what was measured there, in one of three ways:
 * - points (latitude/longitude): one marker per place — a box for a senseBox
 *   station, a satellite for a grid point, a dot otherwise;
 * - shapes (a geometry column): the rows' own points, lines and areas;
 * - grid (raster data): every cell as a coloured tile.
 * Marks are coloured by the measurement the student picks, summed up per
 * place (mean, highest, lowest or newest value). The tooltip lists all
 * measurements. Columns hidden for a guess are left out entirely.
 */
export function MapPreview({ table, hidden }: { table: DataTable; hidden: ReadonlySet<string> }) {
  const element = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [stat, setStat] = useState<PlaceStat>('mean')
  const [numbers, setNumbers] = useState(false)
  /** Grid data: one month on the map, or null for the whole period summed up per cell. */
  const [month, setMonth] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const monthRef = useRef<string | null>(null)

  const grid = table.meta.grid
  const mode: MapMode = table.columns.some((c) => c.semanticType === 'geometry') ? 'shapes' : grid ? 'grid' : 'points'
  // Grid cells are drawn as tiles, so the point icons are only for stations and grid points.
  const kind = mode === 'points' ? table.meta.placeKind : undefined
  const measures = useMemo(() => table.columns.filter((c) => c.semanticType === 'measurement'), [table])
  const allowed = useMemo(() => measures.filter((c) => !hidden.has(c.name)), [measures, hidden])
  const measure = useMemo(() => allowed.find((c) => c.name === chosen) ?? allowed[0], [allowed, chosen])
  const { outline, landmarks, initialView } = table.meta

  // Grids over time (e.g. 12 months): a slider shows one month at a time.
  const timeColumn = table.columns.find((c) => c.semanticType === 'timestamp')?.name
  const months = useMemo(() => {
    if (mode !== 'grid' || !timeColumn) return []
    const all = [...new Set(table.rows.map((r) => String(r[timeColumn])))].sort()
    return all.length > 1 && all.length <= MAX_TIME_STEPS ? all : []
  }, [table, mode, timeColumn])
  const shownMonth = month !== null && months.includes(month) ? month : null
  const shown = useMemo(
    () => (shownMonth && timeColumn ? { ...table, rows: table.rows.filter((r) => r[timeColumn] === shownMonth) } : table),
    [table, shownMonth, timeColumn],
  )

  // Everything to draw, with the values of every shown measurement.
  const found = useMemo(() => {
    const names = allowed.map((c) => c.name)
    if (mode === 'shapes') {
      const result = mapShapesOf(shown, names)
      return result && { items: result.shapes as MapItem[], withoutPlace: result.withoutShape, leftOut: 0 }
    }
    const result = mapPointsOf(shown, names)
    return result && { items: result.points as MapItem[], withoutPlace: result.withoutPlace, leftOut: result.leftOut }
  }, [shown, allowed, mode])
  const items = useMemo(() => found?.items ?? [], [found])

  const values = useMemo(
    () =>
      measure
        ? items.flatMap((p) => {
            const v = p.values[measure.name]?.[stat]
            return v === undefined ? [] : [v]
          })
        : [],
    [items, measure, stat],
  )
  const periodLimits = useMemo(() => classLimits(values), [values])
  // One scale for all months, so that the colours show the seasons, not each month's own spread.
  const monthLimits = useMemo(
    () =>
      measure && months.length
        ? classLimits(table.rows.map((r) => r[measure.name]).filter((v): v is number => typeof v === 'number'))
        : [],
    [table, measure, months],
  )
  const limits = shownMonth ? monthLimits : periodLimits
  const severalPerPlace = !!measure && items.some((p) => (p.values[measure.name]?.count ?? 0) > 1)
  const extent = table.meta.spatialExtent
  // The dashed "area asked for" only helps around points; shapes and grids show their own extent.
  const isArea = mode === 'points' && !!extent && (extent[0] !== extent[2] || extent[1] !== extent[3])

  /**
   * What the view has to show: [minLon, minLat, maxLon, maxLat]. From the
   * whole table, so that changing the month or a hidden column doesn't move
   * (or rebuild) the map.
   */
  const view = useMemo((): [number, number, number, number] | undefined => {
    if (mode === 'shapes') return boundsOf((mapShapesOf(table)?.shapes ?? []).map((s) => s.geometry))
    const points = mapPointsOf(table)?.points ?? []
    if (points.length === 0) return undefined
    const lons = points.map((i) => i.lon)
    const lats = points.map((i) => i.lat)
    const [halfLon, halfLat] = grid ? [grid.cellSize[0] / 2, grid.cellSize[1] / 2] : [0, 0]
    return [Math.min(...lons) - halfLon, Math.min(...lats) - halfLat, Math.max(...lons) + halfLon, Math.max(...lats) + halfLat]
  }, [table, mode, grid])

  // Playing: one month after the other, stopping at the last one.
  useEffect(() => {
    monthRef.current = shownMonth
  }, [shownMonth])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const next = months.indexOf(monthRef.current ?? '') + 1
      if (next >= months.length) setPlaying(false)
      else setMonth(months[next])
    }, PLAY_STEP_MS)
    return () => window.clearInterval(timer)
  }, [playing, months])
  const play = () => {
    if (!shownMonth || shownMonth === months.at(-1)) setMonth(months[0])
    setPlaying(true)
  }

  // The map itself: tiles, the area asked for, and the view. Only for new data.
  useEffect(() => {
    if (!element.current || !view) return
    // The panel scrolls; the wheel should scroll it, not zoom the map.
    // zoomSnap 0.25: an area fills the map instead of jumping to the next whole zoom level.
    const map = L.map(element.current, { preferCanvas: true, scrollWheelZoom: false, zoomSnap: 0.25 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    // Detailed European data (rivers, lakes) starts on Germany; everything else on all of it.
    const first = initialView?.bbox ?? view
    const bounds = L.latLngBounds([first[1], first[0]], [first[3], first[2]])
    if (extent && isArea) {
      const area = L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]])
      L.rectangle(area, { color: AREA_COLOR, weight: 1.5, dashArray: '6 4', fill: false, interactive: false }).addTo(map)
      bounds.extend(area)
    }
    // A single place (e.g. NASA POWER) has no extent to fit.
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) map.setView(bounds.getCenter(), SINGLE_POINT_ZOOM)
    else map.fitBounds(bounds, { padding: [20, 20] })

    // Outline and orientation places sit above the data in their own panes and
    // let the pointer through, so the cells underneath still show their tooltips.
    if (outline) {
      const pane = map.createPane('outline')
      pane.style.zIndex = '450'
      pane.style.pointerEvents = 'none'
      L.geoJSON(outline.geometry as GeoJSON.Geometry, {
        pane: 'outline',
        interactive: false,
        style: { color: OUTLINE_COLOR, weight: 1.8, opacity: 0.9, fill: false },
      }).addTo(map)
    }
    if (landmarks?.length) {
      const pane = map.createPane('landmarks')
      pane.style.zIndex = '460'
      pane.style.pointerEvents = 'none'
      for (const place of landmarks) {
        L.circleMarker([place.lat, place.lon], {
          pane: 'landmarks',
          interactive: false,
          radius: 3.5,
          color: '#ffffff',
          weight: 1.5,
          fillColor: OUTLINE_COLOR,
          fillOpacity: 1,
        })
          .bindTooltip(pick(place.label) ?? '', { permanent: true, direction: 'right', offset: [5, 0], className: 'map-landmark' })
          .addTo(map)
      }
    }

    mapRef.current = map
    // The tab may be hidden or resized; Leaflet needs to know its new size.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(element.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [view, extent, isArea, initialView, outline, landmarks])

  // The marks: redrawn when the measurement, the statistic or the labels change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = L.layerGroup().addTo(map)
    const colorOf = (item: MapItem) => {
      const value = measure ? item.values[measure.name]?.[stat] : undefined
      if (!measure) return SINGLE_COLOR
      if (value === undefined) return NO_VALUE_COLOR
      return limits.length ? CLASS_COLORS[classOf(value, limits)] : SINGLE_COLOR
    }
    /** "In dieser Zelle: Münster" — which orientation places lie in a grid cell. */
    const placesIn = (item: MapItem) =>
      grid && landmarks
        ? landmarks
            .filter((l) => Math.abs(l.lat - item.lat!) <= grid.cellSize[1] / 2 && Math.abs(l.lon - item.lon!) <= grid.cellSize[0] / 2)
            .map((l) => pick(l.label) ?? '')
        : []
    const tooltipOf = (item: MapItem) => {
      const inCell = placesIn(item)
      return tooltipFor(item, allowed, measure, stat, kind, {
        heading: shownMonth ? `${formatDate(shownMonth)}:` : undefined,
        extra: inCell.length ? [t('map.inCell', { places: inCell.join(', ') })] : [],
      })
    }

    if (mode === 'shapes') {
      // One GeoJSON layer for all shapes (drawn on one canvas); each feature knows its row.
      const features = items.map((item, i) => ({ type: 'Feature' as const, geometry: item.geometry!, properties: { i } }))
      L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
        style: (feature) => {
          const item = items[feature?.properties.i]
          const color = colorOf(item)
          // Lines without a value to show (rivers) are thin and dark, so a dense network stays readable.
          return shapeKind(item.geometry!) === 'line'
            ? measure
              ? { color, weight: 1.5, opacity: 0.95 }
              : { color: LINE_COLOR, weight: 1.1, opacity: 0.85 }
            : { fillColor: color, fillOpacity: 0.75, color: '#ffffff', weight: 0.8 }
        },
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            color: '#ffffff',
            weight: 1.5,
            fillColor: colorOf(items[feature.properties.i]),
            fillOpacity: 0.95,
          }),
        onEachFeature: (feature, shapeLayer) => shapeLayer.bindTooltip(tooltipOf(items[feature.properties.i]), { sticky: true }),
      }).addTo(layer)
    } else {
      for (const item of items) {
        const color = colorOf(item)
        const at: L.LatLngTuple = [item.lat!, item.lon!]
        let mark: L.Layer
        if (mode === 'grid' && grid) {
          const [dLon, dLat] = grid.cellSize
          mark = L.rectangle(
            [
              [item.lat! - dLat / 2, item.lon! - dLon / 2],
              [item.lat! + dLat / 2, item.lon! + dLon / 2],
            ],
            { fillColor: color, fillOpacity: 0.75, color: '#ffffff', weight: 0.5 },
          )
        } else if (kind) {
          // Icons for the few stations or grid points of the API loaders.
          mark = L.marker(at, { icon: iconFor(kind, color), keyboard: true })
        } else {
          // Plain dots (drawn on one canvas) for datasets that can have thousands of places.
          mark = L.circleMarker(at, { radius: 7, color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.95 })
        }
        mark.bindTooltip(tooltipOf(item), { sticky: mode === 'grid' }).addTo(layer)
        const value = measure ? item.values[measure.name]?.[stat] : undefined
        if (numbers && value !== undefined) {
          const label = document.createElement('span')
          label.textContent = short(value)
          L.marker(at, {
            icon: L.divIcon({
              className: 'map-value-label',
              html: label,
              iconSize: undefined,
              // Next to a marker; on a grid cell, in its middle.
              iconAnchor: mode === 'grid' ? [12, 7] : [kind ? -16 : -10, 9],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(layer)
        }
      }
    }
    return () => {
      layer.remove()
    }
    // `view` is listed so the marks are drawn again on a newly created map.
  }, [items, allowed, measure, stat, limits, numbers, kind, mode, grid, view, landmarks, shownMonth])

  if (!found) return null
  if (items.length === 0) {
    return (
      <Text size="2" color="gray">
        {t('map.noPlaces')}
      </Text>
    )
  }

  let count: string
  if (mode === 'shapes') count = shapeCounts(items)
  else if (mode === 'grid' && grid) {
    count = t('map.gridCells', {
      count: formatNumber(items.length),
      lat: degrees.format(grid.cellSize[1]),
      lon: degrees.format(grid.cellSize[0]),
    })
  } else count = items.length === 1 ? t('map.placeOne') : t('map.places', { count: formatNumber(items.length) })
  const notes = [
    count,
    kind === 'sensor-station' && t('map.iconStation'),
    kind === 'grid-cell' && t('map.iconGridCell'),
    found.leftOut > 0 && t('map.leftOut', { count: formatNumber(found.leftOut) }),
    found.withoutPlace > 0 &&
      t(mode === 'shapes' ? 'map.withoutShape' : 'map.withoutPlace', { count: formatNumber(found.withoutPlace) }),
    isArea && t('map.area'),
    outline && t('map.outlineNote', { area: pick(outline.label) ?? '' }),
    landmarks?.length && t('map.landmarksNote'),
    initialView && t('map.initialView', { area: pick(initialView.label) ?? '' }),
  ].filter(Boolean)

  const missing = !!measure && items.some((p) => !p.values[measure.name])
  const kinds = new Set(items.flatMap((i) => (i.geometry ? [shapeKind(i.geometry)] : [])))
  const swatch: Swatch =
    mode === 'grid' || kind === 'sensor-station' || kinds.has('area') ? 'square'
    : kinds.size === 1 && kinds.has('line') ? 'line'
    : 'circle'

  return (
    <Flex direction="column" gap="2">
      {allowed.length > 0 && (
        <Flex direction="column" gap="2">
          <Flex gap="2" wrap="wrap" align="center" role="group" aria-label={t('map.colourBy')}>
            <Text size="1" color="gray">
              {t('map.colourBy')}
            </Text>
            {allowed.map((c) => (
              <Button
                key={c.name}
                size="1"
                variant={c === measure ? 'solid' : 'soft'}
                color={c === measure ? undefined : 'gray'}
                aria-pressed={c === measure}
                onClick={() => setChosen(c.name)}
              >
                {nameOf(c)}
              </Button>
            ))}
          </Flex>
          {months.length > 0 && (
            <Flex gap="2" wrap="wrap" align="center" className="map-time" role="group" aria-label={t('map.month')}>
              <Button size="1" variant="soft" onClick={() => (playing ? setPlaying(false) : play())}>
                {playing ? `❚❚ ${t('map.pause')}` : `▶ ${t('map.play')}`}
              </Button>
              <Slider
                size="1"
                min={0}
                max={months.length - 1}
                step={1}
                value={[shownMonth ? months.indexOf(shownMonth) : 0]}
                onValueChange={([i]) => {
                  setPlaying(false)
                  setMonth(months[i])
                }}
                aria-label={t('map.month')}
                className="map-time-slider"
                // From "whole year" the thumb rests on the first month; touching it picks that month.
                onPointerDown={() => !shownMonth && setMonth(months[0])}
                onKeyDown={() => !shownMonth && setMonth(months[0])}
              />
              <Text size="1" weight="medium" className="map-time-label">
                {shownMonth ? formatDate(shownMonth) : t('map.wholePeriod')}
              </Text>
              <Button
                size="1"
                variant={shownMonth ? 'soft' : 'solid'}
                color={shownMonth ? 'gray' : undefined}
                aria-pressed={!shownMonth}
                onClick={() => {
                  setPlaying(false)
                  setMonth(null)
                }}
              >
                {t('map.wholePeriod')}
              </Button>
            </Flex>
          )}
          <Flex gap="3" wrap="wrap" align="center">
            {severalPerPlace && (
              <Flex gap="2" align="center">
                <Text size="1" color="gray">
                  {t('map.statLabel')}
                </Text>
                <Select.Root size="1" value={stat} onValueChange={(v) => setStat(v as PlaceStat)}>
                  <Select.Trigger aria-label={t('map.statLabel')} />
                  <Select.Content>
                    {STATS.map((s) => (
                      <Select.Item key={s} value={s}>
                        {t(`map.stat.${s}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>
            )}
            {/* Numbers next to markers or on cells; lines and areas have no single spot for them. */}
            {mode !== 'shapes' && (
              <Text as="label" size="1">
                <Flex gap="1" align="center">
                  <Checkbox size="1" checked={numbers} onCheckedChange={(c) => setNumbers(c === true)} />
                  {t('map.showNumbers')}
                </Flex>
              </Text>
            )}
          </Flex>
        </Flex>
      )}

      <div ref={element} className="map-preview" role="region" aria-label={t('dataset.map')} />

      {measure && values.length > 0 && (
        <Legend
          measure={measure}
          stat={stat}
          limits={limits}
          single={
            limits.length ? undefined
            : values.length === 1 ? withUnit(values[0], measure)
            : t('map.allAbout', { value: withUnit(values[0], measure) })
          }
          missing={missing}
          swatch={swatch}
          withStat={severalPerPlace}
          at={shownMonth ? formatDate(shownMonth) : undefined}
        />
      )}
      {measures.length > allowed.length && (
        <Text size="1" color="violet">
          🔒 {t(allowed.length ? 'map.someHiddenForGuess' : 'map.hiddenForGuess')}
        </Text>
      )}
      {measures.length === 0 && (
        <Text size="1" color="gray">
          {t('map.noMeasurements')}
        </Text>
      )}
      <Text as="p" size="1" color="gray">
        {notes.join(' · ')}
      </Text>
    </Flex>
  )
}
