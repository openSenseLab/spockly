# Spike: loading data from APIs (Huwise, openSenseMap, NASA POWER, Natural Earth, OpenStreetMap), own files and web addresses, and "predict first"

Branch `spike/data-loaders`, October 2026. Not merged and not reviewed yet.

This spike tries out the "load data" part of SPOCKLY: six load blocks for
real data sources — points, lines, areas (polygons) and gridded (raster)
data, at local, regional and global scale — plus two blocks for students' own
data (a file from their device, or any web address), a side panel that shows what was
loaded, and a Python view of the blocks. It also adds a first teaching block on top of loaded data: **"schätze …"**,
where students guess a value before they see it, then compare and explain.
Measured quantities that students may not know (relative humidity, PM10, UV
index …) get a short, sourced explanation behind a **"?"** button. A **map**
in the side panel shows where the data comes from and what was measured
there. Along the way it lays down a first version of the shared data format, the plan
that blocks are compiled into, a registry of load operations, and a column
dropdown that later processing blocks can reuse. This document records what
was built, how it works, what we learned about the APIs, and what is still
missing.

## Contents

1. [Try it](#1-try-it)
2. [What was built](#2-what-was-built)
3. [How it works](#3-how-it-works)
4. [What we learned about the APIs](#4-what-we-learned-about-the-apis)
5. [Decisions taken](#5-decisions-taken)
6. [Limitations and known issues](#6-limitations-and-known-issues)
7. [Tests](#7-tests)
8. [Open questions](#8-open-questions)

## 1. Try it

```sh
npm install
npm run dev      # app at http://localhost:5173 (German by default)
npm test         # 206 unit tests (Vitest)
npm run build    # type check + production build
npm run lint
```

- Open the toolbox category **Daten laden** and drag a block onto the canvas:
  - **lade eigene Datei** loads a CSV, JSON or GeoJSON file from the device
    (it stays in the browser).
  - **lade Daten von einer Webadresse** loads CSV, JSON or GeoJSON from any
    address that allows browser access; six examples to pick from.
  - **lade Datensatz** loads a Huwise dataset (default: German federal states).
  - **lade openSenseMap-Daten** loads sensor measurements.
  - **lade NASA-Wetterdaten** loads weather and solar data for a place.
  - **lade NASA-Wetterkarte** loads one value for a grid over Germany or a
    federal state (raster).
  - **lade Weltkarten-Daten** loads countries, cities, lakes or rivers from
    Natural Earth (areas, points, lines).
  - **lade OpenStreetMap-Daten** loads rivers, cycle paths, parks,
    playgrounds, drinking water points or bus stops for Münster or one of six
    other German cities from OpenStreetMap (live, ~40–60 s; a stored copy if
    no server answers).

  With eight load blocks the list is taller than the canvas on many screens;
  scroll it to reach the last ones.
- The file, web address, openSenseMap and NASA blocks open a **setup window**
  when dropped; the gear (⚙) on the block opens it again.
- From **Schätzen & Prüfen**, snap **schätze …** under a load block, pick a
  column, type a guess and click **Auflösen**.
- Point at a **"?"** (setup windows, Daten tab) to read what a measured
  quantity is; a click keeps the explanation open.
- Click a block to see its data in the **Daten** tab and its code in the
  **Python** tab. **Code ausführen** runs that code in the browser with
  Pyodide (the first run downloads pandas, ~10–40 s).
- In the Daten tab, the **Karte** shows points, lines, areas or grid cells; the
  buttons above it pick the measurement they are coloured by. For the NASA
  weather map, **▶ Monate abspielen** steps through the months. Drag the map
  to move it; after a click into it, the mouse wheel zooms.
- **Deutsch | English** switch at the top right; `?lang=en` also works.
- On a phone (or any canvas narrower than 600 px) the toolbox is hidden; the
  **☰ Blöcke** button above the canvas opens it.

The standard Blockly toolbox (Logik, Schleifen, …) is still visible. It should
move behind a developer switch, since students won't need it.

## 2. What was built

### Huwise load block

`lade Datensatz [id] / vom Portal [domain] / höchstens [100 | 1 000 | 10 000] Zeilen`

- Works with any Huwise (formerly Opendatasoft) portal via Explore API v2.1;
  no API key for public datasets.
- Pasting the link of a dataset page (or an API URL) into either field fills
  in both fields.
- Wrong IDs, unreachable portals, private datasets and rate limits become a
  friendly warning on the block (details go to the browser console).
- **Shapes (`geo_shape`) are kept** as a geometry column (see "Shared data
  format"): the 16 federal states of `georef-germany-land` appear as areas on
  the map. `geo_point_2d` becomes a latitude and a longitude column;
  multi-value fields are joined into text.

### openSenseMap load block

The block shows its settings as three lines (measurement, place, period) and a
gear. The setup window lets students choose:

- **Which stations:** an area preset (Münster – Mitte, Münster – whole city,
  Kreis Steinfurt, Kreis Coesfeld, Kreis Warendorf) or a **group tag**, with
  suggestions from all openSenseMap group tags.
- **Outdoor stations only** (on by default).
- **Period:** last 24 hours, 3 days or 7 days.
- **What is measured:** cards listing what the *active* stations in that area
  or group actually measure, with unit and station count. Nothing hard-coded.
  Students can tick **up to 5** measurements (e.g. temperature, humidity and
  pressure) to compare them side by side; each card has a "?" with an
  explanation where one exists.

The block shows up to two measurement names, otherwise "Temperatur + 2
weitere".

Result: one row per station and point in time — time, **one column per chosen
measurement** (number, with unit), station name, station id, latitude,
longitude, placement (outdoor/indoor/mobile). The sensors of a senseBox send
their values with the same timestamp, so they line up in one row; a sensor
that didn't report leaves its cell empty. Column names come from the sensor
titles (`rel. Luftfeuchte` → `rel_luftfeuchte`) and are the same in the app
and in Python.

Units: **air pressure is always converted to hPa.** Most senseBoxes report
hPa, a few Pa (of the "Luftdruck" sensors in Münster-Mitte on 2026-10-21:
123 hPa, 2 Pa). Mixed, one Pa station (≈ 100 000) would distort the mean, the
overview and the map colours. Pa, kPa and mbar are converted (1 hPa = 1 mbar
= 100 Pa = 0.1 kPa), in the app and in the generated Python code, and the
dataset description says so ("Luftdruck: 1 Station misst in Pa; ihre Werte
wurden in hPa umgerechnet."). Any other unit stays as delivered; if stations
still use different units for a measurement, no unit is shown and the
description says so.

Workspaces saved with the earlier one-measurement version still open.

### NASA POWER load block

The block shows place, values and period. The setup window lets students
choose:

- **Place:** Münster, Steinfurt, Coesfeld, Warendorf, Sylt (Westerland) or
  Zugspitze — the last two for comparing coast, inland and mountains — or own
  coordinates.
- **Values:** mean, maximum and minimum temperature, precipitation, relative
  humidity, wind at 10 m and at 50 m, solar radiation, air pressure.
- **Daily or monthly values**, with a from–to date (daily) or from–to year
  (monthly), from 1981 on. Unlike the openSenseMap block, the period is
  fixed, so a saved workspace always loads the same data.

The window checks the settings before anything is sent (start after end,
before 1981, in the future, no value chosen, current year for monthly values)
and explains the problem; "Übernehmen" stays disabled until it is fixed.

Result: one row per day or month — date, one column per value (with unit),
latitude, longitude. Days that NASA hasn't published yet are missing values.
The dataset card says that the values are model and satellite data for a grid
cell, not station measurements, and includes NASA's requested credit line.

### NASA weather map block (raster)

`lade NASA-Wetterkarte / Gebiet: [Deutschland ▾] / Wert: [Temperatur (Mittel) ▾] / Jahr: [2025 ▾]`

Gridded data: one value for every cell of NASA POWER's grid over an area, for
each month of one year. No setup window — three dropdowns.

- **Areas:** Germany, North Rhine-Westphalia, Bavaria. NASA's grid request
  needs 2° to 10° in each direction; all three fit.
- **Values:** the same nine as the point block, **one at a time** (the grid
  request takes a single parameter).
- **Year:** completed years from 1981 (monthly values exist only for those).
- **Only the area, not the rectangle:** the request is a rectangle, but only
  cells that touch the area's outline are kept — 187 of 240 for Germany, 26 of
  30 for NRW. Mean, overview and colours then describe Germany, not the North
  Sea and the neighbours. Cells at the border stay whole, so the resolution
  (about 55 × 45 km) stays visible.
- **Cell size from the data:** temperature, precipitation etc. come on a
  0.5° × 0.625° grid (MERRA-2), solar radiation on 1° × 1° (CERES); the loader
  reads the step from the coordinates instead of assuming one.
- **Elevation:** every cell also has its mean elevation in the model (the
  third coordinate NASA sends), as the column "Höhe der Zelle (Modell)" —
  temperature next to elevation is worth comparing.

Result: one row per cell and month — month, the value (with unit), latitude
and longitude of the cell centre, elevation. The annual value ("month 13") is
left out, fill values become missing values. The map shows the cells as tiles
(see "Map").

The outlines of Germany, NRW and Bavaria are bundled with the app
(`load_nasa_grid/outlines.json`, 25 KB): Huwise `georef-germany-land`,
Germany dissolved from the 16 states, simplified with mapshaper to 4 % of the
points and rounded to 0.001°. The licence (Datenlizenz Deutschland –
Namensnennung 2.0) asks to name the provider, the licence and the dataset, and
to say when data was changed; the credit line does all four ("© GeoBasis-DE /
BKG (2025) … Umrisse vereinfacht (Daten geändert)").

### World map data block (Natural Earth)

`lade Weltkarten-Daten / [Länder der Welt ▾]`

Natural Earth is free map data for the whole world, in the **public domain**
(no credit required; the block shows the suggested "Made with Natural
Earth."). Files of version 5.1.2 are loaded from the project's GitHub
repository via jsDelivr, pinned to that version so a saved workspace always
gets the same data.

| Dataset | File(s) | Shapes | Columns besides name and shape |
|---|---|---|---|
| Länder der Welt | `ne_110m_admin_0_countries` | 177 areas | continent, population and its year, GDP (Mio. US-$) and its year, income group, ISO code |
| Große Städte der Welt | `ne_110m_populated_places` | 243 points | country, population of the urban area, kind (capital …) |
| Seen in Europa | `ne_10m_lakes` + `ne_10m_lakes_europe` | 926 areas | kind (lake, reservoir) |
| Flüsse in Europa | `ne_10m_rivers_europe` | 1 325 lines | kind |

- German names where the file has them (`NAME_DE`, `name_de`), else the
  English one.
- Natural Earth marks unknown values as `-99` (e.g. France's ISO code); they
  become missing values.
- **The country values come from different years** (population 2014–2020, GDP
  2007–2019), so the years are columns of their own — something students can
  notice and discuss.
- **Lakes:** the world file has the large lakes (Bodensee, Müritz), the
  European file the smaller ones (Chiemsee, Steinhuder Meer); neither alone
  shows Germany's lakes. Both are joined and limited to Europe.
- **First view:** lakes and rivers cover Europe, which looks empty (lakes) or
  tangled (rivers) at full extent. The map starts on the Alpine foreland from
  Bodensee to Chiemsee (lakes) and on Germany (rivers); the caption says
  "Ausschnitt: … – herauszoomen, um alles zu sehen".

### OpenStreetMap block

`lade OpenStreetMap-Daten / Was: [Flüsse und Bäche ▾] / Wo: [Münster – Stadtbezirk Mitte ▾]`

Live data from OpenStreetMap, the free world map made by volunteers, through
the public **Overpass API**. Licence ODbL 1.0; the block shows the credit
"© OpenStreetMap-Mitwirkende" and says in the description that what nobody
has mapped is missing.

| Topic | Shapes | OSM tags asked for | Columns besides name, OSM id and shape |
|---|---|---|---|
| Flüsse und Bäche | lines | `waterway` = river, stream, canal | kind |
| Radwege | lines | see below | kind of path (`art`), surface, lit |
| Parks | areas | `leisure=park` (ways only) | – |
| Spielplätze | points | `leisure=playground` (nodes, and the centre of areas) | – |
| Trinkwasserstellen | points | `amenity=drinking_water` | – |
| Bushaltestellen | points | `highway=bus_stop` | shelter, bench |

- **Areas:** Münster-Mitte and all of Münster (the openSenseMap block's
  rectangles), and the whole of **Berlin, Dresden, Freiburg im Breisgau,
  Köln, Leipzig and München**, as bounding rectangles from Nominatim
  (2026-10-27). Hamburg and Bremen are left out: their rectangles reach far
  into the sea (Neuwerk island, Bremerhaven). Rectangles include bits of the
  neighbouring towns, as with openSenseMap. Students can compare cities, e.g.
  7 drinking water points in Münster against 107 in Freiburg.
- **Cycle paths** are mapped in several ways in OpenStreetMap, and in Münster
  most of them are *not* separate `highway=cycleway` ways. Asking only for
  those (the first version) gave 366 scattered pieces in Münster-Mitte that
  looked broken. The query now takes four kinds, and a column `art` says
  which one a way is (first match wins):

  | `art` | Legend | Tags |
  |---|---|---|
  | `fahrradstrasse` | Fahrradstraße | `bicycle_road=yes` |
  | `radweg` | eigener Radweg | `highway=cycleway` |
  | `rad_und_fuss` | Rad- und Fußweg | `highway` = path, footway, track or bridleway with `bicycle=designated` |
  | `an_der_strasse` | Radweg/-streifen an der Straße | a road with `cycleway`, `cycleway:both`, `:right` or `:left` = lane or track |

  Münster-Mitte now has 2 157 lines, all of Münster 5 337, Berlin 29 943. The
  generated Python works out `art` with the same rules.
- **Map symbols** (see Map): a badge with a swing for playgrounds, a drop for
  drinking water, a green "H" for bus stops (like the German stop sign), green
  see-through areas with a tree for parks. Cycle paths are coloured by kind.
- **Servers:** `overpass-api.de`, then `lz4.overpass-api.de`, then
  `z.overpass-api.de`, up to 60 s each. The Daten tab says "Frage
  OpenStreetMap: Server 1 von 3 … (das kann bis zu einer Minute dauern)".
- **Stored copies:** if no server answers, the block loads a copy from
  `public/data/osm/` (all six topics for the two Münster areas, recorded
  2026-10-27, 7.8 MB, unchanged Overpass answers with a README). A notice says
  it is a stored copy from 27.10.2026. **Other cities have no copy** (it would
  make the app much bigger): the block then shows the copy for all of Münster
  and says so — "… für Köln gibt es keine gespeicherte Kopie. Damit du
  weiterarbeiten kannst, siehst du die gespeicherte Kopie für Münster – ganze
  Stadt …". The title then names Münster too.
- The data shows how complete OpenStreetMap is (e.g. only 7 drinking water
  points in all of Münster), which is material for a lesson, but students may
  take gaps for a bug.

### Own file block

`lade eigene Datei ⚙ / Datei: Messung Klasse 9b.csv / Format: CSV (;)`

- **Setup window:** drop a file or **Datei wählen …** (CSV, TSV, TXT, JSON,
  GeoJSON, up to 30 MB). It shows what was read: format, rows, columns and
  the guessed kind of each column (Zeit, Messwert, Kategorie, Breitengrad …);
  for CSV, the detected delimiter can be changed.
- **German spreadsheet exports work:** `;` as delimiter, decimal commas
  (`12,5`, `1.234,5`), dates like `01.10.2026` or `01.10.2026 14:05`, a
  byte order mark at the start.
- **The file stays in the browser.** It is kept in memory only, never
  uploaded, and the window says so. The saved workspace keeps just its name;
  after closing the tab the block says "Die Datei ist nicht mehr da … Wähl sie
  über das Zahnrad noch einmal aus." Files up to 4 MB in total survive the
  reload of a language switch (sessionStorage, gone with the tab).
- **Python:** before **Code ausführen**, the app writes the picked files into
  Pyodide's working folder under a safe name, so the code simply reads
  `pd.read_csv("Messung_Klasse_9b.csv", sep=";", decimal=",")`.

### Web address block

`lade Daten von einer Webadresse ⚙ / Adresse: earthquake.usgs.gov/…/2.5_week.geojson / Format: GeoJSON`

- **Setup window:** pick an example or type an address, then **Prüfen**. The
  address is loaded once and the window shows what was read, as for files.
  **Übernehmen** is only possible after a successful check: the block keeps
  how the answer was read (format, delimiter, where the records are), so the
  app and the Python code read it the same way. A link opens the address in
  the browser; another points to geojson.xyz for more map data to try.
- **Examples** (all checked to allow browser requests, 2026-10-28):

  | Example | Source | Format | What |
  |---|---|---|---|
  | Erdbeben weltweit, letzte 7 Tage | USGS | GeoJSON | quakes from magnitude 2.5 (365 on the day) |
  | Wasserstand in Münster, letzte 3 Tage | PEGELONLINE | JSON | one value per minute, gauge MÜNSTER OW (Dortmund-Ems-Kanal), ~4 300 rows |
  | Pegel an Bundeswasserstraßen | PEGELONLINE | JSON | 786 gauges with position, waterway, kilometre |
  | Wetter in Münster, 20.–27. Oktober 2026 | Bright Sky (DWD data) | JSON | hourly values |
  | Flüsse der Welt | Natural Earth 3.3.0 via geojson.xyz | GeoJSON | 1 618 river lines |
  | CO₂-Ausstoß pro Kopf, je Land und Jahr | Our World in Data | CSV | 26 509 rows |

- **Only https addresses** (the app runs on https, browsers block `http://`
  from there).
- **Messages** for what goes wrong: the address can't be loaded (wrong,
  offline, or the server doesn't allow browser requests — CORS — and the
  message says that then only a server of our own helps); 404; login or key
  needed; a web page instead of data; broken JSON; no table data; larger
  than 30 MB (refused before downloading when the server says the size).
- Every dataset from a web address carries the note "Die Lizenz dieser Daten
  kennt SPOCKLY nicht. Schau bei der Quelle nach …"; the examples link to
  their source's page.

### Reading data of unknown shape (both blocks)

`core/tabular.ts` turns text into a `DataTable`:

- **Format:** JSON if the content type or file name says so or the text starts
  with `{` or `[`, CSV otherwise. CSV delimiter: the one of `;`, `,`, tab that
  splits the first lines into the same, largest number of fields. Quotes,
  doubled quotes and line breaks inside quotes are handled; empty column names
  become `spalte_3`, repeated ones `name_2`.
- **Records in JSON:** the features of GeoJSON (properties plus a `geometry`
  column); a list of objects; or the longest list of objects inside an object
  (Bright Sky: `weather`, not `sources`). Nested objects become columns
  joined with `_` (`water_longname`), like pandas' `json_normalize`; lists of
  plain values become text ("a, b").
- **Kind of each column, guessed from its values:**
  - geometries → shape column; `true`/`false` → yes/no;
  - numbers (decimal point, or decimal comma if any value has one) →
    measurement, or latitude/longitude by name (`lat`, `breite`, `*_lon` …)
    and range, or identifier by name (`id`, `code`, `nr`, `plz`, `number` …);
    ids written as text stay text (`"27800040"`), and values with a leading
    zero (postcodes) stay text;
  - whole milliseconds since 1970 in a column named like a time (USGS
    `time`) → dates; `year`/`jahr` with whole numbers → years;
  - ISO dates and German dates → dates (stored as ISO);
  - other text → category if values repeat (≤ 20 different), else text.
  - "NA", "NaN", "null", "-" count as missing in number and date columns only
    ("NA" is also Namibia).
- **At most 50 000 rows** (more than the 10 000 of other blocks: the CO₂ example
  has 26 509); a note says how many were left out.
- The Python code reads the text the same way: `pd.read_csv(…, sep=…,
  decimal=",")` for `;` files, `pd.json_normalize(daten["weather"], sep="_")`
  for JSON, properties plus geometry for GeoJSON.

### Predict-first block ("Schätzen & Prüfen")

```
schätze den [höchsten Wert ▾] von [Temperatur (Mittel) ▾]
ist ungefähr [ 30 ] °C
Zur Orientierung: Sommertag ab 25 °C, heißer Tag ab 30 °C (DWD)
( Auflösen )
→ after revealing:
( Verbergen )  Tatsächlich: 25,96 °C · 4,04 °C zu hoch
Warum? [ Das sind Tagesmittel für ein großes Gitterfeld … ]
```

The idea: students commit to an expectation before they see the data, then
compare it with the real value and explain the difference. A "wrong" guess is
often the more useful one, because it shows a gap between intuition and data
or reveals how the data was made (daily mean vs. hottest hour, model vs.
station).

- Snaps anywhere below a load block (later also below filter or group blocks)
  and doesn't change the data.
- Guesses the **highest value, lowest value or mean** of a **measurement**
  column. Coordinates, identifiers and codes are numbers too, but are not
  offered — their maximum or mean isn't a meaningful question. Data without
  measurements (e.g. the German federal states) shows "(keine Messwerte)" and a
  friendly warning on the block. Until a column is picked, the dropdown says
  "– Spalte wählen –".
- **"Zur Orientierung"** line: for quantities with a sourced reference value
  in the glossary (see below), the block shows one short line to guess
  against, e.g. "1 mm = 1 Liter pro m²". Without one, the line is hidden.
- While the guess is open, that column shows **"🔒 Erst schätzen!"** in the
  Daten tab (overview and preview rows). Other columns stay visible.
- **Auflösen** shows the real value and the gap ("4,04 °C zu hoch"); within
  5 % it says "fast genau getroffen!". **Verbergen** hides it again for another
  try. Choosing a different measure or column hides it automatically, because
  it is a new question. All of this can be undone with Ctrl+Z.
- **New data above the guess is a new question too.** When the load block's
  settings change (another measurement, area, dataset …), the answer is hidden
  at once. When the new data has arrived and the guessed column is no longer
  in it, the guess starts over (column, number and "Warum?" are cleared). If
  the column is still there — e.g. only the period changed — the guess stays.
- After revealing, a **"Warum?"** line appears for a one-sentence explanation.
  It is optional, saved with the workspace, kept when hiding again, and stored
  in the plan step (`reason`) so a later data-story feature can reuse it.
- Python shows the guess, the real value and the explanation as a comment:
  `print("Vermutung:", vermutung, "| tatsächlich:", wetter_muenster["T2M"].max())`.

### Explanations of measured quantities ("?")

Students can't make a sensible guess about "PM2.5" or "rel. Luftfeuchte" if
they don't know what it is. A small **"?"** button next to a measured quantity
opens a short box with:

- what the quantity is, in school-level words (DE and EN);
- **"Zur Orientierung:"** reference values to compare with (e.g. EU limits and
  WHO guideline values for particulate matter, DWD definitions of "summer day"
  and wind strengths);
- the **sources**, as links.

Where it appears: on the measurement cards in both setup windows, and next to
the column name in the Daten tab. The guess block shows the short version
("Zur Orientierung: …").

How it behaves: with a mouse it opens after a short pause when pointing at it
and closes when the pointer leaves; a click (or a tap on touch screens) keeps
it open until clicking again, pressing Escape or clicking elsewhere. It works
with the keyboard (Tab, Enter). Clicking a card itself still ticks the card;
only the "?" opens the explanation.

Content (`src/glossary/entries.ts`): 14 quantities — temperature, relative
humidity, air pressure, precipitation, wind speed, solar radiation, PM10,
PM2.5, PM1, PM4, UV index, UV intensity, illuminance, noise level. **Every
fact comes from a listed source** (DWD, Umweltbundesamt, EU air quality
standards and Directive (EU) 2024/2881, WHO Air Quality Guidelines 2021,
Bundesamt für Strahlenschutz), checked on 2026-10-20. Where no reliable
source was found, the entry has an explanation but no reference value (PM1,
PM4, UV intensity, illuminance). The texts have **not been reviewed by a
teacher yet**.

Matching (`src/glossary/index.ts`): an entry is found by an exact column code
(NASA POWER: `T2M`, `PRECTOTCORR` …) or by a known name, compared as a whole
after lower-casing (`rel. Luftfeuchte`, `relative_humidity`, `Finedust PM10`
…). Whole-name matching is deliberate: "Bodentemperatur" or "Windböen" are
different quantities and get no (wrong) explanation. Spellings found on
openSenseMap around Münster are included; others simply show no "?".

### Column dropdown (reusable)

`field_column_dropdown` lists the columns of the data above a block, filtered
by kind (here: measurements only). Unlike Blockly's standard dropdown, it keeps
a chosen column that isn't in the list at the moment — e.g. while a saved
workspace is still loading its data — instead of silently dropping it, and
updates its label once the data arrives. Filter and group-by blocks will need
the same field.

### Setup window (shared)

All blocks with a setup window (openSenseMap, NASA POWER, own file, web
address) use the same mechanism: the window opens
by itself once, when the block is dropped from the toolbox (not when the drag
starts), and later through the gear. Changing settings is a normal Blockly
change, so it can be undone with Ctrl+Z.

### Daten tab (side panel)

Shows the selected strand, or the one edited last:

- dataset card: title, source, credit/licence, last update, description,
  keywords, "16 Zeilen geladen" or "100 von 12 500 Zeilen geladen" with a hint
  when only part was loaded;
- one row per column: kind of data (Messwert, Kategorie, Zeit, Breitengrad,
  Kennung, Form …), how much is filled in (missing values highlighted), and an
  overview (range and mean, time span, most frequent values, or for shapes
  "16 Flächen · 71.599 Eckpunkte insgesamt");
- a **map** for data with coordinates or shapes (see below);
- the first 20 rows, missing values shown as "–", shapes as e.g. "Fläche
  (22 Eckpunkte)" instead of their coordinates. When they are wider than the
  panel, a hint says "Seitlich wischen oder scrollen, um alle Spalten zu sehen →"
  (touch screens show no scrollbars, so nothing else hints at more columns).
  **The rows scroll in one box of at most 420 px**, up/down and sideways, with
  the column names staying on top. Before, the table was as tall as its 20
  rows, so its sideways scrollbar only appeared once scrolled to the very end;
  a first fix that limited the height of Radix's nested scroll layers showed
  two vertical scrollbars, and the table's border then ran through the middle
  of a wide table. Now Radix's own scroll area is switched off for this table
  and its box is as wide as its columns;
- progress while loading ("Lade Zeilen: 300 von 1 000", "Lade Stationen: 5 von 9").

When the panel is narrower than 520 px (a phone, or the side panel next to the
canvas on a small laptop), the column table turns into one block per column:
name and kind on top, then "Ausgefüllt" with its bar, then the overview. This
follows the panel's own width (CSS container query), not the screen's.

### Map (Daten tab)

Shown for every dataset with a latitude and a longitude column or a shape
column, between the dataset card and the column table. Built with **Leaflet
1.9.4** and **OpenStreetMap tiles** (no API key).

The map works in one of three ways, depending on the data:

| Data | Drawn as | Example |
|---|---|---|
| latitude/longitude columns | one marker per place | openSenseMap stations, NASA point, Huwise points |
| a geometry column | the rows' own points, lines and areas | federal states, countries, rivers, lakes |
| `meta.grid` (raster) | every cell as a coloured tile | NASA weather map |

Everything below (colours, legend, tooltip, hidden guesses) works the same in
all three; the points-only parts are marked.

- **One marker per place** (points): rows with the same coordinates become one marker,
  so a station with 1 436 measurements is one box, not 1 436. At most 5 000
  places are drawn; the caption says how many were left out and how many rows
  had no coordinates.
- **Marker by kind of place** (points): a **box** for a senseBox station
  (openSenseMap), a **satellite** for a model/satellite grid cell (NASA POWER),
  a plain dot otherwise (Huwise; it can have thousands of places, so the dots
  are drawn on one canvas). The caption explains the icon ("Kästchen =
  senseBox-Station", "Satellit = Wert für ein Gitterfeld von rund 50 km, keine
  Messstation"). The icons are drawn for SPOCKLY, not taken from the senseBox
  or NASA logos.
- **Colour = a real measurement.** The buttons above the map list every
  measurement column ("Temperatur | rel. Luftfeuchte | Luftdruck"); the chosen
  one colours the markers. **"Wert je Ort"** picks how a place's many values
  become one: Mittelwert, Höchstwert, Tiefstwert or Neuester Wert. Switching
  visibly recolours the map, which makes "aggregation" something students can
  see.
- **Colours:** five steps of one blue, light = low, dark = high (checked with
  a palette validator for colour-blind separation and contrast). Grey = no
  value at this place. Class limits are equal steps between the lowest and
  highest value that is **not an outlier by the boxplot rule** (beyond 1.5 ×
  the interquartile range). Without that, one station reporting −144 °C would
  put all other stations into the same colour; the outlier goes into the
  first or last class instead.
- **Legend** below the map: "Temperatur: Mittelwert je Ort (°C)" with the
  ranges ("unter 11,9 · 11,9 bis 13,8 · … · ab 17,6") and a "?" with the
  explanation of that measurement.
- **Tooltip** on hover (or tap): place name, kind of place, the chosen
  statistic for **every** measurement (the coloured one first, in bold), and
  for the coloured one its range and number of values.
- **"Zahlen zeigen"** writes the value next to each marker or on each grid
  cell (off by default; numbers overlap where stations are close together).
  Not offered for lines and areas, which have no single spot for a number.
- **The area asked for** (points: openSenseMap area, Huwise dataset extent) is
  drawn as a dashed rectangle.
- **Lines and areas:** areas are filled, with a thin dark edge; lines without a
  value to show (rivers) are thin and dark, so a dense network stays
  readable. Shapes are drawn on one canvas. The edges used to be white, which
  disappears on the light-blue sea of the tiles: Natural Earth's world lakes
  loaded from a web address looked like an empty map.
- **Areas too small to see** at the current zoom (under 3 px) also get a small
  dot in their colour, updated on every zoom; the caption says "360 kleine
  Flächen als Punkte – heranzoomen für die Umrisse". World lakes at world
  zoom: 360 of 398 are dots; on the country map, 36 of 177 (small states and
  islands).
- **Shapes by kind (OpenStreetMap, new):** data without measurements can say
  how it is drawn (`meta.mapStyle`):
  - **a symbol** for points — a round badge with a swing (playgrounds), a drop
    (drinking water) or an "H" (bus stops) — and a legend entry with the same
    badge. Up to 150 points get symbols at any zoom; with more, zoomed out,
    they are small dots in the symbol's colour and the caption says "näher
    heranzoomen, um die Symbole zu sehen"; from zoom 14 (street level) the
    symbols appear. Above 2 500 points it stays dots (thousands of icons make
    the map sluggish). 1 500 bus stop icons at city zoom covered the whole
    city, hence the switch.
  - **an area colour**, see-through so streets still show (parks in green),
    with a tree badge in the middle of each park at street level only;
    zoomed out the trees hid the parks.
  - **colours by category** for lines (cycle paths by `art`): the first four
    categorical colours of the dataviz palette (blue, orange, aqua, yellow,
    checked with its validator; aqua and yellow are below 3:1 contrast on the
    light background, so the legend and tooltip name the kind). Lines are thin
    zoomed out and thicker at street level. Ways matching no kind are grey,
    "andere / nicht angegeben".
- **Tooltips stay inside the map (new):** the map clips everything at its
  frame, so a tooltip near an edge or corner was cut off. A tooltip that would
  cross the frame now goes to the other side of its point, or is moved just
  inside; its little arrow is hidden then, as it would point to the wrong
  spot. Checked by hovering ~1 300 spots over 1 524 bus stops: 306 tooltips,
  20 moved, none cut off.
- **Grid (NASA weather map):**
  - the **outline** of the area as a dark line above the cells;
  - **places for orientation** as black dots with names — big cities from
    Natural Earth's city file, plus the places of the NASA point block
    (Münster, Sylt, Zugspitze) so both blocks can be compared; a cell's tooltip
    says "In dieser Zelle: Münster";
  - **months:** a slider, **▶ Monate abspielen** (one month per second, stops at
    the last) and **ganzes Jahr** (the per-cell summary as before). All months
    share one colour scale, computed from all monthly values: otherwise each
    month would be rescaled to its own spread and the seasons wouldn't show.
    The legend says "Temperatur (Mittel) im Juli 2025".
- **Legend title:** "Mittelwert je Ort" only where a place has several values;
  a country or a city has one, and the title is just the measurement.
- **Large numbers** in legend and labels are rounded to three significant
  digits (13 925 228 → 13 900 000); the tooltip keeps the full value.
- **Zoom in quarter steps**, so an area fills the map instead of jumping to the
  next whole zoom level.
- **Guesses stay hidden:** a column with an open guess is left out of the
  buttons, colours, labels and tooltips; a note says it appears after
  revealing. The map code only reads the columns it is given, so a hidden
  value can't reach it by accident.
- **Moving the map:** drag it with the mouse. The mouse wheel scrolls the
  panel, until the student clicks into the map: then it zooms the map, until
  the pointer leaves it. The caption says so ("Karte mit der Maus ziehen; nach
  einem Klick in die Karte zoomt das Mausrad"); +/− zoom as well. Leaflet's
  layers are kept inside the map, so dialogs and popovers stay on top.

Station names are typed in by openSenseMap users, so tooltips are built as
plain text (no HTML).

### Python tab

- Shows the code for the **selected data block** only (or the one edited
  last). Selecting a block outside any strand shows the code of the whole
  canvas.
- Every data block has **its own variable name**, the same in every view:
  `georef_germany_land`, `temperatur_muenster_mitte`, `wetter_muenster`; a
  second identical block gets `…_2`. Numbers follow the order blocks were
  added, so moving blocks doesn't swap names.
- The caption says which dataset the code belongs to and what it is called.
- The generated code runs in Pyodide (downloads go through the browser with
  `pyodide.http.open_url`).

### Other changes

- **German and English** for all visible text, including the standard toolbox
  categories. The language choice is remembered; switching reloads the page and
  restores the blocks, because Blockly fixes block text when a block is created.
- **Dates are shown at their own precision**: "01.01.2025", "Jan. 2025",
  "2025".
- **Pyodide fixes** (existing bugs): Vite pre-bundled `pyodide` on the first run
  and reloaded the page, killing the worker ("The Python worker stopped
  unexpectedly"); and after a crash, every later run hung on "Preparing the
  Python runtime…" because the dead worker was reused.
- **One retry for failed requests** (all loaders): a network error, a server
  error (HTTP 5xx) or a response that is cut off in the middle is tried once
  more after 1 s. If that fails too, the block says "Der Datendienst antwortet
  gerade nicht richtig. Warte kurz und versuch es noch einmal." Errors a retry
  can't fix (404, 422, 429) are reported straight away, as before. Before
  this, a cut-off response ended the whole load with a raw error.
- Popovers and dialogs use a solid background (`panelBackground="solid"`), so
  text behind them doesn't show through.
- **Daten tab on small screens:** the card's border scrolled away with the
  content (Radix draws it as a separate layer); a scroll area inside the card
  fixes it.
- **Small screens in general** (checked at 390, 768 and 1100 px):
  - Below 1080 px the layout has one column. That column used to grow to fit
    its widest content (the rows table, the Python code), so on a phone the
    whole side panel was ~900 px wide and cut off. It now keeps to the screen
    width (`minmax(0, 1fr)`, `min-width: 0`).
  - In the one-column layout the Python code box grows with the code (up to
    70 % of the screen height) instead of showing four lines; on phones long
    code lines wrap.
  - **Toolbox behind a button:** when the canvas is narrower than 600 px, the
    toolbox is hidden and **☰ Blöcke** opens it over the canvas. It closes by
    itself once a block has been dragged onto the canvas (the setup window
    still opens). Wider canvases keep the normal toolbox. Uses Blockly's own
    `Toolbox.setVisible`, so dragging and undo are unaffected.
- **Block dropdown menus no longer cut off:** Blockly 13 draws its dropdown
  menus inside the workspace box, and the box and its card hid anything that
  stuck out — a menu opening upwards near the top, or the list of eight cities
  on a phone, where the box is ~350 px wide. The box and card no longer clip
  (the rounded corners come from the canvas and toolbox themselves), and menus
  pick their side (up/down) by the visible screen instead of the workspace.
  Blockly has no option for the latter and resets the limit every time a menu
  opens; the only hook is `Blockly.DropDownDiv.TEST_ONLY.getBoundsInfo`, which
  is replaced (guarded: if an update removes it, menus fall back to the
  workspace box). Moving the menus out of the workspace with
  `Blockly.common.setParentContainer` was tried and dropped: in Blockly 13 a
  menu there closes the moment it opens.
- **`getText`** next to `getJson` in `core/http.ts`: any text with its content
  type, the same error codes and one retry, and a size limit.
- **Python runs get the picked files:** the run message to the Python worker
  carries the files, which are written into Pyodide's file system first.
- Load blocks are drawn as hat blocks (Zelos renderer, theme with
  `hat: 'cap'`); the toolbox got some top spacing.
- Vitest added (`npm test`).

## 3. How it works

### Data flow

```
Blockly change (non-UI event)
  └─ BlocklyWorkspace.tsx
       ├─ core/plan.ts        blocks → Plan: one strand per load (hat) block,
       │                      disabled blocks marked, "needs data" warnings
       ├─ store.loadSteps     first step of each strand
       ├─ store.hiddenColumns columns with an open guess, per strand
       ├─ Python per strand   generators + unique variable names
       ├─ guess blocks        result text, unit, hint, column list (from loaded data);
       │                      reset if the guessed column is gone after new data
       └─ warnings on blocks  (plan problems, load errors, guess problems)

useLoadRunner (hooks/)        for each load step whose params changed:
  └─ waits 600 ms, cancels outdated requests, caches by (op, params)
  └─ loadOperations[op](params, ctx)   blocks/index.ts
        ├─ load_huwise     → DataTable
        ├─ load_osem       → DataTable
        ├─ load_nasa_power → DataTable
        ├─ load_nasa_grid  → DataTable (one row per cell and month)
        ├─ load_natural_earth → DataTable (one row per shape)
        ├─ load_osm        → DataTable (one row per OSM element; stored copy if no server answers)
        ├─ load_url        → DataTable (text read by core/tabular)
        └─ load_file       → DataTable (file from the in-memory store, read by core/tabular)
  └─ store.loads[blockId] = loading | ready | error

DatasetPanel / Python tab     show the strand from selectShownStrandId()
store.loads changes           guess blocks refresh (result, column labels)
```

Blocks below a load block get its data through `setTableProvider` (registered
in `BlocklyWorkspace.tsx`): the root block of their stack is the load block,
and its result in `store.loads` is the table they work on.

Resetting a guess after new data: when a load block's settings change
(its saved state, or the `DATASET`, `DOMAIN`, `MAX_ROWS`, `AREA`, `PARAMETER`,
`YEAR`, `TOPIC` fields), the guess
blocks below it are hidden and marked `awaitingNewData`. `refreshPredictions`
waits until the load result in `store.loads` belongs to the *new* settings
(same `key` as the step), then clears the guess only if its column is missing.
Waiting matters: right after the change, the old data is still in the store.

Loading runs on the main thread for now (fetch is async; mapping is cheap). A
cached executor in a Web Worker is the planned replacement for `useLoadRunner`.

### Shared data format

`src/core/types.ts` defines what every loader returns and every later step
will consume: `DataTable` (`meta`, `columns`, `rows`), `ColumnMeta` (data type,
semantic type such as measurement/category/timestamp/latitude, unit),
`DatasetMeta` (title, source, licence, extent …), plus `Plan`/`Strand`/
`PlanStep`, `OperationDef`, `Warning` and `ExecContext`. Points to know:

- `DatasetMeta.totalRecords` is the number of records at the source; it can
  exceed the rows actually loaded.
- Values of `date` columns are **ISO 8601 strings** at their natural precision
  (`2025-01-01`, `2025-01`, or a full timestamp), so tables stay plain JSON —
  see open questions.
- `Warning.code` and `LoadError.code` are i18n keys, so the core stays
  language-free; the UI translates them.
- `toCode(params, { output })` takes the variable name for generated code.
- `ExecContext.onProgress(done, total, unit)` says whether rows or stations are
  being counted.
- `DatasetMeta.placeKind` (optional) says what a place in the rows stands for:
  `'sensor-station'` (openSenseMap) or `'grid-cell'` (NASA POWER). The map
  picks its marker from it rather than guessing from the source name. Loaders
  that don't set it get plain dots.
- **Shapes (new):** a column with `dataType: 'geometry'` and
  `semanticType: 'geometry'` holds one **GeoJSON geometry** per row (RFC 7946,
  coordinates `[longitude, latitude]`): Point, MultiPoint, LineString,
  MultiLineString, Polygon or MultiPolygon (type `Geometry`). Plain objects,
  so tables stay JSON. Huwise sends shapes wrapped in a Feature; the loader
  keeps only the geometry. Helpers in `core/geometry.ts`: recognise a
  geometry, point/line/area, vertex count, bounding box, point-in-area.
- **Raster (new):** `DatasetMeta.grid = { cellSize: [lon, lat] }` means every
  row is one cell of a regular grid and its latitude/longitude columns give
  the cell centre (with a time column, one row per cell and time). Rows stay
  rows, so summary, colours and guesses work unchanged; a real raster image
  type (e.g. GeoTIFF) would be a separate step.
- **For the map (new, optional):** `outline` (geometry + name of the area the
  data is about), `landmarks` (places for orientation, not part of the data)
  and `initialView` (what the map shows first when the data covers far more).
- **`mapStyle` (new, optional):** how the map draws shapes that no
  measurement colours: `symbol` (`playground`, `drinking-water`,
  `bus-stop`, `tree`), `color`, `label` for the legend, or
  `categories` (a column plus value → label and colour, in legend order).
  Used by the OpenStreetMap block; a measurement, once there is one, takes
  over the colours as before.
- `ExecContext.onProgress` units: `'rows' | 'stations' | 'servers'`.

### Where things are

| Path | What |
|---|---|
| `src/core/types.ts` | data format, plan and operation types |
| `src/core/plan.ts` | workspace → plan (framework-free, tested with fake blocks) |
| `src/core/summary.ts` | column summary for the Daten tab (any `DataTable`) |
| `src/core/names.ts` | text → valid, unique Python variable names |
| `src/core/geo.ts` | rows → places or shapes for the map, values per place (mean, min, max, newest), colour classes + tests |
| `src/core/geometry.ts` | GeoJSON helpers: point/line/area, vertices, bounding box, point in area, cell touches area + tests |
| `src/core/http.ts` | `getJson` and `getText` (HTTP/network errors → `LoadError` with i18n code, one retry for temporary problems, size limit), `mapLimit` |
| `src/core/tabular.ts` | CSV reading, records in JSON/GeoJSON, guessing column kinds, `toTable`, the matching Python reader + tests |
| `src/blocks/load_huwise/` | block definition, plan step, API + mapping, Python, tests, fixtures |
| `src/blocks/load_osem/` | same for openSenseMap, plus `presets.ts` (areas, periods) |
| `src/blocks/load_nasa_power/` | same for NASA POWER, plus `presets.ts` (places, variables) |
| `src/blocks/load_nasa_grid/` | NASA weather map: grid request, outline filter, `presets.ts` (areas, places for orientation), `outlines.json` |
| `src/blocks/load_natural_earth/` | Natural Earth: `presets.ts` (datasets, files, columns, first view), mapping, Python |
| `src/blocks/load_osm/` | OpenStreetMap: `presets.ts` (topics with queries, columns, kinds and map symbols; cities; servers; snapshot date), mapping, servers in turn + stored copy, Python, tests, fixture |
| `src/blocks/load_url/` | web address block: `presets.ts` (examples), mapping (checks, table, licence note), operation (download, error messages, Python), tests and recorded answers |
| `src/blocks/load_file/` | own file block: `store.ts` (files in memory, names for Python, carried across a language switch), mapping, operation, tests |
| `src/components/UrlSetupForm.tsx`, `FileSetupForm.tsx`, `ReadPreview.tsx` | the two setup windows and their shared "what was read" preview |
| `public/data/osm/` | stored OpenStreetMap copies for the two Münster areas, with a README (source, date, licence, how to update) |
| `src/blocks/predict/` | guess block: definition (button, "Warum?" line), plan step, Python, `compare.ts` (real value, gap) + tests |
| `src/blocks/fields/columnDropdown.ts` | column dropdown that keeps its value while data is loading; `setTableProvider` |
| `src/blocks/setup.ts` | shared parts of blocks with a setup window (gear, open once, undoable changes) |
| `src/blocks/index.ts` | registers blocks; `loadOperations`, `pythonBaseNames` |
| `src/blocks/pythonNames.ts` | variable name per block, shared by all code views |
| `src/blocks/theme.ts` | Zelos theme with hat-shaped load blocks |
| `src/hooks/useLoadRunner.ts` | runs load steps (debounce, cancel, cache) |
| `src/components/DatasetPanel.tsx` | Daten tab |
| `src/components/MapPreview.tsx` | the map: points, shapes or grid cells; icons and symbols, colours by kind, measurement buttons, month slider, outline, places, legend, tooltips that stay inside |
| `src/components/BlocklyWorkspace.tsx` | canvas, toolbox (incl. the "Blöcke" button on small screens), plan and code updates |
| `src/components/BlockSetupDialog.tsx` | setup window; picks the form by block type |
| `src/components/OsemSetupForm.tsx`, `NasaSetupForm.tsx` | the two setup forms |
| `src/glossary/` | explanations of measured quantities with sources (`entries.ts`), lookup by code or name (`index.ts`) + tests |
| `src/components/GlossaryInfo.tsx` | the "?" button and its explanation box |
| `src/components/LanguageSwitch.tsx`, `blockly/carryWorkspace.ts` | language switch, keeping blocks across the reload |
| `src/i18n/` | DE/EN dictionaries (`en` must have the same keys as `de`), `t()`, number/date formatting |

### Adding another load block

1. New folder `src/blocks/<name>/` with `definition.ts` (Blockly JSON, `style:
   'load_blocks'`, no `previousStatement`), `generator.ts` (block → `PlanStep`),
   `operation.ts` (fetch + map to `DataTable`), `python.ts`, tests and recorded
   fixtures.
2. In `src/blocks/index.ts`: import the definition, add the operation to
   `loadOperations` and a name rule to `pythonBaseNames`.
3. In `BlocklyWorkspace.tsx`: add the block to the toolbox, `generators` and
   `hatTypes`.
4. Add DE and EN strings.
5. If the rows have coordinates, mark the columns as `latitude` and
   `longitude` (the map appears by itself), and set `meta.placeKind` if the
   places are stations or grid cells. Shapes go into a `geometry` column;
   gridded data sets `meta.grid`.
6. If it needs a setup window: use `gearField`, `attachGear` and
   `fireStateChange` from `src/blocks/setup.ts`, give the block a
   `setupConfigured` flag, and add a form to `BlockSetupDialog.tsx`.

### openSenseMap: how a load runs

1. `GET /boxes?bbox=…|grouptag=…[&exposure=outdoor]` (cached 5 minutes, shared
   with the setup window).
2. Keep boxes whose **current location** is inside the area, that measured
   since the start of the period (`lastMeasurementAt`), and have a sensor whose
   title equals one of the chosen measurements. At most 50, most recently
   active first.
3. Per sensor: `GET /boxes/:box/data/:sensor?from-date&to-date&format=json`.
   4 stations at a time; a station's sensors one after another. A full page
   (10 000 values) triggers another request that ends just before its oldest
   value.
4. Map everything into one `DataTable`: rows are keyed by station and
   timestamp, one column per measurement.

So the number of requests grows with the measurements: for all of Münster,
one day, temperature alone needs 20 requests; temperature + humidity +
pressure 47.

### NASA POWER: how a load runs

1. Check the settings locally (place, values, dates); stop with a friendly
   message if something is off.
2. One request: `GET /api/temporal/{daily|monthly}/point?parameters=…&community=RE&longitude&latitude&start&end&format=JSON`.
3. Turn the date keys (`20250101`, `202501`) into ISO dates, drop the annual
   "month 13", and turn the fill value (`-999`) into missing values.

### NASA weather map: how a load runs

1. Check the settings (area, value, completed year from 1981).
2. One request: `GET /api/temporal/monthly/regional?parameters=<one>&community=RE&latitude-min&latitude-max&longitude-min&longitude-max&start=<year>&end=<year>&format=JSON`
   over the rectangle around the area.
3. Read the cell size from the cell centres, keep the cells whose rectangle
   touches the area's outline (a corner or the centre inside the area, or an
   outline vertex inside the cell), and make one row per cell and month.

### Natural Earth: how a load runs

1. Fetch the dataset's file(s) from jsDelivr (pinned to v5.1.2), in parallel.
2. One row per feature: the curated columns (first non-empty source property,
   `-99` = missing) and the geometry. Shapes outside `within` (lakes: Europe)
   are left out.
3. Extent from all shapes; the first view from the dataset's preset.

### OpenStreetMap: how a load runs

1. Build the Overpass query for the topic and the area's rectangle
   (`[out:json][timeout:60]`, `out geom` for lines and areas, `out center`
   for playgrounds).
2. `GET <server>/api/interpreter?data=<query>` on the three servers in turn,
   each for at most 60 s (`AbortSignal.timeout`, combined with the block's own
   cancel signal). A cancelled load stops instead of asking the next server.
3. If none answered: `GET /data/osm/<topic>-<area>.json` (the Münster copy for
   other cities), marked as a stored copy.
4. One row per element: name, the topic's tag columns, the derived `art` for
   cycle paths, OSM id (`way/123`) and the shape (nodes and centres → points;
   ways → lines, or areas for closed ways of an area topic). `updated` is the
   OSM data timestamp from the answer.

### Web address and own file: how a load runs

1. Web address: `getText` (30 MB limit). Own file: the text from the in-memory
   store, or "pick the file again" if it is gone.
2. `readData` with the settings saved in the setup window (format, delimiter,
   where the records are); if they no longer fit, it works them out again.
3. `guessTable`: kind of each column, values converted (numbers, ISO dates,
   geometries), at most 50 000 rows; `toTable` adds the notes.

## 4. What we learned about the APIs

All sources used allow direct browser requests (`Access-Control-Allow-Origin: *`),
so **no proxy is needed**.

### Huwise (Explore API v2.1)

- `records`: at most **100 records per request**, and `offset + limit ≤ 10 000`.
  The block pages in steps of 100 and stops at 10 000.
- The CSV export (`exports/csv`) uses `;` as delimiter; used by the Python code.
- Field metadata (type, label, description, facet annotation) is good enough to
  guess semantic types; integer codes still look like numbers.
- `geo_shape` values arrive as a GeoJSON **Feature** (`{type, geometry,
  properties}`); Bremen, for example, is a MultiPolygon of 4 parts (Bremen and
  Bremerhaven).
- The public catalogue (hub.huwise.com, public.opendatasoft.com) has plenty of
  areas — `georef-germany-land` (16), `-kreis` (400), `-gemeinde` (10 949),
  all "Datenlizenz Deutschland – Namensnennung 2.0", credit "© GeoBasis-DE /
  BKG" — but we found practically **no line datasets** (rivers, cycle paths,
  railways) there.

### openSenseMap

Measured for temperature around Münster (October 2026):

| Endpoint | Result |
|---|---|
| `/boxes/data` (area + period, all values) | 1 day: 21 300 rows, 4.6 MB, 30 s; 3 days: 13.5 MB, 116 s; 7 days: nothing within 60 s |
| `/statistics/descriptive` (server-side means) | 1 day: 35 KB but still 30 s; 3 weeks: nothing within 5 min |
| `/boxes?date=…&phenomenon=…` (active boxes) | nothing within 60 s |
| `/boxes?bbox=…` | 8 s for all of Münster (807 boxes, most inactive or mobile); 0.3 s with `exposure=outdoor` |
| `/boxes/:box/data/:sensor` | **0.2–0.7 s**, but silently capped at the newest 10 000 values (~3–4 days for a box sending every 30 s) |
| `/boxes/:box/sensors?count=100` | 0.08 s, newest 100 values of every sensor (not used yet) |
| `/tags` | 0.17 s, 2 281 group tags |

Conclusion: the routes made for "area + period" scale with the raw data
(~30 s per day for Münster). Only the per-sensor route is fast, so the block
uses it, and periods are capped at 7 days.

Quirks found (covered by tests with recorded responses):

- **The area query returns boxes that are elsewhere now** — for Münster-Mitte
  it returned a box in Berlin and one in Bochum. The block filters by current
  location.
- **`/tags` contains `null` entries.**
- Measurement values arrive as strings (`"24.60"`); one station reported
  −40 °C, a typical sensor fault value — good material for students.
- Phenomenon names are free text (`Temperatur` and `Temperature` are different
  phenomena). The setup window shows them as the boxes name them.
- Most group tags we tried had no station active recently (e.g.
  `codeformuenster`, `TTN MS`, school tags); `Smart City MS` had one.
- **The server is sometimes very slow.** On 2026-10-20 a load of all of
  Münster (one day, three measurements, 47 requests) took **3.5 minutes**: the
  box list took 27 s, a sensor request 17 s (median), even the tiny `/stats`
  4.5 s. One response was cut off in the middle of the JSON. A few minutes
  later the same load took **2.3 s**. Nothing on our side can make this
  faster; the retry (see above) at least turns a cut-off response into a
  second try instead of a failed load.
- The sensors of one box share identical timestamps, which is what lets
  several measurements share one row.

### NASA POWER (API v2.10.0)

- Fast: one year of 8 daily values in ~1.4 s (49 KB); 45 years of monthly
  values in under 1 s. One request per load.
- At most 20 values per request (the block offers 9).
- Daily data starts on 1981-01-01 and lags behind: in our test, temperature and
  precipitation ended 4 days ago, solar radiation 6 days ago. Missing days come
  back as the fill value `-999`.
- Monthly data contains a **13th month per year** (e.g. `202513`), which is
  the annual value.
- Settings the API rejects come back as **HTTP 422** with a readable reason
  ("The data starts at 1981/01/01", "end date is greater then start date", …).
- Values are model and satellite data on a grid of about ½° × ⅝° (weather) and
  1° × 1° (solar radiation), not station measurements.
- Units are written in ASCII (`C`, `kW-hr/m^2/day`); the block shows `°C`,
  `kWh/m²/d`. Air pressure comes in kPa and is kept as delivered.
- The documentation warns that clients repeatedly requesting **the same
  location may be blocked**. No numeric rate limit is given.
- NASA asks for a credit line naming the POWER project, the service version and
  the date accessed; no licence is stated. The dataset card includes it.
- **Grid ("regional") requests:** `/api/temporal/monthly/regional` answers
  with one GeoJSON point per grid cell (~80 KB for Germany, 0.8 s). Limits
  found: **one parameter per request** ("A maximum of 1 parameters …"), and
  **2° to 10°** in latitude and longitude ("Please provide at least a 2 degree
  range …"). The third coordinate of each point is the cell's elevation in the
  model.

### Natural Earth (v5.1.2)

- Public domain; files as GeoJSON in the project's GitHub repository. Served
  via jsDelivr (`cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/…`),
  a CDN that allows pinning a release; GitHub's raw file links aren't meant for
  that.
- Sizes vary a lot: countries (1:110 million) 0.8 MB, lakes 1:10 million 5 MB
  + 1 MB (Europe), rivers in Europe 2.5 MB; railways and roads at 1:10 million
  40–50 MB (not used).
- **Labelling errors in `ne_10m_lakes`:** the outline at 8.49–8.85° E,
  45.72–46.17° N (where Lago Maggiore is) is called "Lago di Como", and the one
  at 11.86–12.00° E, 42.54–42.65° N (Lake Bolsena) "Lago di Bracciano". The
  real Lake Como and Lake Bracciano are in `ne_10m_lakes_europe`. The loader
  keeps the source as it is, so the map shows two "Comer" and two
  "Braccianosee" (a test documents it).
- The two lake files don't overlap otherwise: lakes with the same name in both
  are different lakes or one of the errors above.

### OpenStreetMap via Overpass (2026-10-26/27)

- Allows browser requests; no key. **Busy and unpredictable:** on 2026-10-26
  the main server answered "at capacity" (HTTP 502) at once, and two other
  public servers (`overpass.private.coffee`, `overpass.kumi.systems`) timed
  out after 90 s. The main server's other hosts `lz4.` and `z.` answered
  after **~40 s** in the queue. While recording the stored copies, all three
  refused one request, and the same request a minute later worked; the wider
  cycle path query once timed out after 120 s before the next server answered
  in 46 s.
- Live loads in the app (Edge): 39–62 s per topic, Berlin's cycle paths
  (29 943 lines) the slowest. Size: all of Münster's cycle paths 4.7 MB,
  rivers 1.6 MB.
- Element counts per city (whole-city rectangles, `out count`):

  | City | rivers | cycle paths | parks | playgrounds | drinking water | bus stops |
  |---|---|---|---|---|---|---|
  | Münster | 1 854 | 5 338 | 202 | 579 | 7 | 1 524 |
  | Köln | 2 047 | 10 182 | 447 | 2 219 | 51 | 3 290 |
  | München | 1 180 | 12 644 | 1 099 | 3 808 | 141 | 1 315 |
  | Leipzig | 1 195 | 7 177 | 528 | 1 154 | 34 | 1 599 |
  | Freiburg | 5 232 | 4 174 | 424 | 546 | 107 | 903 |
  | Dresden | 3 456 | 4 587 | 566 | 1 476 | 28 | 2 258 |
  | Berlin | 1 982 | 29 945 | 2 784 | 6 228 | 289 | 7 996 |

- **overpass turbo** (overpass-turbo.eu) is not an API but a web page for
  writing Overpass queries and seeing the result on a map; it sends them to
  the same servers. Useful for trying a new topic's query (`{bbox}` there is
  `{{bbox}}`), and perhaps later for students who want to see the query
  behind their data.

### Web addresses (2026-10-28)

- Allow browser requests (`Access-Control-Allow-Origin: *`): USGS earthquake
  feeds (0.1 s, 257 KB for a week), PEGELONLINE (0.1–0.3 s; 7 days of minute
  values are ~10 000 rows, hence 3 days in the example), Bright Sky (0.4 s),
  Our World in Data grapher CSV (0.5 s, 801 KB), the Natural Earth 3.3.0 files
  behind geojson.xyz (`d2ad6b4ur7yvpq.cloudfront.net`, 1 s for 1.4 MB).
- Don't: Wikipedia pages, and (earlier) the UBA air quality API. A browser only
  says "failed to fetch" for those, the same as for a wrong address or being
  offline, so the message has to name all three.
- USGS times are milliseconds since 1970; Our World in Data names columns in
  English with units in the name (`CO₂ emissions per capita`).
- geojson.xyz itself could not be opened from the development machine
  (connection timeout); its file server worked.

### Map library and polygon size (test, 2026-10-26)

Would Leaflet cope with polygons, or do we need Mapbox/MapLibre? Tested in
Edge with the Huwise outlines (states 16, districts 400, municipalities
10 949), each area coloured, at normal speed and with the CPU slowed 4× (as
a stand-in for a school Chromebook):

| Leaflet (canvas), CPU 4× slower | first picture | page frozen per zoom step |
|---|---|---|
| 16 states (72 000 vertices, 2.8 MB) | 0.7 s | 0.2–0.3 s |
| 400 districts (426 000 vertices, 17 MB) | 3.7 s | 2–2.7 s |
| 10 949 municipalities (1.38 M vertices, 58 MB / 25 MB compressed) | 12 s | 8–9 s |
| municipalities simplified to 10 % (1.8 MB compressed) | 6 s | 1.2–2.1 s |
| MapLibre, municipalities simplified to 3 % | 2.6 s | 0 s |

- At normal speed Leaflet is fine for all levels once the shapes are
  simplified (0.3–0.6 s first picture, ≤ 0.3 s per zoom).
- **The data size matters more than the library:** reading 58 MB of GeoJSON
  took 6 s on the slowed CPU before anything was drawn. Simplifying with
  mapshaper (shared borders stay shared, no gaps) cuts download, reading and
  drawing alike; 10 % of the points still looks right zoomed in on Münster.
- MapLibre zooms without freezing, but its slowed-CPU numbers are optimistic
  (only the main thread was slowed, MapLibre works in background threads).
- Mapbox GL JS (v2+) is not open source, needs an account and token and is
  billed per map load; MapLibre is its open-source continuation.

### Checked, not built

- **Open-Meteo**: browser requests allowed, but returned 503 (overloaded)
  during the test.
- **More data with place and time** (2026-10-27; four of these are now examples
  of the web address block, see above; browser access checked only;
  licences, history and limits still to check per source): GBIF species
  sightings (67 598 records in Münster in 2024 alone), Pegelonline water
  levels (e.g. gauge "MÜNSTER OW"), Bright Sky (DWD weather stations), USGS
  earthquakes (global, last month), Our World in Data CSV (per country and
  year, could be joined with Natural Earth countries) and World Bank (works,
  but ~6 s). UBA air quality allows no browser requests after its redirect, so
  it would need a proxy.

## 5. Decisions taken

- Configuration of API blocks happens in a **setup window**; results stay in
  the side panel.
- openSenseMap: **area presets instead of a map** for now, plus **group tags**;
  **max. 7 days**; ~20–50 quick requests per load are fine for the API.
  Longer periods should come from a curated snapshot file.
- NASA POWER: **place presets plus own coordinates**, a curated list of 9
  values, **fixed dates** instead of "last N days".
- A `save_as` block was tried and **removed** again for now; it only makes
  sense together with `combine_with`, whose semantics are still open.
- Each data block gets **its own variable name** in the Python code, so
  students can work with several datasets side by side.
- Predict first is **a block**, not a button in the side panel, so it is part
  of the analysis and saved with it. The real values stay **hidden until
  revealed**.
- Values are **not covered on load**: students who don't want to guess
  shouldn't hit a hurdle. A guess therefore only hides values if it is placed
  before looking; a real "predict first" lesson needs a teacher-prepared
  workspace (see open questions).
- Guesses are limited to **measurement** columns.
- The **"Warum?"** explanation is optional.
- openSenseMap: **several measurements side by side** (up to 5), one row per
  station and time, rather than one measurement per block.
- A guess **starts over** only if its column disappears with new data; other
  changes keep it.
- Explanations ("?") contain **only sourced facts**; no source, no reference
  value. They open on hover *and* on click/tap, so they work without a mouse.
- Map: **Leaflet + OpenStreetMap tiles** for now (small, no API key). The map
  is a **preview of the loaded data** in the side panel, not yet a block.
- Map colours show **real values** of one measurement at a time, with the
  per-place statistic chosen by the student; outliers are kept out of the
  class limits by the boxplot rule.
- Icons only for the API loaders (few places); plain canvas dots for datasets
  that can have thousands of places.
- On small screens the **toolbox opens on demand** instead of taking a third
  of the canvas.
- **Shapes are GeoJSON geometries in a column**, raster data are **rows per
  grid cell** plus `meta.grid` (see "Shared data format").
- **Stay on Leaflet**, not Mapbox (licence, cost, data protection); move to
  MapLibre only if smooth zooming of very many shapes or real raster images
  become a requirement (see the test above).
- Lines from **Natural Earth** (pinned to one version) for Europe, and from
  **OpenStreetMap live** for cities, with **stored copies as fallback** so a
  class isn't stuck when Overpass is full.
- Students' own data: **a file block and a web address block**, both reading
  CSV, JSON and GeoJSON with the same code; **files never leave the browser**
  and are not saved with the workspace.
- Web addresses: **checked once in the setup window** before they can be used,
  and the way they were read is saved with the block (same reading in Python).
- Column kinds are **guessed from the values**; the panel says so. Ids stay
  text.
- **Only https** addresses; **no proxy** for sites that don't allow browser
  requests (for now).
- OpenStreetMap: **stored copies only for Münster**; other cities fall back to
  the Münster copy with a notice, to keep the app small.
- Cycle paths: **all four ways of mapping them**, with the kind as a column,
  rather than only separate cycleways.
- Point symbols **only when they fit** (few points, or zoomed in to street
  level); dots otherwise.
- **Source data is kept as delivered**, including Natural Earth's mislabelled
  lakes; fixes would be noted in the description, not made silently.
- NASA weather map: **only cells touching the area**, outline and places drawn
  on top, **one colour scale for all months** of the slider.
- Outlines for the NASA map are **bundled** (25 KB, simplified), not fetched at
  load time.

## 6. Limitations and known issues

**Architecture**

- Loads run on the main thread, not in a worker; results are cached per block
  settings only for the current page.
- No autosave or export/import of the workspace yet; blocks only survive a
  language switch.
- A load block can't tell later blocks its columns before the data has
  arrived (columns are only known after asking the API). This needs a decision
  before processing blocks are added (e.g. cache the dataset description).
- No processing blocks yet (filter, group by time, charts, a map block); the plan has
  only load steps.
- Any block can snap under a load block, including standard Blockly blocks
  (loops, …). Those appear in the Python code but are ignored by the plan, so
  code and analysis can differ. Typed connections should prevent this.
- The standard toolbox and the starter header (badges, block counters) are
  still visible.
- `tsconfig` is not `strict` yet.

**Huwise block**

- At most 10 000 rows (API limit for `records`); the export endpoint would allow
  more.
- Shapes come through the normal 100-records-per-request route, unsimplified:
  all 400 districts are ~17 MB and slow to load and draw on weak devices.
- In Python (CSV export) shapes arrive as text, not as geometries.
- Semantic types are guesses (name patterns, facet annotation, few distinct
  values); students can't correct them yet.

**openSenseMap block**

- Periods are relative ("last 3 days"): reopening a saved workspace later
  loads different data. No fixed date range yet.
- At most 50 stations and 7 days per load. 7 days of a busy area can mean
  ~150 000 rows in the browser.
- Area presets are bounding rectangles from OpenStreetMap, so they include
  parts of neighbouring areas.
- Stations are matched by exact sensor title; `Temperatur` and `Temperature`
  are separate choices.
- Only pressure units are converted. Other mixed units (e.g. a temperature
  in °F) still leave the column without a unit.
- Each extra measurement adds requests (see above); with 5 measurements and
  50 stations that can be ~250 requests. When openSenseMap is slow, a load can
  take minutes. The progress line counts stations, not requests.
- Rows are merged by exact timestamp. Stations whose sensors don't share a
  timestamp would get one row per sensor value, with the other columns empty.

**NASA POWER block**

- **Possible blocking in class:** many students loading the same place at the
  same time could trigger NASA's blocking of repeated requests. Results are
  cached per browser, not across students; a small caching proxy or a curated
  file would help if this happens.
- Values describe a grid cell of ~50 km; nearby presets (Münster, Coesfeld,
  Warendorf, Steinfurt) can fall into the same or neighbouring cells and give
  very similar values.
- The dataset description shows dates in ISO form ("2025-01-01"), because it is
  built in the language-free core.
- Only one place per block; comparing places means one block per place.

**NASA weather map block**

- One value per block (API limit), three areas, monthly values of one year.
- "Cell touches the area" is checked with corners, centre and outline vertices;
  an outline edge cutting just the corner of a cell without a vertex in it
  could be missed (rare with outline vertices a few km apart).
- The places for orientation are a fixed list per area; the school or
  openSenseMap stations can't be shown yet.
- The month slider exists only for grid data, not for openSenseMap's
  minute-by-minute values.
- The generated Python code doesn't apply the outline filter, so it has more
  rows than the app (all cells in the rectangle).
- At Germany zoom the cells are a few pixels wide; picking a particular cell
  needs zooming in.

**World map data block (Natural Earth)**

- Coarse: countries at 1:110 million, lakes and rivers at 1:10 million; very
  small lakes are missing, many river sections have no name.
- Rivers and lakes only for Europe; countries and cities world-wide.
- Natural Earth's labelling errors (Lago Maggiore as "Lago di Como", Lake
  Bolsena as "Lago di Bracciano") are shown as delivered.
- Depends on jsDelivr being reachable.
- The generated Python code doesn't limit the lakes to Europe, so it has more
  rows than the app.

**OpenStreetMap block**

- Live loads take ~40–60 s, and longer when Overpass is busy; with 30 students
  asking at once it will be slower still (not tested).
- Stored copies exist only for Münster (2026-10-27) and get older; they need
  re-recording now and then (`public/data/osm/README.md`). For other cities,
  a failed load shows Münster.
- Areas are rectangles, not the city boundary.
- Parks: only parks mapped as one closed way; parks made of several parts
  (relations) are missing (the description says so).
- Cycle path kinds: a road with a cycle lane counts as one line, though it may
  have a lane on one side only; `cycleway=shared_lane` and similar are not
  included. Values of `belag` and `beleuchtet` are raw OSM values
  (`asphalt`, `yes`).
- Berlin's 30 000 cycle path lines take ~60 s and are heavy for weak devices.
- The generated Python asks the servers in turn but has no stored-copy
  fallback.

**Own file and web address blocks**

- **Licences unknown:** SPOCKLY can't know the licence of an own file or
  address; the examples' licences aren't checked yet either. A general note is
  shown.
- **Sites without browser access (CORS) can't be loaded**; only a server of our
  own would help.
- **Guesses can be wrong**, and students can't correct them yet: e.g. Natural
  Earth's `scalerank` and `strokeweig` are taken as measurements and colour
  the map, though one is a display rank and the other a line thickness.
- Files are gone after closing the tab; a saved workspace with a file block
  needs the file again. Large files (over 4 MB in total) are not carried
  across a language switch.
- The web address examples change (earthquakes, water levels) or are fixed
  past periods (weather); a saved workspace may load different data later.
- Natural Earth 3.3.0 via geojson.xyz is older than the 5.1.2 of the world map
  block; names and borders can differ.
- Python: lists inside JSON records stay lists in Python but are text in the
  app; a JSON file that is only a list of plain values (`[1, 2, 3]`) would fail
  in Python. CSV files are read without date parsing in Python.
- Only the first sheet-like table of a file: no Excel files (save as CSV
  first), no multiple tables, no header row other than the first line.

**Predict-first block**

- **Values are visible before a guess is placed.** A strand starts with
  loading, and the Daten tab shows the values as soon as they arrive; the guess
  block can only be added afterwards. In free exploration it works as a
  self-check, not as enforced "predict first".
- Values are only hidden in the **Daten tab**. The Python tab, or running the
  code, still shows them.
- Only highest value, lowest value and mean. Questions like "when was the
  hottest day?" or "how many days above 25 °C?" need more blocks first.
- The **5 % "close" threshold** is a first guess. For values near zero (e.g.
  minimum precipitation of 0 mm) almost any miss counts as "too high".
- In Python, the guess line uses the app's column names. They match the Python
  table for NASA and for the openSenseMap measurement columns, but not always
  for Huwise, so that line can fail there. The app itself is not affected.
- The "Zur Orientierung" line only appears for quantities the glossary knows.

**Explanations ("?")**

- **Not reviewed by a teacher yet** — wording level and choice of reference
  values are a first draft.
- Only quantities with a known name or code get a "?". openSenseMap names are
  free text, so new spellings need to be added by hand.
- Reference values are general (e.g. EU limits for daily or annual means);
  single sensor readings can be far above them without breaking a limit. The
  PM texts say so, but students may still compare a single reading with a
  daily limit.

**Map**

- Gridded data are drawn as tiles; real raster images (e.g. GeoTIFF elevation
  or land cover) aren't supported yet.
- Very large shape datasets (thousands of detailed areas) get slow on weak
  devices unless simplified first (see the test in section 4).
- **OpenStreetMap's tile servers** are fine for a prototype, but their usage
  policy doesn't cover heavy use; a whole school using SPOCKLY needs another
  tile provider.
- **Colours are relative to the loaded data:** dark blue means "high among
  these places", not a fixed value, so the same colour means different values
  in two loads. The legend always states the numbers.
- Stations in the Münster city centre overlap at the starting zoom; numbers
  ("Zahlen zeigen") overlap there too.
- openSenseMap stations are picked by their *current* location, but plotted
  where each measurement was taken; a station with a slightly different
  recorded position can appear just outside the dashed area.
- No map for the Python view yet; the map exists only in the app.
- A moved tooltip loses its little arrow.

**Python view**

- The code is Pyodide-specific (`open_url`) and won't run unchanged in a normal
  Python setup.
- The openSenseMap code fetches every box in the area (including inactive
  ones) and doesn't page past 10 000 values per sensor.
- In the whole-canvas view, helper variables (`url`, `zeilen`, `boxen`,
  `antwort`) are reused between blocks; they don't overwrite data, but may
  confuse readers.
- The first run downloads numpy, pandas, python-dateutil, pytz and six, which
  is slow on a shared school network.
- On phones, a wrapped code line continues at the left edge, not at its
  indentation.

**Small screens**

- While the toolbox is open on a phone, it covers the left part of the canvas;
  blocks underneath can't be reached until it closes.
- "Erste Zeilen" still scrolls sideways (it's a real table with many columns),
  now within its own box.
- With eight load blocks the toolbox list is taller than the canvas; the last
  blocks need scrolling.
- Block dropdown menus rely on Blockly's internal `TEST_ONLY.getBoundsInfo`
  (see Other changes); a Blockly update may need a new look at them.

**Checked only partly**

- The English setup windows were not looked at in the browser (texts exist).
- Touch devices (iPads, Chromebooks) were not tested on real hardware; the
  "?" buttons, measurement cards, small-screen layout and the "Blöcke" button
  were checked in Edge's phone and tablet emulation only.

## 7. Tests

`npm test` runs 206 unit tests:

- `core/plan`, `core/summary`, `core/names`;
- `core/geo`: one place per coordinate, rows without coordinates, the
  5 000-place cap, values per place for several measurements (mean, lowest,
  highest, newest), no values unless asked for (so hidden guesses stay
  hidden), colour classes (equal steps, a faulty −144 °C doesn't squeeze the
  others into one class, all-equal values);
- `core/geometry`: recognising geometries, point/line/area, vertices, bounding
  box, point in area (holes excluded), cell touches area (also with Bremen's
  real outline), summary of a geometry column, one shape per row with the
  label from a name column;
- `core/http`: one retry for server errors, cut-off responses and network
  errors; no retry for 404/422/429; cancelling during the wait;
- Huwise mapping and loading (paging, error codes, input validation, shapes
  kept as geometries — Bremen's MultiPolygon);
- openSenseMap station selection, phenomena, area filter, paging past the
  10 000-value cap, table mapping (several measurements side by side, matched
  by timestamp, empty cells, mixed units, Pa → hPa), the hPa conversion in
  the Python code, column names, parameter validation
  (including blocks saved with one measurement, at most 5), loading with
  mocked `fetch`, tag list;
- NASA POWER settings checks, request URL, date keys, fill values, monthly
  values without the annual value, dataset description, error handling;
- NASA weather map: one row per cell and month (NRW: 26 × 12), cell size from
  the data (0.5° × 0.625°), only cells touching NRW (and which four are
  dropped), outline, places and credit, elevation, request URL, settings
  checks, defaults for odd saved settings;
- Natural Earth: countries with German names, measurements and years, `-99`
  as missing, credit and extent across the 180° meridian; lakes from both
  files, outside Europe left out, first view on the Alpine foreland, the
  mislabelled Lago Maggiore kept as delivered; pinned file URLs;
- OpenStreetMap: one row per way with name, kind and OSM id, licence and
  credit, point/line/area from nodes, centres and ways (a closed cycle path
  stays a line), servers asked in turn after a 502, stored copy with notice
  when none answers, the Münster copy for Köln with its notice, cancelling
  stops at the first server, query in Overpass order, defaults for odd saved
  settings; cycle path kinds from tags, `art` column and categories, the
  same rules in the Python code; symbols for points;
- `core/tabular`: German spreadsheet export (`;`, decimal comma, byte order
  mark), quotes and line breaks in quoted fields, delimiter detection, empty
  and repeated column names; GeoJSON features, the longest list in an object,
  nested objects as columns, plain lists and single objects; German numbers
  and dates, coordinates, ids, years, categories and free text, postcodes and
  "NA", milliseconds since 1970, geometries and booleans, the row limit;
- web address block, with real answers recorded 2026-10-28 (USGS, Bright Sky,
  PEGELONLINE, Our World in Data, trimmed): columns and kinds, the records
  found in Bright Sky's answer, nested waterway, gauge numbers kept as text,
  years as times, a web page instead of data, blocked address (CORS) and 404
  messages, the size limit, https only, defaults for odd saved settings, short
  addresses, the Python reader for CSV, JSON and GeoJSON;
- own file block: the store (Python names, same file again, same name twice),
  reading with saved settings, missing file and no file, GeoJSON files, the
  Python line;
- guess block: real value (highest, lowest, mean, ignoring missing values) and
  the "too high / too low / close" comparison;
- glossary: names and codes found (including openSenseMap spellings), no match
  for different quantities with similar names, a source for every reference
  value, each name in only one entry.

The guess block's interaction (snapping, hiding, revealing, undo, the
"Warum?" line, keeping the chosen column across a language switch, starting
over after another measurement is loaded), the "?" buttons (hover, click,
keyboard, tap; cards still selectable), the map (all three loaders,
measurement buttons, statistic switch, numbers, tooltips, an open guess
hiding its column, dialogs above the map) and the small-screen layout (390,
768 and 1100 px; "Blöcke" button), the shapes and grid maps (all five
loaders, NASA map for Germany and NRW, month slider and play button, a cell's
places, lakes and rivers views) and the generated Python of the two new blocks
(run in Pyodide: 2 880 grid rows, 177 countries), the OpenStreetMap block
(live: playgrounds, Freiburg drinking water, parks, cycle paths in Münster and
Berlin; with Overpass blocked: stored copy and the Münster stand-in for Köln;
symbols, dots and street-level switch), tooltips at the map's edges, and the
block dropdown menus at 420 and 1600 px with blocks near the top and left
edge, the web address block (examples, map of earthquakes, 26 509 CO₂ rows,
error messages for a web page, `http://` and a missing file), the own file
block (German CSV, map, Python run reading the file in Pyodide, language
switch), world lakes and rivers from geojson.xyz (dots for small areas, wheel
zoom after a click, dragging), and the rows table (one scroll box at 420, 1000
and 1600 px, header staying on top, border around all columns) were checked
with scripted browser runs, not with automated tests.

The fixtures (`__fixtures__/`) are **real API responses and files** recorded on
2026-10-06, 2026-10-07, 2026-10-13, 2026-10-19, 2026-10-26, 2026-10-27 and 2026-10-28, some trimmed;
each folder has a README saying exactly what was requested. They contain
public data: German federal states incl. Bremen's outline (Data licence
Germany – attribution 2.0), OpenStreetMap drinking water points and five
river sections in Münster (ODbL), a few
openSenseMap boxes and values, NASA POWER values for Münster and a NASA grid
for NRW, and Natural Earth countries and lakes (public domain).

The UI was checked by hand and with scripted browser runs against the live APIs.
There are no automated UI tests in the repo.

## 8. Open questions

- **Dates as ISO strings** in `DataTable` — confirm or change? It affects every
  loader.
- **`combine_with`**: append rows, join on a column, or time-aligned join?
- **When to add typed connections** — now, or with the first processing blocks?
- **Curated openSenseMap snapshot** for "a few weeks of Münster": who creates
  and approves it?
- **Correcting guessed column kinds:** should students be able to say "this
  column is a time / an id, not a measurement"? It matters for maps and
  guesses.
- **Proxy for sites without browser access:** worth running one (and who
  maintains it), or stick to services that allow it?
- **Licences of the web address examples** need checking before classroom use.
- **Saving own files with a workspace** (e.g. for teacher-prepared activities)
  — and what that means for data protection.
- Should the openSenseMap block also offer a fast **"current values"** mode
  (`/boxes/:box/sensors`)?
- **NASA POWER in class:** test with a whole class whether repeated requests get
  blocked, before relying on it in a workshop.
- **Predict first in a lesson:** values are only hidden if the guess block is
  there before the data. Teacher-prepared activities (load block and guess block
  already placed) would solve this — needs saving and opening workspaces first.
- **"Close enough"** for a guess: is 5 % a good rule, and what should happen
  near zero?
- Should the **"Warum?"** explanation be required, or only nudged ("Schreib
  einen Satz, warum …")? Worth asking teachers.
- **Glossary texts:** right level for the age group? Which reference values
  help most — e.g. for particulate matter, the current EU limits, the stricter
  ones from 2030, or the WHO values? Teachers should review before use.
- **Shapes and raster in `DataTable`:** confirm GeoJSON geometry columns and
  rows-per-grid-cell (`meta.grid`) — they affect every later block. Do we
  need real raster images (GeoTIFF, e.g. elevation or land cover) later?
- **Natural Earth's mislabelled lakes:** keep them as delivered (now), or fix
  the two labels with a note in the description?
- **All municipalities / districts:** prepare simplified outline files once
  (see the test in section 4)? Who maintains them?
- **NASA weather map:** show "difference from normal" (warmer/colder than the
  long-term average) as the next step? Needs checking whether NASA's
  climatology service works for grids and which reference period it uses.
- **OpenStreetMap in class:** does Overpass hold up with a whole class, or do
  we need our own Overpass instance or a caching proxy? Who refreshes the
  stored copies, and should other cities get copies too (size)?
- **City boundaries** instead of rectangles (Overpass `area` queries are
  heavier; boundaries would have to be bundled or fetched)?
- **Next spatio-temporal sources** (GBIF, Pegelonline, Bright Sky/DWD, USGS,
  Our World in Data + countries): which first?
- **Map tiles for classroom use:** which tile provider, and does it need a
  key or a proxy?
- **Colour scale:** relative to the loaded data (now), or fixed scales per
  quantity (e.g. temperature always −10 to 35 °C) so that maps of different
  loads can be compared?
- Should the map become a **block** of its own (e.g. "zeige auf Karte"), so it
  is part of the analysis and its settings are saved?
