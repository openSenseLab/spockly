# spockly

Data science with blocks: learners build **data journals** that mix narrative text,
data inspection and block-based analyses, similar to a Jupyter notebook or R Markdown
document, but without writing code. Finished journals are shared as an interactive web
page through a link.

## Workflow

1. **Load data**: data blocks are Blockly workspaces too. Load blocks fetch an example
   dataset, an uploaded CSV/GeoJSON file or a URL (e.g. openSenseMap) under a dataset name.
2. **Inspect**: every dataset gets an inspection panel (overview, column types,
   missing values, distributions, preview, map) and a short guided task with
   questions about size, column types, missing values and geometry.
3. **Analyse**: each analysis block holds its own Blockly workspace. A pipeline
   starts with `use dataset …`, stacks steps (filter, group, compute, spatial
   operations) and ends with outputs (table, chart, map, key figure).
   `save as new dataset` makes a result available to later workspaces, which is
   how several workspaces connect.
4. **Tell the story**: Markdown text blocks plus interpretation notes per block.
5. **Share**: the preview shows the reader view; *Share* publishes the journal under a
   short link. Sharing again updates the same link; *Stop sharing* deletes it.

## Spatial analysis and maps

The *Spatial* category groups typical GIS operations:

- **Create**: points from lon/lat columns, centre points, centre coordinates
- **Measure**: distance to a location, distance to the nearest feature of another dataset, area, length
- **Select**: features near a location, features inside/outside the areas of another dataset
- **Combine datasets**: spatial join (attributes of the containing area), count points per area, statistic of points per area
- **Geoprocessing**: buffer (metres), dissolve, convex hull, square/hexagon grid with counts

Spatial blocks generate GeoPandas code. Measurements (distance, area, buffer, grids) are
done in the UTM zone estimated from the data (`df.to_crs(df.estimate_utm_crs())`).
GeoPandas is installed on first use without fiona (GeoJSON is read with
`GeoDataFrame.from_features`), folium comes from PyPI (pinned 0.20.0).

*Show map* draws several layers (the current data or other datasets) as points,
proportional circles, areas or lines, with colour, size and labels per layer, a choice of
basemap (Esri grey canvas, OpenStreetMap, OpenTopoMap, Esri imagery), a layer switcher
and a scale bar.

## Reusing analyses

- **My blocks**: right-click any block or pipeline → *Save to my blocks*. Saved blocks are
  kept in the browser (independent of journals) and appear in the *My blocks* toolbox
  category of every workspace, ready to drag in. *My blocks…* in the ⋮ menu renames,
  deletes, exports and imports them, e.g. to hand prepared steps to a class.
- **Duplicate**: the ⋯ menu of a journal block copies it, with all its blocks, right below.
- Within a page, Blockly's copy/paste (Ctrl/Cmd+C, Ctrl/Cmd+V) also works across workspaces.

## Lab mode

`#/lab` (the *Journal | Lab* switch in the top bar) is a plain block-based data science
workspace: one Blockly workspace with every block (loading and analysis), results and the
generated Python beside it, no journal around it. Each run starts from a clean Python
state. *Add to journal* moves the blocks into the journal as a data block and an
analysis block.

## Architecture

| Concern | Choice |
| --- | --- |
| UI | React 19, Tailwind CSS 4, Radix primitives (`radix-ui`, unstyled) wrapped in `src/components/ui`, lucide icons, Zustand |
| Blocks | Blockly 13 (custom blocks generate Python) |
| Execution | Pyodide in a Web Worker, one shared namespace like a Jupyter kernel. No server, data stays in the browser |
| Generated code | Plain Python: pandas, GeoPandas, Altair (charts), folium (maps). Results are shown with `display()`, as in Jupyter |
| Rendering | Altair charts through vega-embed; folium maps in a sandboxed frame; Leaflet for the data inspection map |
| Persistence | IndexedDB (journal autosave, including uploaded files), `.spockly.json` export/import |
| Sharing | Short links `/s/<id>`: the published journal (texts, outputs, blocks, no raw data or files) is stored by a tiny Node server (`server/`, no dependencies). Without a server it falls back to the whole journal in the URL fragment `#/view/…` |
| i18n | Typed dictionaries in `src/i18n` (`en.ts`, `de.ts`); Blockly's own texts via `blockly/msg/*` |

```
src/
  blockly/      block definitions, Python generators, toolbox, dynamic dataset/column dropdowns
  kernel/       Pyodide worker, kernel client, runtime.py (display(), print capture, dataset profiles; never called by generated code)
  journal/      types, store, runner (executes cells in order), sharing, samples, markdown
  lab/          lab mode: single workspace, its store and the add-to-journal conversion
  components/   ui (small Tailwind kit), editor (cells, workflow), inspect (inspection + quiz), outputs, viewer
  i18n/         en / de messages
public/data/    synthetic sample datasets (regenerate with python3 scripts/make_samples.py)
```

### Adding a block

1. Define it in `src/blockly/blocks.ts` (texts come from `blocks` in both dictionaries).
2. Add a generator in `src/blockly/generators.ts` that writes plain pandas/GeoPandas code
   (register imports with `addImports`; inside pipelines the data is the variable `df`).
3. If the step changes columns, teach `applyStep` in `src/blockly/schema.ts` about it.
4. Add it to the toolbox in `src/blockly/toolbox.ts`.

## Deployment

```bash
npm ci && npm run build
PORT=8787 SPOCKLY_DATA_DIR=/var/lib/spockly npm start   # app + short-link API
```

`server/index.ts` runs directly with Node 24 (no build step for the server) and serves
`dist/` plus the API. Put it behind a reverse proxy with HTTPS. Shared journals are gzip
files in `SPOCKLY_DATA_DIR`, one per link, plus a small metadata file with the hash of
the edit token. Back up or clean up that folder as needed; there is no expiry yet.

API (also available in `npm run dev` and `npm run preview`):

| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/journals` | publish, returns `{ id, token }` (rate-limited per IP) |
| `GET` | `/api/journals/:id` | read a published journal |
| `PUT` | `/api/journals/:id` | update, needs `Authorization: Bearer <token>` |
| `DELETE` | `/api/journals/:id` | delete, needs the token |

### In the local network

- Development: `npm run dev:lan` (Vite prints the network address, e.g. `http://192.168.2.154:5173/`).
- Production: `npm start` already listens on all network interfaces (port 8787).

Open spockly via that network address (not `localhost`) before sharing, because short
links use the address the app was opened with. On macOS, allow incoming connections for
Node if the firewall asks. Over plain `http://` the app works fully (no HTTPS-only browser
APIs are required); students' browsers still need internet access for Pyodide and the
map tiles.

## Scripts

- `npm run dev`: start the dev server
- `npm run dev:lan`: dev server reachable from other devices in the local network
- `npm run build`: type-check and build
- `npm run lint`: run oxlint
- `npm start`: production server (after `npm run build`)
