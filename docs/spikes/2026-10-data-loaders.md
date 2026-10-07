# Spike: loading data from APIs (Huwise, openSenseMap)

Branch `spike/huwise-loader`, October 2026. Not merged and not reviewed yet.

This spike tried out the "load data" part of SPOCKLY before Phase 0/1 of the
prototype brief: two load blocks for real APIs, a panel that shows what was
loaded, and a Python view of the blocks. It also lays down the first pieces of
the brief's architecture (data contract, plan, registry). This document
records what was built, how it works, what we learned about the APIs, and what
is still missing.

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
npm test         # 56 unit tests (Vitest)
npm run build    # type check + production build
npm run lint
```

- Open the toolbox category **Daten laden** and drag a block onto the canvas.
- **lade Datensatz** loads a Huwise dataset (default: German federal states).
- **lade openSenseMap-Daten** opens a setup window when dropped; the gear (⚙)
  on the block opens it again.
- Click a block to see its data in the **Daten** tab and its code in the
  **Python** tab. **Run code** runs that code in Pyodide (first run downloads
  pandas, ~10–20 s).
- **Deutsch | English** switch at the top right; `?lang=en` also works.

The standard Blockly toolbox (Logic, Loops, …) is still visible; moving it
behind `?dev=1` is Phase 0 work.

## 2. What was built

### Huwise load block

`lade Datensatz [id] / vom Portal [domain] / höchstens [100 | 1 000 | 10 000] Zeilen`

- Works with any Huwise (formerly Opendatasoft) portal via Explore API v2.1;
  no API key for public datasets.
- Pasting the link of a dataset page (or an API URL) into either field fills
  in both fields.
- Wrong IDs, unreachable portals, private datasets and rate limits become a
  friendly warning on the block (details go to the console).
- Polygons (`geo_shape`) are left out; `geo_point_2d` becomes a latitude and a
  longitude column; multi-value fields are joined into text.

### openSenseMap load block with setup window

The block shows its settings as three lines (measurement, place, period) and a
gear. The setup window lets students choose:

- **Which stations:** an area preset (Münster – Mitte, Münster – whole city,
  Kreis Steinfurt, Kreis Coesfeld, Kreis Warendorf) or a **group tag**, with
  suggestions from all openSenseMap group tags.
- **Outdoor stations only** (on by default).
- **Period:** last 24 hours, 3 days or 7 days.
- **What is measured:** cards listing what the *active* stations in that area
  or group actually measure, with unit and station count. Nothing hard-coded.

The window opens on its own when the block is dropped (not when the drag
starts), and only once per block.

Result: one row per measurement — time, value (number, with unit), station
name, station id, latitude, longitude, placement (outdoor/indoor/mobile),
sensor type. If stations use different units, a unit column is added.

### Daten tab (side panel)

For the selected strand, or the one edited last:

- dataset card: title, source, licence, last update, description, keywords,
  "16 Zeilen geladen" or "100 von 12 500 Zeilen geladen" with a hint when only
  part was loaded;
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
  `georef_germany_land`, `temperatur_muenster_mitte`, a second identical block
  gets `temperatur_muenster_mitte_2`. Numbers follow the order blocks were
  added, so moving blocks doesn't swap names.
- The caption says which dataset the code belongs to and what it is called.
- The generated code runs in Pyodide (downloads go through the browser with
  `pyodide.http.open_url`).

### Other changes

- **Language switch** (DE/EN). The choice is remembered; the page reloads and
  the blocks are restored, because Blockly fixes block text when a block is
  created.
- **Pyodide fixes** (existing bugs): Vite pre-bundled `pyodide` on the first run
  and reloaded the page, killing the worker ("The Python worker stopped
  unexpectedly"); and after a crash, every later run hung on "Preparing the
  Python runtime…" because the dead worker was reused.
- Load blocks are drawn as hat blocks (Zelos renderer, theme with
  `hat: 'cap'`); the toolbox got some top spacing.
- `tsconfig` was **not** switched to `strict` yet (Phase 0).

## 3. How it works

### Data flow

```
Blockly change (non-UI event)
  └─ BlocklyWorkspace.tsx
       ├─ core/plan.ts        blocks → Plan: one strand per load (hat) block,
       │                      disabled blocks marked, "needs data" warnings
       ├─ store.loadSteps     first step of each strand
       ├─ Python per strand   generators + unique variable names
       └─ warnings on blocks  (plan problems, load errors)

useLoadRunner (hooks/)        for each load step whose params changed:
  └─ waits 600 ms, cancels outdated requests, caches by (op, params)
  └─ loadOperations[op](params, ctx)   blocks/index.ts
        ├─ load_huwise → DataTable
        └─ load_osem   → DataTable
  └─ store.loads[blockId] = loading | ready | error

DatasetPanel / Python tab     show the strand from selectShownStrandId()
```

Execution runs on the main thread for now (fetch is async; mapping is cheap).
The brief's cached executor in a Web Worker replaces `useLoadRunner` in Phase 1.

### Shared data contract

`src/core/types.ts` holds the brief's types: `DataTable`, `ColumnMeta`,
`DatasetMeta`, `Plan`/`Strand`/`PlanStep`, `OperationDef`, `Warning`,
`ExecContext`. Additions made here:

- `DatasetMeta.totalRecords` (records at the source; can exceed loaded rows),
  `keywords`, `updated`, `attribution`, `source.licenseUrl`;
- values of `date` columns are **ISO 8601 strings** (keeps tables plain JSON) —
  see open questions;
- `Warning.code` is an i18n key, so core logic stays language-free;
- `toCode(params, { output })` takes the variable name for generated code;
- `ExecContext.onProgress(done, total, unit)` says whether rows or stations are
  being counted.

### Where things are

| Path | What |
|---|---|
| `src/core/types.ts` | data contract, plan and operation types |
| `src/core/plan.ts` | workspace → plan (framework-free, tested with fake blocks) |
| `src/core/summary.ts` | column summary for the Daten tab (any `DataTable`) |
| `src/core/names.ts` | text → valid, unique Python variable names |
| `src/core/http.ts` | `getJson` (HTTP/network errors → `LoadError` with i18n code), `mapLimit` |
| `src/blocks/load_huwise/` | block definition, plan step, API + mapping, Python, tests, fixtures |
| `src/blocks/load_osem/` | same for openSenseMap, plus `presets.ts` (areas, periods) |
| `src/blocks/index.ts` | registers blocks; `loadOperations`, `pythonBaseNames` |
| `src/blocks/pythonNames.ts` | variable name per block, shared by all code views |
| `src/blocks/theme.ts` | Zelos theme with hat-shaped load blocks |
| `src/hooks/useLoadRunner.ts` | runs load steps (debounce, cancel, cache) |
| `src/components/DatasetPanel.tsx` | Daten tab |
| `src/components/OsemSetupDialog.tsx` | openSenseMap setup window |
| `src/components/LanguageSwitch.tsx`, `blockly/carryWorkspace.ts` | language switch, keeping blocks across the reload |
| `src/i18n/` | DE/EN dictionaries (`en` must have the same keys as `de`), `t()`, number/date formatting |

### Adding another load block

1. New folder `src/blocks/<name>/` with `definition.ts` (Blockly JSON, `style:
   'load_blocks'`, no `previousStatement`), `generator.ts` (block → `PlanStep`),
   `operation.ts` (fetch + map to `DataTable`), `python.ts`, tests.
2. In `src/blocks/index.ts`: import the definition, add the operation to
   `loadOperations` and a name rule to `pythonBaseNames`.
3. In `BlocklyWorkspace.tsx`: add the block to the toolbox, `generators` and
   `hatTypes`.
4. Add DE and EN strings.

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

## 4. What we learned about the APIs

All APIs below allow direct browser requests (`Access-Control-Allow-Origin: *`),
so **no proxy is needed** for them.

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

### Checked, not built

- **NASA POWER**: browser requests work; values come as an object keyed by
  date per parameter, missing values are `-999`.
- **Open-Meteo**: browser requests allowed, but returned 503 (overloaded)
  during the test.

## 5. Decisions taken

- Configuration of API blocks happens in a **setup window**, results stay in
  the side panel.
- openSenseMap: **area presets instead of a map** for now, plus **group tags**;
  **max. 7 days**; ~20–50 quick requests per load are fine for the API.
  Longer periods should come from a curated snapshot file.
- A `save_as` block was tried and **removed** again for now; it only makes
  sense together with `combine_with`, whose semantics are still open.
- Each data block gets **its own variable name** in the Python code, so
  students can work with several datasets side by side.

## 6. Limitations and known issues

**Architecture (planned for Phase 0/1)**

- Loads run on the main thread, not in a worker; no per-step cache key yet.
- No autosave or export/import of the workspace yet; blocks only survive a
  language switch.
- `inferSchema` can't work for load blocks: columns are only known after asking
  the API. Phase 1 needs a decision (e.g. cache the dataset description).
- No processing blocks yet; the plan has only load steps.
- Any block can snap under a load block, including standard Blockly blocks
  (loops, …). Those appear in the Python code but are ignored by the plan, so
  code and analysis can differ. Typed connections should prevent this.
- Standard toolbox and the starter header ("Blockly lab", "Run code", …) are
  still visible and English-only.
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

**Python view**

- The code is Pyodide-specific (`open_url`) and won't run unchanged in a normal
  Python setup.
- The openSenseMap code fetches every box in the area (including inactive
  ones) and doesn't page past 10 000 values per sensor.
- In the whole-canvas view, helper variables (`url`, `zeilen`, `boxen`) are
  reused between blocks; they don't overwrite data, but may confuse readers.
- First run downloads numpy, pandas, python-dateutil, pytz and six (the suggested
  classroom cold-start concern).

**Checked only partly**

- The English setup window was not looked at in the browser (texts exist).
- Touch devices (iPads, Chromebooks) were not tested.

## 7. Tests

`npm test` runs 56 unit tests:

- `core/plan`, `core/summary`, `core/names`;
- Huwise mapping and loading (paging, error codes, input validation);
- openSenseMap station selection, phenomena, area filter, paging past the
  10 000-value cap, table mapping, parameter validation, loading with mocked
  `fetch`, tag list.

The fixtures (`__fixtures__/`) are **real API responses** recorded on 2026-10-06
and 2026-10-07, trimmed; each folder has a README saying exactly what was
requested. They contain public data: German federal states (Data licence
Germany – attribution 2.0), OpenStreetMap drinking water points (ODbL), and a
few openSenseMap boxes and values.

The UI was checked by hand and with scripted browser runs against the live APIs.
There are no automated UI tests in the repo.

## 8. Open questions

- **Dates as ISO strings** in `DataTable` — confirm or change? It affects every
  loader.
- **`combine_with`**: append rows, join on a column, or time-aligned join?
- **When to add typed connections** — now, or with the first processing blocks?
- **Curated openSenseMap snapshot** for "a few weeks of Münster" :
  who creates and approves it?
- **Next loaders**: generic API block (meeting), NASA POWER, CSV upload.
- Should the openSenseMap block also offer a fast **"current values"** mode
  (`/boxes/:box/sensors`)?
