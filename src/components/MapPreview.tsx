import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Flex, Select, Text } from '@radix-ui/themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { classLimits, classOf, mapPointsOf, type MapPoint, type PlaceStat } from '../core/geo'
import type { ColumnMeta, DataTable, DatasetMeta } from '../core/types'
import { glossaryForColumn } from '../glossary'
import { formatDate, formatNumber, pick, t } from '../i18n'
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
/** Zoom for a single point: shows the town and its surroundings. */
const SINGLE_POINT_ZOOM = 9

const STATS: PlaceStat[] = ['mean', 'max', 'min', 'latest']

type PlaceKind = NonNullable<DatasetMeta['placeKind']>

/** One decimal is enough on a map; the tooltip keeps the full value. */
const short = (value: number) => formatNumber(Math.round(value * 10) / 10)

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
  point: MapPoint,
  measures: ColumnMeta[],
  colourBy: ColumnMeta | undefined,
  stat: PlaceStat,
  kind: PlaceKind | undefined,
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
  if (measures.length === 0) {
    line(rowsText(point.rows))
    return box
  }

  line(`${t(`map.stat.${stat}`)}:`, 'map-tooltip-heading')
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
  kind,
}: {
  measure: ColumnMeta
  stat: PlaceStat
  limits: number[]
  single?: string
  missing: boolean
  kind: PlaceKind | undefined
}) {
  const title =
    t('map.legendTitle', { name: nameOf(measure), stat: t(`map.stat.${stat}`) }) +
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
              className={kind === 'sensor-station' ? 'map-legend-swatch square' : 'map-legend-swatch'}
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

/**
 * Where the data is and what was measured there: one marker per place
 * (a box for a senseBox station, a satellite for a model/satellite grid
 * cell, a dot otherwise), coloured by the measurement the student picks,
 * summed up per place (mean, highest, lowest or newest value). The tooltip
 * lists all measurements of the place. The area that was asked for is a
 * dashed rectangle. Columns hidden for a guess are left out entirely.
 */
export function MapPreview({ table, hidden }: { table: DataTable; hidden: ReadonlySet<string> }) {
  const element = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [stat, setStat] = useState<PlaceStat>('mean')
  const [numbers, setNumbers] = useState(false)

  const kind = table.meta.placeKind
  const measures = useMemo(() => table.columns.filter((c) => c.semanticType === 'measurement'), [table])
  const allowed = useMemo(() => measures.filter((c) => !hidden.has(c.name)), [measures, hidden])
  const measure = useMemo(() => allowed.find((c) => c.name === chosen) ?? allowed[0], [allowed, chosen])

  // Places only (for the view); then the values of every shown measurement per place.
  const places = useMemo(() => mapPointsOf(table), [table])
  const found = useMemo(() => mapPointsOf(table, allowed.map((c) => c.name)), [table, allowed])
  const values = useMemo(
    () =>
      measure
        ? (found?.points ?? []).flatMap((p) => {
            const v = p.values[measure.name]?.[stat]
            return v === undefined ? [] : [v]
          })
        : [],
    [found, measure, stat],
  )
  const limits = useMemo(() => classLimits(values), [values])
  const severalPerPlace = !!measure && (found?.points ?? []).some((p) => (p.values[measure.name]?.count ?? 0) > 1)
  const extent = table.meta.spatialExtent
  const isArea = !!extent && (extent[0] !== extent[2] || extent[1] !== extent[3])

  // The map itself: tiles, the area asked for, and the view. Only for new data.
  useEffect(() => {
    if (!element.current || !places || places.points.length === 0) return
    // The panel scrolls; the wheel should scroll it, not zoom the map.
    const map = L.map(element.current, { preferCanvas: true, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const bounds = L.latLngBounds([])
    if (extent && isArea) {
      const area = L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]])
      L.rectangle(area, { color: AREA_COLOR, weight: 1.5, dashArray: '6 4', fill: false, interactive: false }).addTo(map)
      bounds.extend(area)
    }
    for (const point of places.points) bounds.extend([point.lat, point.lon])
    // A single place (e.g. NASA POWER) has no extent to fit.
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) map.setView(bounds.getCenter(), SINGLE_POINT_ZOOM)
    else map.fitBounds(bounds, { padding: [20, 20] })

    mapRef.current = map
    // The tab may be hidden or resized; Leaflet needs to know its new size.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(element.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [places, extent, isArea])

  // The markers: redrawn when the measurement, the statistic or the labels change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !found) return
    const layer = L.layerGroup().addTo(map)
    for (const point of found.points) {
      const value = measure ? point.values[measure.name]?.[stat] : undefined
      const color =
        !measure ? SINGLE_COLOR
        : value === undefined ? NO_VALUE_COLOR
        : limits.length ? CLASS_COLORS[classOf(value, limits)]
        : SINGLE_COLOR
      const tooltip = tooltipFor(point, allowed, measure, stat, kind)
      // Icons for the few stations or grid cells of the API loaders; plain
      // dots (drawn on one canvas) for datasets that can have thousands of places.
      const marker = kind
        ? L.marker([point.lat, point.lon], { icon: iconFor(kind, color), keyboard: true })
        : L.circleMarker([point.lat, point.lon], { radius: 7, color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.95 })
      marker.bindTooltip(tooltip).addTo(layer)
      if (numbers && value !== undefined) {
        const label = document.createElement('span')
        label.textContent = short(value)
        L.marker([point.lat, point.lon], {
          icon: L.divIcon({ className: 'map-value-label', html: label, iconSize: undefined, iconAnchor: [kind ? -16 : -10, 9] }),
          interactive: false,
          keyboard: false,
        }).addTo(layer)
      }
    }
    return () => {
      layer.remove()
    }
  }, [found, allowed, measure, stat, limits, numbers, kind])

  if (!places) return null
  if (places.points.length === 0) {
    return (
      <Text size="2" color="gray">
        {t('map.noPlaces')}
      </Text>
    )
  }

  const notes = [
    places.points.length === 1 ? t('map.placeOne') : t('map.places', { count: formatNumber(places.points.length) }),
    kind === 'sensor-station' && t('map.iconStation'),
    kind === 'grid-cell' && t('map.iconGridCell'),
    places.leftOut > 0 && t('map.leftOut', { count: formatNumber(places.leftOut) }),
    places.withoutPlace > 0 && t('map.withoutPlace', { count: formatNumber(places.withoutPlace) }),
    isArea && t('map.area'),
  ].filter(Boolean)

  const missing = !!measure && found!.points.some((p) => !p.values[measure.name])

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
            <Text as="label" size="1">
              <Flex gap="1" align="center">
                <Checkbox size="1" checked={numbers} onCheckedChange={(c) => setNumbers(c === true)} />
                {t('map.showNumbers')}
              </Flex>
            </Text>
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
          kind={kind}
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
