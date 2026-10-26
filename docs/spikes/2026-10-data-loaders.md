# Spike: loading data from APIs (Huwise, openSenseMap, NASA POWER) and "predict first"

Branch `spike/data-loaders`, October 2026. Not merged and not reviewed yet.

This spike tries out the "load data" part of SPOCKLY: three load blocks for
real APIs, a side panel that shows what was loaded, and a Python view of the
blocks. It also adds a first teaching block on top of loaded data: **"schätze …"**,
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
npm test         # 134 unit tests (Vitest)
npm run build    # type check + production build
npm run lint
```

- Open the toolbox category **Daten laden** and drag a block onto the canvas:
  - **lade Datensatz** loads a Huwise dataset (default: German federal states).
  - **lade openSenseMap-Daten** loads sensor measurements.
  - **lade NASA-Wetterdaten** loads weather and solar data for a place.
- The openSenseMap and NASA blocks open a **setup window** when dropped; the
  gear (⚙) on the block opens it again.
- From **Schätzen & Prüfen**, snap **schätze …** under a load block, pick a
  column, type a guess and click **Auflösen**.
- Point at a **"?"** (setup windows, Daten tab) to read what a measured
  quantity is; a click keeps the explanation open.
- Click a block to see its data in the **Daten** tab and its code in the
  **Python** tab. **Code ausführen** runs that code in the browser with
  Pyodide (the first run downloads pandas, ~10–40 s).
- In the Daten tab, the **Karte** shows the places; the buttons above it pick
  the measurement the markers are coloured by.
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
- Polygons (`geo_shape`) are left out; `geo_point_2d` becomes a latitude and a
  longitude column; multi-value fields are joined into text.

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

Both API blocks with many settings use the same mechanism: the window opens
by itself once, when the block is dropped from the toolbox (not when the drag
starts), and later through the gear. Changing settings is a normal Blockly
change, so it can be undone with Ctrl+Z.

### Daten tab (side panel)

Shows the selected strand, or the one edited last:

- dataset card: title, source, credit/licence, last update, description,
  keywords, "16 Zeilen geladen" or "100 von 12 500 Zeilen geladen" with a hint
  when only part was loaded;
- one row per column: kind of data (Messwert, Kategorie, Zeit, Breitengrad,
  Kennung …), how much is filled in (missing values highlighted), and an
  overview (range and mean, time span, or most frequent values);
- a **map** for data with coordinates (see below);
- the first 20 rows, missing values shown as "–". When they are wider than the
  panel, a hint says "Seitlich wischen oder scrollen, um alle Spalten zu sehen →"
  (Radix shows the sideways scrollbar only on mouse hover, so touch users
  otherwise see no sign of more columns);
- progress while loading ("Lade Zeilen: 300 von 1 000", "Lade Stationen: 5 von 9").

When the panel is narrower than 520 px (a phone, or the side panel next to the
canvas on a small laptop), the column table turns into one block per column:
name and kind on top, then "Ausgefüllt" with its bar, then the overview. This
follows the panel's own width (CSS container query), not the screen's.

### Map (Daten tab)

Shown for every dataset with a latitude and a longitude column, between the
dataset card and the column table. Built with **Leaflet 1.9.4** and
**OpenStreetMap tiles** (no API key).

- **One marker per place:** rows with the same coordinates become one marker,
  so a station with 1 436 measurements is one box, not 1 436. At most 5 000
  places are drawn; the caption says how many were left out and how many rows
  had no coordinates.
- **Marker by kind of place:** a **box** for a senseBox station
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
- **"Zahlen zeigen"** writes the value next to each marker (off by default;
  numbers overlap where stations are close together).
- **The area asked for** (openSenseMap area, Huwise dataset extent) is drawn
  as a dashed rectangle.
- **Guesses stay hidden:** a column with an open guess is left out of the
  buttons, colours, labels and tooltips; a note says it appears after
  revealing. The map code only reads the columns it is given, so a hidden
  value can't reach it by accident.
- The mouse wheel scrolls the panel, not the map; +/− zoom. Leaflet's layers
  are kept inside the map, so dialogs and popovers stay on top.

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
        └─ load_nasa_power → DataTable
  └─ store.loads[blockId] = loading | ready | error

DatasetPanel / Python tab     show the strand from selectShownStrandId()
store.loads changes           guess blocks refresh (result, column labels)
```

Blocks below a load block get its data through `setTableProvider` (registered
in `BlocklyWorkspace.tsx`): the root block of their stack is the load block,
and its result in `store.loads` is the table they work on.

Resetting a guess after new data: when a load block's settings change
(its saved state, or the `DATASET`, `DOMAIN`, `MAX_ROWS` fields), the guess
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
- `DatasetMeta.placeKind` (optional, new) says what a place in the rows
  stands for: `'sensor-station'` (openSenseMap) or `'grid-cell'` (NASA POWER).
  The map picks its marker from it rather than guessing from the source name.
  Loaders that don't set it get plain dots.

### Where things are

| Path | What |
|---|---|
| `src/core/types.ts` | data format, plan and operation types |
| `src/core/plan.ts` | workspace → plan (framework-free, tested with fake blocks) |
| `src/core/summary.ts` | column summary for the Daten tab (any `DataTable`) |
| `src/core/names.ts` | text → valid, unique Python variable names |
| `src/core/geo.ts` | rows → places for the map, values per place (mean, min, max, newest), colour classes + tests |
| `src/core/http.ts` | `getJson` (HTTP/network errors → `LoadError` with i18n code, one retry for temporary problems), `mapLimit` |
| `src/blocks/load_huwise/` | block definition, plan step, API + mapping, Python, tests, fixtures |
| `src/blocks/load_osem/` | same for openSenseMap, plus `presets.ts` (areas, periods) |
| `src/blocks/load_nasa_power/` | same for NASA POWER, plus `presets.ts` (places, variables) |
| `src/blocks/predict/` | guess block: definition (button, "Warum?" line), plan step, Python, `compare.ts` (real value, gap) + tests |
| `src/blocks/fields/columnDropdown.ts` | column dropdown that keeps its value while data is loading; `setTableProvider` |
| `src/blocks/setup.ts` | shared parts of blocks with a setup window (gear, open once, undoable changes) |
| `src/blocks/index.ts` | registers blocks; `loadOperations`, `pythonBaseNames` |
| `src/blocks/pythonNames.ts` | variable name per block, shared by all code views |
| `src/blocks/theme.ts` | Zelos theme with hat-shaped load blocks |
| `src/hooks/useLoadRunner.ts` | runs load steps (debounce, cancel, cache) |
| `src/components/DatasetPanel.tsx` | Daten tab |
| `src/components/MapPreview.tsx` | the map: markers and icons, measurement buttons, legend, tooltips |
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
   places are stations or grid cells.
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

## 4. What we learned about the APIs

All three APIs allow direct browser requests (`Access-Control-Allow-Origin: *`),
so **no proxy is needed**.

### Huwise (Explore API v2.1)

- `records`: at most **100 records per request**, and `offset + limit ≤ 10 000`.
  The block pages in steps of 100 and stops at 10 000.
- The CSV export (`exports/csv`) uses `;` as delimiter; used by the Python code.
- Field metadata (type, label, description, facet annotation) is good enough to
  guess semantic types; integer codes still look like numbers.

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

### Checked, not built

- **Open-Meteo**: browser requests allowed, but returned 503 (overloaded)
  during the test.

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
- Polygons are dropped.
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

- **Points only.** Lines, polygons (Huwise `geo_shape` is still dropped) and
  raster data need a decision on how geometries are stored in `DataTable`.
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
- "Erste Zeilen" still scrolls sideways (it's a real table with many columns).

**Checked only partly**

- The English setup windows were not looked at in the browser (texts exist).
- Touch devices (iPads, Chromebooks) were not tested on real hardware; the
  "?" buttons, measurement cards, small-screen layout and the "Blöcke" button
  were checked in Edge's phone and tablet emulation only.

## 7. Tests

`npm test` runs 134 unit tests:

- `core/plan`, `core/summary`, `core/names`;
- `core/geo`: one place per coordinate, rows without coordinates, the
  5 000-place cap, values per place for several measurements (mean, lowest,
  highest, newest), no values unless asked for (so hidden guesses stay
  hidden), colour classes (equal steps, a faulty −144 °C doesn't squeeze the
  others into one class, all-equal values);
- `core/http`: one retry for server errors, cut-off responses and network
  errors; no retry for 404/422/429; cancelling during the wait;
- Huwise mapping and loading (paging, error codes, input validation);
- openSenseMap station selection, phenomena, area filter, paging past the
  10 000-value cap, table mapping (several measurements side by side, matched
  by timestamp, empty cells, mixed units, Pa → hPa), the hPa conversion in
  the Python code, column names, parameter validation
  (including blocks saved with one measurement, at most 5), loading with
  mocked `fetch`, tag list;
- NASA POWER settings checks, request URL, date keys, fill values, monthly
  values without the annual value, dataset description, error handling;
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
768 and 1100 px; "Blöcke" button) were checked with scripted browser runs,
not with automated tests.

The fixtures (`__fixtures__/`) are **real API responses** recorded on
2026-10-06, 2026-10-07, 2026-10-13 and 2026-10-19, some trimmed; each folder has a README
saying exactly what was requested. They contain public data: German federal
states (Data licence Germany – attribution 2.0), OpenStreetMap drinking water
points (ODbL), a few openSenseMap boxes and values, and NASA POWER values for
Münster.

The UI was checked by hand and with scripted browser runs against the live APIs.
There are no automated UI tests in the repo.

## 8. Open questions

- **Dates as ISO strings** in `DataTable` — confirm or change? It affects every
  loader.
- **`combine_with`**: append rows, join on a column, or time-aligned join?
- **When to add typed connections** — now, or with the first processing blocks?
- **Curated openSenseMap snapshot** for "a few weeks of Münster": who creates
  and approves it?
- **Next loaders**: generic API block, CSV upload.
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
- **Geometries in `DataTable`:** how should lines and polygons be stored (e.g.
  a GeoJSON geometry column), and raster data? Needed before the map can show
  more than points.
- **Map tiles for classroom use:** which tile provider, and does it need a
  key or a proxy?
- **Colour scale:** relative to the loaded data (now), or fixed scales per
  quantity (e.g. temperature always −10 to 35 °C) so that maps of different
  loads can be compared?
- Should the map become a **block** of its own (e.g. "zeige auf Karte"), so it
  is part of the analysis and its settings are saved?
