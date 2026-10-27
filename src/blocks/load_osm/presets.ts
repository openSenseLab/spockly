import type { LocalizedText, MapStyle, SemanticType } from '../../core/types'
import { areaPreset, type AreaPreset } from '../load_osem/presets'

/** One OSM tag shown as a column, e.g. a cycle path's surface. */
export interface OsmColumn {
  name: string
  tag: string
  label: LocalizedText
  semanticType: SemanticType
}

/** One value of a derived column, with its colour on the map. */
export interface OsmKind {
  value: string
  label: LocalizedText
  color: string
}

/**
 * A column worked out from several tags, e.g. what kind of cycle path a way
 * is. The map colours the shapes by it.
 */
export interface OsmDerived {
  name: string
  label: LocalizedText
  /** The first kind whose test matches; null if none does. */
  of: (tags: Record<string, string>) => string | null
  kinds: OsmKind[]
  /** The same rules in Python, as the body of def art(t): with the tags in t. */
  python: string
}

export interface OsmTopic {
  id: string
  label: LocalizedText
  /** What the shapes are: lines, areas (closed ways) or points (nodes, or the centre of a way). */
  shape: 'line' | 'area' | 'point'
  /** Overpass QL for one bounding box, written as {bbox}; ends with the out statement. */
  query: string
  columns: OsmColumn[]
  derived?: OsmDerived
  /** Symbol and colour on the map. */
  mapStyle?: MapStyle
  /** Python variable name base. */
  pythonName: string
}

const tag = (name: string, osmTag: string, de: string, en: string, semanticType: SemanticType = 'category'): OsmColumn => ({
  name,
  tag: osmTag,
  label: { de, en },
  semanticType,
})

/** Tags as documented on wiki.openstreetmap.org (checked 2026-10-27). */
export const OSM_TOPICS: OsmTopic[] = [
  {
    id: 'fluesse',
    label: { de: 'Flüsse und Bäche', en: 'Rivers and streams' },
    shape: 'line',
    query: 'way["waterway"~"^(river|stream|canal)$"]({bbox});out geom;',
    columns: [tag('art', 'waterway', 'Art', 'Kind')],
    pythonName: 'fluesse',
  },
  {
    id: 'radwege',
    label: { de: 'Radwege', en: 'Cycle paths' },
    shape: 'line',
    // Separate cycle paths, paths shared with walkers, bicycle streets and cycle lanes/tracks along roads.
    query:
      '(way["highway"="cycleway"]({bbox});' +
      'way["highway"~"^(path|footway|track|bridleway)$"]["bicycle"="designated"]({bbox});' +
      'way["bicycle_road"="yes"]({bbox});' +
      'way["highway"]["cycleway"~"^(lane|track)$"]({bbox});' +
      'way["highway"]["cycleway:both"~"^(lane|track)$"]({bbox});' +
      'way["highway"]["cycleway:right"~"^(lane|track)$"]({bbox});' +
      'way["highway"]["cycleway:left"~"^(lane|track)$"]({bbox}););out geom;',
    columns: [tag('belag', 'surface', 'Belag', 'Surface'), tag('beleuchtet', 'lit', 'Beleuchtet', 'Lit')],
    derived: {
      name: 'art',
      label: { de: 'Art', en: 'Kind' },
      of: (t) => {
        if (t.bicycle_road === 'yes') return 'fahrradstrasse'
        if (t.highway === 'cycleway') return 'radweg'
        if (t.bicycle === 'designated' && ['path', 'footway', 'track', 'bridleway'].includes(t.highway)) return 'rad_und_fuss'
        if (['cycleway', 'cycleway:both', 'cycleway:right', 'cycleway:left'].some((k) => t[k] === 'lane' || t[k] === 'track')) return 'an_der_strasse'
        return null
      },
      // Categorical slots 1–4 of the dataviz palette, in this order (validated, light surface).
      kinds: [
        { value: 'radweg', label: { de: 'eigener Radweg', en: 'separate cycle path' }, color: '#2a78d6' },
        { value: 'an_der_strasse', label: { de: 'Radweg/-streifen an der Straße', en: 'cycle lane/track along a road' }, color: '#eb6834' },
        { value: 'rad_und_fuss', label: { de: 'Rad- und Fußweg', en: 'shared with walkers' }, color: '#1baf7a' },
        { value: 'fahrradstrasse', label: { de: 'Fahrradstraße', en: 'bicycle street' }, color: '#eda100' },
      ],
      python:
        '    if t.get("bicycle_road") == "yes": return "fahrradstrasse"\n' +
        '    if t.get("highway") == "cycleway": return "radweg"\n' +
        '    if t.get("bicycle") == "designated" and t.get("highway") in ("path", "footway", "track", "bridleway"): return "rad_und_fuss"\n' +
        '    if any(t.get(k) in ("lane", "track") for k in ("cycleway", "cycleway:both", "cycleway:right", "cycleway:left")): return "an_der_strasse"\n' +
        '    return None\n',
    },
    pythonName: 'radwege',
  },
  {
    id: 'parks',
    label: { de: 'Parks', en: 'Parks' },
    shape: 'area',
    query: 'way["leisure"="park"]({bbox});out geom;',
    columns: [],
    mapStyle: { symbol: 'tree', color: '#008300', label: { de: 'Park', en: 'Park' } },
    pythonName: 'parks',
  },
  {
    id: 'spielplaetze',
    label: { de: 'Spielplätze', en: 'Playgrounds' },
    shape: 'point',
    query: '(node["leisure"="playground"]({bbox});way["leisure"="playground"]({bbox}););out center;',
    columns: [],
    mapStyle: { symbol: 'playground', color: '#eb6834', label: { de: 'Spielplatz', en: 'Playground' } },
    pythonName: 'spielplaetze',
  },
  {
    id: 'trinkwasser',
    label: { de: 'Trinkwasserstellen', en: 'Drinking water' },
    shape: 'point',
    query: 'node["amenity"="drinking_water"]({bbox});out;',
    columns: [],
    mapStyle: { symbol: 'drinking-water', color: '#2a78d6', label: { de: 'Trinkwasserstelle', en: 'Drinking water' } },
    pythonName: 'trinkwasser',
  },
  {
    id: 'haltestellen',
    label: { de: 'Bushaltestellen', en: 'Bus stops' },
    shape: 'point',
    query: 'node["highway"="bus_stop"]({bbox});out;',
    columns: [tag('unterstand', 'shelter', 'Unterstand', 'Shelter'), tag('bank', 'bench', 'Sitzbank', 'Bench')],
    // The green "H" of German bus stop signs.
    mapStyle: { symbol: 'bus-stop', color: '#008300', label: { de: 'Bushaltestelle', en: 'Bus stop' } },
    pythonName: 'bushaltestellen',
  },
]

export const osmTopic = (id: string) => OSM_TOPICS.find((t) => t.id === id)

/**
 * Bounding rectangles of whole cities, looked up in OpenStreetMap
 * (Nominatim) on 2026-10-27. Hamburg and Bremen are left out: their
 * rectangles reach far into the sea (Neuwerk island, Bremerhaven).
 */
const CITIES: AreaPreset[] = [
  { id: 'berlin', label: { de: 'Berlin', en: 'Berlin' }, bbox: [13.088345, 52.3382448, 13.7611609, 52.6755087] },
  { id: 'dresden', label: { de: 'Dresden', en: 'Dresden' }, bbox: [13.5793237, 50.9749317, 13.9660626, 51.1776864] },
  { id: 'freiburg', label: { de: 'Freiburg im Breisgau', en: 'Freiburg im Breisgau' }, bbox: [7.6620055, 47.9035777, 7.9308444, 48.0710579] },
  { id: 'koeln', label: { de: 'Köln', en: 'Cologne' }, bbox: [6.7725303, 50.8304399, 7.162028, 51.0849743] },
  { id: 'leipzig', label: { de: 'Leipzig', en: 'Leipzig' }, bbox: [12.2366519, 51.2381704, 12.5424918, 51.4481145] },
  { id: 'muenchen', label: { de: 'München', en: 'Munich' }, bbox: [11.360777, 48.0616244, 11.7229099, 48.2481162] },
]

/** Münster first (the same areas as the openSenseMap block), then other cities to compare with. */
export const OSM_AREAS: AreaPreset[] = [areaPreset('muenster-mitte')!, areaPreset('muenster')!, ...CITIES]
export const OSM_AREA_IDS = OSM_AREAS.map((a) => a.id)
export const osmArea = (id: string) => OSM_AREAS.find((a) => a.id === id)

/**
 * Areas with stored copies in public/data/osm. For the other cities the
 * Münster copy stands in, so a class without a server can still work.
 */
export const SNAPSHOT_AREAS = ['muenster-mitte', 'muenster']
export const snapshotArea = (id: string) => (SNAPSHOT_AREAS.includes(id) ? id : 'muenster')

/**
 * Public Overpass servers, asked one after the other. On 2026-10-26/27 the
 * main server often answered "at capacity" (HTTP 502) at once, while its
 * alternative hosts answered after ~40 s in the queue.
 */
export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
]

/** How long to wait for one server before asking the next. */
export const SERVER_TIMEOUT_MS = 60_000

/** Date the stored copies in public/data/osm were recorded. */
export const SNAPSHOT_DATE = '2026-10-27'

export const overpassQuery = (topic: OsmTopic, bbox: [number, number, number, number]) => {
  const [w, s, e, n] = bbox
  return `[out:json][timeout:60];${topic.query.replaceAll('{bbox}', `${s},${w},${n},${e}`)}`
}
