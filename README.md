# spockly

spockly is a browser-based Blockly prototype for assembling data-science
investigations. Build a workflow from blocks, generate Python, run it in the browser
with Pyodide, and inspect data previews, generated files, plots, and console output.
No local Python installation is required.

The project is a workshop prototype for exploring useful block boundaries. It focuses
on a curated Münster temperature investigation rather than reproducing a complete
Python or pandas API.

## Modes

The mode buttons switch between three alternative Blockly toolboxes. Switching modes
clears the current workspace and its results.

### Steps

The Steps mode is a sequential data-flow workspace. Blocks load data, clean and
transform tables, analyze groups, inspect results, create visualizations, export files,
and print output. Starter chains demonstrate individual operations on the working
dataframe, and named variables can be reused with `get` blocks.

### Unified block

Unified block mode provides all-in-one blocks for a complete investigation. It includes
dataset exploration, generic analysis and visualization choices, and canonical Münster
procedures such as hourly averages, station comparisons, and location maps. This mode
is intended as a guided starting point that teaches the overall shape of an analysis.

### Tasks

Tasks mode expresses an investigation through four composable statement blocks:

1. **Load** a bundled or uploaded dataset into a named variable.
2. **Preprocess** it by converting types, handling missing values, filtering, removing
   duplicates, or grouping and aggregating.
3. **Analyze** it with summaries, inspections, category counts, station comparisons,
   spatial joins, time-based summaries, or correlations.
4. **Output** a time series, bar, scatter, location, or hourly-comparison plot, or
   export CSV and plot files.

Each task writes to an explicitly named variable, so later blocks can select earlier
results and their columns. The toolbox includes starter chains for time-series,
station-comparison, and spatial workflows.

## Using the app

1. Start with a starter block or assemble blocks in the workspace.
2. Click **Run code** to execute the generated Python in a Web Worker powered by
   Pyodide.
3. Review data previews, variables, plots, exported files, and console output in the
   right-hand panel. The generated Python is available in the Code tab.
4. Use **Reset workspace** to clear the blocks and results. Editing the workspace marks
   displayed results as stale until the workflow is run again.
5. In Steps or Tasks mode, use the upload control to provide a CSV for the upload block.

## Example data

The bundled workflows use local Münster datasets:

- `public/data/muenster_measurements_72h.csv` — 72 hours of station measurements.
- `public/data/muenster_stations.geojson` — station locations.

Source: Stadt Münster, Stadt Temperatur — Datenlizenz Deutschland – Namensnennung –
Version 2.0.

## Stack

- React 19
- Vite 8
- Blockly 13
- Zustand 5
- Radix UI Themes
- Pyodide, pandas, NumPy, and Matplotlib in the browser

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Available scripts:

- `npm run dev` — start the Vite development server.
- `npm run build` — type-check and build the production bundle.
- `npm run lint` — run oxlint.
- `npm run preview` — serve the production build locally.

## GitHub Pages deployment

The `deploy-pages.yml` workflow builds and publishes the `ideenwerkstatt` branch to
GitHub Pages whenever that branch is pushed. It can also be started manually from the
Actions tab. The Vite configuration automatically uses `/spockly/` for the project
site while retaining `/` during local development.

In the repository settings, set **Pages → Build and deployment → Source** to
**GitHub Actions**. After the first successful workflow run, the site is available at
`https://opensenselab.github.io/spockly/`.
