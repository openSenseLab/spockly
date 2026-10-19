# Spike: loading data from APIs (Huwise, openSenseMap, NASA POWER) and "predict first"

Branch `spike/data-loaders`, October 2026. Not merged and not reviewed yet.

This spike tries out the "load data" part of SPOCKLY: three load blocks for
real APIs, a side panel that shows what was loaded, and a Python view of the
blocks. It also adds a first teaching block on top of loaded data: **"schätze …"**,
where students guess a value before they see it, then compare and explain.
Along the way it lays down a first version of the shared data format, the plan
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
npm test         # 81 unit tests (Vitest)
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
- Click a block to see its data in the **Daten** tab and its code in the
  **Python** tab. **Code ausführen** runs that code in the browser with
  Pyodide (the first run downloads pandas, ~10–40 s).
- **Deutsch | English** switch at the top right; `?lang=en` also works.

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

Result: one row per measurement — time, value (number, with unit), station
name, station id, latitude, longitude, placement (outdoor/indoor/mobile),
sensor type. If stations use different units, a unit column is added.

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
  friendly warning on the block.
- While the guess is open, that column shows **"🔒 Erst schätzen!"** in the
  Daten tab (overview and preview rows). Other columns stay visible.
- **Auflösen** shows the real value and the gap ("4,04 °C zu hoch"); within
  5 % it says "fast genau getroffen!". **Verbergen** hides it again for another
  try. Choosing a different measure or column hides it automatically, because
  it is a new question. All of this can be undone with Ctrl+Z.
- After revealing, a **"Warum?"** line appears for a one-sentence explanation.
  It is optional, saved with the workspace, kept when hiding again, and stored
  in the plan step (`reason`) so a later data-story feature can reuse it.
- Python shows the guess, the real value and the explanation as a comment:
  `print("Vermutung:", vermutung, "| tatsächlich:", wetter_muenster["T2M"].max())`.

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
- the first 20 rows, missing values shown as "–";
- progress while loading ("Lade Zeilen: 300 von 1 000", "Lade Stationen: 5 von 9").

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
- **Daten tab on small screens:** the card's border scrolled away with the
  content (Radix draws it as a separate layer); a scroll area inside the card
  fixes it.
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
       ├─ guess blocks        result text, unit, column list (from loaded data)
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

### Where things are

| Path | What |
|---|---|
| `src/core/types.ts` | data format, plan and operation types |
| `src/core/plan.ts` | workspace → plan (framework-free, tested with fake blocks) |
| `src/core/summary.ts` | column summary for the Daten tab (any `DataTable`) |
| `src/core/names.ts` | text → valid, unique Python variable names |
| `src/core/http.ts` | `getJson` (HTTP/network errors → `LoadError` with i18n code), `mapLimit` |
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
| `src/components/BlockSetupDialog.tsx` | setup window; picks the form by block type |
| `src/components/OsemSetupForm.tsx`, `NasaSetupForm.tsx` | the two setup forms |
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
5. If it needs a setup window: use `gearField`, `attachGear` and
   `fireStateChange` from `src/blocks/setup.ts`, give the block a
   `setupConfigured` flag, and add a form to `BlockSetupDialog.tsx`.

### openSenseMap: how a load runs

1. `GET /boxes?bbox=…|grouptag=…[&exposure=outdoor]` (cached 5 minutes, shared
   with the setup window).
2. Keep boxes whose **current location** is inside the area, that measured
   since the start of the period (`lastMeasurementAt`), and have a sensor whose
   title equals the chosen measurement. At most 50, most recently active first.
3. Per sensor: `GET /boxes/:box/data/:sensor?from-date&to-date&format=json`,
   4 at a time. A full page (10 000 values) triggers another request that ends
   just before its oldest value.
4. Map everything into one `DataTable`.

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

## 6. Limitations and known issues

**Architecture**

- Loads run on the main thread, not in a worker; results are cached per block
  settings only for the current page.
- No autosave or export/import of the workspace yet; blocks only survive a
  language switch.
- A load block can't tell later blocks its columns before the data has
  arrived (columns are only known after asking the API). This needs a decision
  before processing blocks are added (e.g. cache the dataset description).
- No processing blocks yet (filter, group by time, charts, maps); the plan has
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
- **No data licence shown** — we found no statement for openSenseMap *data*
  (the repositories only state MIT for the code).
- Stations are matched by exact sensor title; `Temperatur` and `Temperature`
  are separate choices.

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
  table for NASA, but not always for Huwise and openSenseMap (e.g. `lat`,
  `lon`), so that line can fail there. The app itself is not affected.

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

**Checked only partly**

- The English setup windows were not looked at in the browser (texts exist).
- Touch devices (iPads, Chromebooks) were not tested.
- On narrow screens, the column table in the Daten tab is wider than the panel
  and has to be scrolled sideways.

## 7. Tests

`npm test` runs 81 unit tests:

- `core/plan`, `core/summary`, `core/names`;
- Huwise mapping and loading (paging, error codes, input validation);
- openSenseMap station selection, phenomena, area filter, paging past the
  10 000-value cap, table mapping, parameter validation, loading with mocked
  `fetch`, tag list;
- NASA POWER settings checks, request URL, date keys, fill values, monthly
  values without the annual value, dataset description, error handling;
- guess block: real value (highest, lowest, mean, ignoring missing values) and
  the "too high / too low / close" comparison.

The guess block's interaction (snapping, hiding, revealing, undo, the
"Warum?" line, keeping the chosen column across a language switch) was checked
with scripted browser runs, not with automated tests.

The fixtures (`__fixtures__/`) are **real API responses** recorded on
2026-10-06, 2026-10-07 and 2026-10-13, some trimmed; each folder has a README
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
