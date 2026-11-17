/**
 * Short, school-level explanations of measured quantities, with a reference
 * value to guess against. Every fact comes from the listed sources (checked
 * 2026-10-20); where no reliable source was found there is no reference value.
 * Wording should be reviewed by a teacher.
 */
import type { LocalizedText } from '../core/types'

export interface Source {
  label: string
  url: string
}

export interface GlossaryEntry {
  id: string
  /** Sensor titles / labels that mean this quantity (compared lower-case, trimmed). */
  names: string[]
  /** Column names from a data source that mean this quantity (e.g. NASA POWER codes). */
  codes?: string[]
  title: LocalizedText
  explanation: LocalizedText
  /** Longer reference values, shown in the info popover. */
  reference?: LocalizedText
  /** One short line for the guess block ("Zur Orientierung: …"). */
  hint?: LocalizedText
  sources: Source[]
}

const DWD = 'DWD (Deutscher Wetterdienst)'
const UBA = 'Umweltbundesamt'

const PM_SOURCES: Source[] = [
  { label: `${UBA}: Feinstaub`, url: 'https://www.umweltbundesamt.de/themen/luft/luftschadstoffe-im-ueberblick/feinstaub' },
  { label: 'EU: Air quality standards', url: 'https://environment.ec.europa.eu/topics/air/air-quality/eu-air-quality-standards_en' },
  { label: 'Richtlinie (EU) 2024/2881', url: 'https://eur-lex.europa.eu/eli/dir/2024/2881' },
  {
    label: 'WHO Air Quality Guidelines 2021 (Compendium, Tab. 2.1)',
    url: 'https://cdn.who.int/media/docs/default-source/environmental-health-impact/who_compendium_air_pollution_01042022_eo_final.pdf',
  },
]

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'temperature',
    names: ['temperatur', 'temperature', 'lufttemperatur', 'air temperature'],
    codes: ['T2M', 'T2M_MAX', 'T2M_MIN'],
    title: { de: 'Temperatur', en: 'Temperature' },
    explanation: {
      de: 'Die Lufttemperatur, gemessen in Grad Celsius (°C). Tagesmittel sind niedriger als die Höchstwerte eines Tages.',
      en: 'The air temperature, measured in degrees Celsius (°C). Daily means are lower than the highest values of a day.',
    },
    reference: {
      de: 'Der Deutsche Wetterdienst nennt einen Tag mit mindestens 25 °C einen Sommertag, ab 30 °C einen heißen Tag.',
      en: 'The German Weather Service calls a day with at least 25 °C a summer day, and from 30 °C a hot day.',
    },
    hint: { de: 'Sommertag ab 25 °C, heißer Tag ab 30 °C (DWD)', en: 'summer day from 25 °C, hot day from 30 °C (DWD)' },
    sources: [
      { label: `${DWD}: Sommertag`, url: 'https://www.dwd.de/DE/service/lexikon/Functions/glossar.html?lv3=102522&lv2=102248' },
      { label: `${DWD}: Heißer Tag`, url: 'https://www.dwd.de/DE/service/lexikon/Functions/glossar.html?lv3=101162&lv2=101094' },
    ],
  },
  {
    id: 'humidity',
    names: [
      'rel. luftfeuchte',
      'relative luftfeuchte',
      'rel. luftfeuchtigkeit',
      'relative luftfeuchtigkeit',
      'luftfeuchte',
      'luftfeuchtigkeit',
      'rel. humidity',
      'relative humidity',
      'humidity',
    ],
    codes: ['RH2M'],
    title: { de: 'Relative Luftfeuchte', en: 'Relative humidity' },
    explanation: {
      de: 'Wie viel Wasserdampf die Luft enthält – im Verhältnis zu dem, was sie bei dieser Temperatur höchstens aufnehmen kann. In Prozent (%).',
      en: 'How much water vapour the air holds, compared with the most it can hold at this temperature. In percent (%).',
    },
    reference: {
      de: '100 % heißt: Die Luft ist gesättigt, mehr Wasserdampf geht nicht. 50 % heißt: halb so viel wie möglich.',
      en: '100 % means the air is saturated and can’t hold more water vapour. 50 % means half as much as possible.',
    },
    hint: { de: '100 % = gesättigte Luft', en: '100 % = saturated air' },
    sources: [{ label: `${DWD}: Relative Feuchte`, url: 'https://www.dwd.de/DE/service/lexikon/Functions/glossar.html?lv3=102222&lv2=102134' }],
  },
  {
    id: 'pressure',
    names: ['luftdruck', 'air pressure', 'atmospheric pressure', 'pressure', 'barometric pressure'],
    codes: ['PS'],
    title: { de: 'Luftdruck', en: 'Air pressure' },
    explanation: {
      de: 'Der Druck, den die Luft über uns ausübt, gemessen in Hektopascal (hPa). NASA gibt ihn in Kilopascal an: 100 kPa = 1000 hPa.',
      en: 'The pressure of the air above us, measured in hectopascals (hPa). NASA gives it in kilopascals: 100 kPa = 1000 hPa.',
    },
    reference: {
      de: 'Auf Meereshöhe liegt der mittlere Luftdruck bei 1013,25 hPa; in Deutschland schwankt er dort etwa zwischen 950 und 1060 hPa. Höher gelegene Orte haben niedrigeren Luftdruck.',
      en: 'At sea level the average air pressure is 1013.25 hPa; in Germany it varies there between about 950 and 1060 hPa. Places higher up have lower air pressure.',
    },
    hint: { de: 'Mittel auf Meereshöhe: 1013 hPa (101,3 kPa)', en: 'average at sea level: 1013 hPa (101.3 kPa)' },
    sources: [
      { label: `${DWD}: Standardatmosphäre`, url: 'https://www.dwd.de/DE/service/lexikon/begriffe/S/Standardatmosphaere.html' },
      { label: `${DWD}: Luftdruck`, url: 'https://www.dwd.de/DE/service/lexikon/Functions/glossar.html?lv3=101614&lv2=101518' },
    ],
  },
  {
    id: 'precipitation',
    names: ['niederschlag', 'precipitation'],
    codes: ['PRECTOTCORR'],
    title: { de: 'Niederschlag', en: 'Precipitation' },
    explanation: {
      de: 'Regen, Schnee oder Hagel. 1 mm bedeutet 1 Liter Wasser pro Quadratmeter. NASA gibt Tagessummen an (mm pro Tag).',
      en: 'Rain, snow or hail. 1 mm means 1 litre of water per square metre. NASA gives daily totals (mm per day).',
    },
    reference: {
      de: 'Ab etwa 10 mm in einer Stunde spricht der Deutsche Wetterdienst von starkem Regen.',
      en: 'From about 10 mm in one hour, the German Weather Service speaks of heavy rain.',
    },
    hint: { de: '1 mm = 1 Liter pro m²', en: '1 mm = 1 litre per m²' },
    sources: [
      { label: `${DWD}: Niederschlagshöhe`, url: 'https://www.dwd.de/DE/service/lexikon/begriffe/N/Niederschlagshoehe.html' },
      { label: `${DWD}: Einheitenchaos – Teil 3: Niederschlag`, url: 'https://www.dwd.de/DE/wetter/thema_des_tages/2026/4/28.html' },
    ],
  },
  {
    id: 'wind',
    names: ['windgeschwindigkeit', 'wind speed', 'windspeed'],
    codes: ['WS10M', 'WS50M'],
    title: { de: 'Windgeschwindigkeit', en: 'Wind speed' },
    explanation: {
      de: 'Wie schnell sich die Luft bewegt, in Metern pro Sekunde (m/s); 1 m/s = 3,6 km/h. Der Wetterdienst misst in 10 m Höhe.',
      en: 'How fast the air moves, in metres per second (m/s); 1 m/s = 3.6 km/h. The weather service measures at 10 m height.',
    },
    reference: {
      de: 'Ab 10,8 m/s spricht der Deutsche Wetterdienst von starkem Wind (Windstärke 6), ab 20,8 m/s von Sturm (Windstärke 9).',
      en: 'From 10.8 m/s the German Weather Service speaks of strong wind (force 6), from 20.8 m/s of a gale (force 9).',
    },
    hint: { de: 'starker Wind ab 10,8 m/s, Sturm ab 20,8 m/s (DWD)', en: 'strong wind from 10.8 m/s, gale from 20.8 m/s (DWD)' },
    sources: [{ label: `${DWD}: Beaufort-Skala`, url: 'https://www.dwd.de/DE/service/lexikon/begriffe/B/Beaufort-Skala.html' }],
  },
  {
    id: 'solar',
    names: ['sonneneinstrahlung', 'globalstrahlung', 'solar radiation'],
    codes: ['ALLSKY_SFC_SW_DWN'],
    title: { de: 'Sonneneinstrahlung', en: 'Solar radiation' },
    explanation: {
      de: 'Wie viel Energie von der Sonne auf einen Quadratmeter Boden trifft, in Kilowattstunden pro Quadratmeter (kWh/m²).',
      en: 'How much energy from the sun reaches one square metre of ground, in kilowatt hours per square metre (kWh/m²).',
    },
    reference: {
      // 1086 kWh/m² per year ÷ 365 days ≈ 3 kWh/m² per day (own calculation, hence "rund").
      de: 'In Deutschland sind es im Mittel etwa 1086 kWh/m² pro Jahr (1991–2020), also durchschnittlich rund 3 kWh/m² pro Tag – im Sommer deutlich mehr, im Winter deutlich weniger.',
      en: 'In Germany it is about 1086 kWh/m² per year on average (1991–2020), so roughly 3 kWh/m² per day – much more in summer, much less in winter.',
    },
    hint: { de: 'Deutschland: im Mittel rund 3 kWh/m² pro Tag', en: 'Germany: about 3 kWh/m² per day on average' },
    sources: [
      { label: `${DWD}: Strahlungsjahr 2025`, url: 'https://www.dwd.de/DE/klimaumwelt/aktuelle_meldungen/260123/strahlungslahr_2025.html' },
    ],
  },
  {
    id: 'pm10',
    names: ['pm10', 'pm 10', 'finedust pm10', 'feinstaub pm10'],
    title: { de: 'PM10 – Feinstaub', en: 'PM10 – particulate matter' },
    explanation: {
      de: 'Teilchen in der Luft, die höchstens 10 Mikrometer groß sind. Feinstaub entsteht vor allem durch Verkehr, Heizungen und Kraftwerke. Gemessen wird, wie viel Mikrogramm davon in einem Kubikmeter Luft sind (µg/m³).',
      en: 'Particles in the air that are at most 10 micrometres in size. Particulate matter comes mainly from traffic, heating and power plants. It is measured as micrograms per cubic metre of air (µg/m³).',
    },
    reference: {
      de: 'EU-Grenzwert: Tagesmittel 50 µg/m³, höchstens an 35 Tagen im Jahr darüber; ab 2030: 45 µg/m³, höchstens an 18 Tagen. Die WHO empfiehlt höchstens 45 µg/m³ im Tagesmittel. Grenzwerte gelten für Tagesmittel – einzelne Messwerte können kurz viel höher sein.',
      en: 'EU limit: daily mean 50 µg/m³, exceeded on at most 35 days a year; from 2030: 45 µg/m³, on at most 18 days. The WHO recommends at most 45 µg/m³ as a daily mean. Limits apply to daily means – single readings can briefly be much higher.',
    },
    hint: { de: 'EU-Grenzwert: 50 µg/m³ im Tagesmittel', en: 'EU limit: 50 µg/m³ as a daily mean' },
    sources: PM_SOURCES,
  },
  {
    id: 'pm25',
    names: ['pm2.5', 'pm2,5', 'pm 2.5', 'pm25', 'finedust pm2.5', 'feinstaub pm2.5', 'feinstaub pm2,5'],
    title: { de: 'PM2,5 – sehr feiner Feinstaub', en: 'PM2.5 – fine particulate matter' },
    explanation: {
      de: 'Feinstaub, der höchstens 2,5 Mikrometer groß ist – noch feiner und ein Teil von PM10. Gemessen in µg/m³.',
      en: 'Particulate matter at most 2.5 micrometres in size – even finer, and part of PM10. Measured in µg/m³.',
    },
    reference: {
      de: 'EU-Grenzwert: Jahresmittel 25 µg/m³, ab 2030: 10 µg/m³. Die WHO empfiehlt höchstens 15 µg/m³ im Tagesmittel und 5 µg/m³ im Jahresmittel.',
      en: 'EU limit: annual mean 25 µg/m³, from 2030: 10 µg/m³. The WHO recommends at most 15 µg/m³ as a daily mean and 5 µg/m³ as an annual mean.',
    },
    hint: { de: 'EU-Grenzwert: 25 µg/m³ im Jahresmittel', en: 'EU limit: 25 µg/m³ as an annual mean' },
    sources: PM_SOURCES,
  },
  {
    id: 'pm1',
    names: ['pm1', 'pm 1', 'finedust pm1', 'feinstaub pm1'],
    title: { de: 'PM1 – Feinstaub', en: 'PM1 – particulate matter' },
    explanation: {
      de: 'Feinstaub, der kleiner als 1 Mikrometer ist. Gemessen in µg/m³. Für diese Größe gibt es keinen EU-Grenzwert.',
      en: 'Particulate matter smaller than 1 micrometre. Measured in µg/m³. There is no EU limit for this size.',
    },
    sources: [PM_SOURCES[2]],
  },
  {
    id: 'pm4',
    names: ['pm4', 'pm 4', 'finedust pm4', 'feinstaub pm4'],
    title: { de: 'PM4 – Feinstaub', en: 'PM4 – particulate matter' },
    explanation: {
      de: 'Feinstaub, der kleiner als 4 Mikrometer ist. Gemessen in µg/m³. Für diese Größe gibt es keinen EU-Grenzwert.',
      en: 'Particulate matter smaller than 4 micrometres. Measured in µg/m³. There is no EU limit for this size.',
    },
    sources: [PM_SOURCES[2]],
  },
  {
    id: 'uv-index',
    names: ['uv-index', 'uv index', 'uvi'],
    title: { de: 'UV-Index', en: 'UV index' },
    explanation: {
      de: 'Ein Maß dafür, wie stark die Sonnenstrahlung einen Sonnenbrand verursachen kann.',
      en: 'A measure of how strongly sunlight can cause sunburn.',
    },
    reference: {
      de: '1–2 niedrig, 3–5 mittel, 6–7 hoch, 8–10 sehr hoch, ab 11 extrem. Ab 3 empfiehlt das Bundesamt für Strahlenschutz Sonnenschutz.',
      en: '1–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11 and above extreme. From 3, the Federal Office for Radiation Protection recommends sun protection.',
    },
    hint: { de: 'ab 3 Sonnenschutz empfohlen (BfS)', en: 'sun protection recommended from 3 (BfS)' },
    sources: [
      { label: 'Bundesamt für Strahlenschutz: Was ist der UV-Index?', url: 'https://www.bfs.de/DE/themen/opt/uv/uv-index/einfuehrung/einfuehrung_node.html' },
    ],
  },
  {
    id: 'uv-intensity',
    names: ['uv-intensität', 'uv-intensitaet', 'uv intensität', 'uv intensity'],
    title: { de: 'UV-Intensität', en: 'UV intensity' },
    explanation: {
      de: 'Wie viel ultraviolette Strahlung auf den Sensor trifft, in Mikrowatt pro Quadratzentimeter (µW/cm²). Das ist nicht dasselbe wie der UV-Index aus dem Wetterbericht.',
      en: 'How much ultraviolet radiation reaches the sensor, in microwatts per square centimetre (µW/cm²). This is not the same as the UV index from the weather report.',
    },
    sources: [],
  },
  {
    id: 'illuminance',
    names: ['beleuchtungsstärke', 'beleuchtungsstaerke', 'illuminance'],
    title: { de: 'Beleuchtungsstärke', en: 'Illuminance' },
    explanation: {
      de: 'Wie hell es ist, gemessen in Lux (lx).',
      en: 'How bright it is, measured in lux (lx).',
    },
    sources: [],
  },
  {
    id: 'noise',
    names: ['lautstärke', 'lautstärke (leq 60s)', 'lautstaerke', 'schallpegel', 'noise', 'noise level', 'sound level'],
    title: { de: 'Lautstärke', en: 'Noise level' },
    explanation: {
      de: 'Wie laut es ist, gemessen in Dezibel (dB).',
      en: 'How loud it is, measured in decibels (dB).',
    },
    reference: {
      de: 'An Hauptstraßen liegt der Schallpegel tagsüber oft bei 60–75 dB(A); ab etwa 50 dB(A) stören Geräusche draußen schon Gespräche.',
      en: 'On main roads the sound level during the day is often 60–75 dB(A); from about 50 dB(A), noise outdoors already disturbs conversations.',
    },
    hint: { de: 'Hauptstraße tagsüber: oft 60–75 dB(A)', en: 'main road by day: often 60–75 dB(A)' },
    sources: [
      { label: `${UBA}: Straßenverkehrslärm`, url: 'https://www.umweltbundesamt.de/themen/laerm/verkehrslaerm/strassenverkehrslaerm' },
      {
        label: `${UBA}: Handbuch Lärmaktionspläne (Texte 81/2015)`,
        url: 'https://www.umweltbundesamt.de/system/files/medien/378/publikationen/texte_81_2015_handbuch_laermaktionsplaene.pdf',
      },
    ],
  },
]
