Stored copies of OpenStreetMap data for the block "lade OpenStreetMap-Daten". The block
loads them only when none of the Overpass servers answers.

- Source: OpenStreetMap via the Overpass API (lz4.overpass-api.de / z.overpass-api.de),
  recorded on 2026-10-27 (OSM data as of 2026-10-27 ~07:55–08:10 UTC; the cycle paths
  `radwege-*` ~10:56–10:57 UTC; see `osm3s` in each file).
- Licence: © OpenStreetMap contributors, Open Database License (ODbL) 1.0,
  https://www.openstreetmap.org/copyright — the app shows this credit with the data.
- Files: `<topic>-<area>.json`, the unchanged Overpass JSON answer to the query in
  `src/blocks/load_osm/presets.ts` (`OSM_TOPICS`), for the rectangles of the areas
  `muenster-mitte` and `muenster` (same as the openSenseMap block, `load_osem/presets.ts`),
  with `[out:json][timeout:60]`.
- Other cities (Berlin, Köln, …) have no copies, to keep the app small: when no server
  answers, the block shows the `muenster` copy and says so.
- Update: run the same queries again and replace the files; change `SNAPSHOT_DATE` in
  `src/blocks/load_osm/presets.ts`.
