import type { DataType, LocalizedText, SemanticType } from '../../core/types'

/**
 * Natural Earth (public domain, naturalearthdata.com), version 5.1.2 from the
 * project's GitHub repository via jsDelivr (pinned, so the data doesn't
 * change under a saved workspace). Files and fields checked on 2026-10-26.
 */
export const NE_BASE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson'
export const NE_VERSION = '5.1.2'

export interface NeColumn {
  name: string
  /** Source properties, first non-empty wins (e.g. the German name, else the English one). */
  from: string[]
  label: LocalizedText
  dataType: DataType
  semanticType: SemanticType
  unit?: string
}

/** [minLon, minLat, maxLon, maxLat] */
export type Bbox = [number, number, number, number]

/** Germany's outline rectangle (Huwise georef-germany-land), the first view for European rivers. */
const GERMANY: { bbox: Bbox; label: LocalizedText } = { bbox: [5.87, 47.27, 15.04, 55.06], label: { de: 'Deutschland', en: 'Germany' } }

/**
 * Lakes are small at the scale of a country: the first view is the Alpine
 * foreland from Bodensee (9.03° E) to Chiemsee (12.53° E), positions from
 * the lake files themselves, where many of Germany's large lakes lie.
 */
const ALPINE_FORELAND: { bbox: Bbox; label: LocalizedText } = {
  bbox: [8.9, 47.3, 12.7, 48.2],
  label: { de: 'Alpenvorland (Bodensee bis Chiemsee)', en: 'Alpine foreland (Lake Constance to Chiemsee)' },
}

export interface NeDataset {
  id: string
  /** One or more files; together they make the dataset (e.g. large lakes + smaller European ones). */
  files: string[]
  /** Keep only shapes reaching into this rectangle (e.g. Europe out of a world file). */
  within?: Bbox
  /** What the map shows first: detailed European data would look empty or tangled at full extent. */
  view?: { bbox: Bbox; label: LocalizedText }
  label: LocalizedText
  /** Map scale of the file: 1:110 million is coarse, 1:10 million detailed. */
  scale: string
  /** Python variable name base. */
  pythonName: string
  columns: NeColumn[]
  description: LocalizedText
}

const name = (from: string[]): NeColumn => ({
  name: 'name',
  from,
  label: { de: 'Name', en: 'Name' },
  dataType: 'string',
  semanticType: 'text',
})

export const NE_DATASETS: NeDataset[] = [
  {
    id: 'countries',
    files: ['ne_110m_admin_0_countries'],
    label: { de: 'Länder der Welt', en: 'Countries of the world' },
    scale: '1:110 000 000',
    pythonName: 'laender_der_welt',
    columns: [
      name(['NAME_DE', 'NAME']),
      { name: 'kontinent', from: ['CONTINENT'], label: { de: 'Kontinent', en: 'Continent' }, dataType: 'string', semanticType: 'category' },
      { name: 'einwohner', from: ['POP_EST'], label: { de: 'Einwohner', en: 'Population' }, dataType: 'number', semanticType: 'measurement' },
      { name: 'einwohner_jahr', from: ['POP_YEAR'], label: { de: 'Jahr der Einwohnerzahl', en: 'Year of population' }, dataType: 'string', semanticType: 'category' },
      { name: 'bip', from: ['GDP_MD'], label: { de: 'Bruttoinlandsprodukt', en: 'Gross domestic product' }, dataType: 'number', semanticType: 'measurement', unit: 'Mio. US-$' },
      { name: 'bip_jahr', from: ['GDP_YEAR'], label: { de: 'Jahr des BIP', en: 'Year of GDP' }, dataType: 'string', semanticType: 'category' },
      { name: 'einkommensgruppe', from: ['INCOME_GRP'], label: { de: 'Einkommensgruppe', en: 'Income group' }, dataType: 'string', semanticType: 'category' },
      { name: 'iso', from: ['ISO_A3'], label: { de: 'Ländercode (ISO)', en: 'Country code (ISO)' }, dataType: 'string', semanticType: 'identifier' },
    ],
    description: {
      de: 'Grenzen der Länder der Welt mit geschätzter Einwohnerzahl und Bruttoinlandsprodukt. Die Werte stammen aus unterschiedlichen Jahren (siehe die Jahres-Spalten). Grob vereinfachte Grenzen (Maßstab 1:110 Mio.).',
      en: 'Borders of the countries of the world with estimated population and gross domestic product. The values are from different years (see the year columns). Coarsely simplified borders (scale 1:110 million).',
    },
  },
  {
    id: 'cities',
    files: ['ne_110m_populated_places'],
    label: { de: 'Große Städte der Welt', en: 'Major cities of the world' },
    scale: '1:110 000 000',
    pythonName: 'staedte_der_welt',
    columns: [
      name(['NAME_DE', 'NAME']),
      { name: 'land', from: ['ADM0NAME'], label: { de: 'Land', en: 'Country' }, dataType: 'string', semanticType: 'text' },
      { name: 'einwohner', from: ['POP_MAX'], label: { de: 'Einwohner (Ballungsraum)', en: 'Population (urban area)' }, dataType: 'number', semanticType: 'measurement' },
      { name: 'art', from: ['FEATURECLA'], label: { de: 'Art', en: 'Kind' }, dataType: 'string', semanticType: 'category' },
    ],
    description: {
      de: 'Hauptstädte und große Städte der Welt als Punkte, mit der Einwohnerzahl des Ballungsraums.',
      en: 'Capitals and major cities of the world as points, with the population of the urban area.',
    },
  },
  {
    id: 'lakes',
    // The world file has the large lakes (Bodensee, Müritz), the European supplement
    // the smaller ones (Chiemsee, Steinhuder Meer); neither alone shows Germany's lakes.
    files: ['ne_10m_lakes', 'ne_10m_lakes_europe'],
    within: [-25, 34, 45, 72],
    view: ALPINE_FORELAND,
    label: { de: 'Seen in Europa', en: 'Lakes in Europe' },
    scale: '1:10 000 000',
    pythonName: 'seen_in_europa',
    columns: [
      name(['name_de', 'name']),
      { name: 'art', from: ['featurecla'], label: { de: 'Art', en: 'Kind' }, dataType: 'string', semanticType: 'category' },
    ],
    description: {
      de: 'Seen und Stauseen in Europa als Flächen (Maßstab 1:10 Mio.). Sehr kleine Seen fehlen.',
      en: 'Lakes and reservoirs in Europe as areas (scale 1:10 million). Very small lakes are missing.',
    },
  },
  {
    id: 'rivers',
    files: ['ne_10m_rivers_europe'],
    view: GERMANY,
    label: { de: 'Flüsse in Europa', en: 'Rivers in Europe' },
    scale: '1:10 000 000',
    pythonName: 'fluesse_in_europa',
    columns: [
      name(['name_de', 'name']),
      { name: 'art', from: ['featurecla'], label: { de: 'Art', en: 'Kind' }, dataType: 'string', semanticType: 'category' },
    ],
    description: {
      de: 'Flüsse in Europa als Linien (Maßstab 1:10 Mio.). Viele kleinere Abschnitte haben keinen Namen.',
      en: 'Rivers in Europe as lines (scale 1:10 million). Many smaller sections have no name.',
    },
  },
]

export const neDataset = (id: string) => NE_DATASETS.find((d) => d.id === id)
