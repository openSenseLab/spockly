# spockly

A Blockly-based prototype for assembling data-science investigations. Learners load
data, clean it, compare groups, and map locations with blocks, run the generated Python
in the browser (via Pyodide), and inspect the named tables and plots — no Python setup
required.

The tool is a prototype for testing block boundaries, not a Python API replica. The
Münster temperature study (`heat_islands_muenster.py`) is one example workflow that
reproduces a real analysis through meaningful Blockly actions.

## Three modes

- **Data Flow** — a sequential chain of statement blocks. Each step transforms the
	working table (`df`) or plot, so you build the investigation one step at a time.
- **Template** — one block runs a complete example investigation and keeps the named
	results inspectable. A guided starting point.
- **Recipe** — abstracts data science into four predefined actionable steps: **Load**,
	**Preprocess**, **Analyze**, and **Output/Viz**. Each step is a single block with
	dropdown selections for inputs and methods, and the steps can be chained in any
	user-defined order (e.g. Load → Preprocess ×2 → Analyze → Output → Analyze → Viz).
	Each step writes to an explicitly named variable, so you can reuse earlier results
	and inspect every intermediate table.

## Stack

- React 19
- Vite 8
- Blockly 13
- Zustand 5
- Radix UI Themes
- Pyodide (Python in the browser)

## Example data

The bundled example investigation uses the local Münster dataset:

- `public/data/muenster_measurements_72h.csv` — 72 hours of station measurements.
- `public/data/muenster_stations.geojson` — station locations.

Source: Stadt Münster, Stadt Temperatur — Datenlizenz Deutschland – Namensnennung –
Version 2.0.

## Scripts

- `npm run dev` – start the Vite development server
- `npm run build` – build the production bundle
- `npm run lint` – run oxlint

## Scripts

- `npm run dev` – start the Vite development server
- `npm run build` – build the production bundle
- `npm run lint` – run oxlint
