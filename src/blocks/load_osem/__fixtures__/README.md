Real responses from the openSenseMap API (api.opensensemap.org), recorded on
2026-10-07 for tests and trimmed to a few items. Nothing else was changed.

- `boxes-muenster.json` — 7 boxes picked from
  `GET /boxes?bbox=7.55,51.92,7.70,52.00&format=json`: active and inactive,
  outdoor and indoor, with and without a "Temperatur" sensor. "Active" in tests
  is relative to 2026-10-07T00:00Z.
- `sensor-data.json` — first 40 values of
  `GET /boxes/591f578c51d34600116a8ea5/data/591f578c51d34600116a8ea6?from-date=2026-10-06T00:00:00Z&to-date=2026-10-07T00:00:00Z&format=json`
- `tags.json` — first 25 entries of `GET /tags`
- `box-outside-area.json` — one box from
  `GET /boxes?format=json&bbox=7.5897085,51.9205942,7.6647924,51.989764&exposure=outdoor`
  whose current location is in Berlin: the area query also returns boxes that
  are no longer in the area.
- `sensor-data-humidity.json` — first 40 values of the same box's "rel. Luftfeuchte" sensor
  (`…/data/591f578c51d34600116a8ea7`, same period), recorded on 2026-10-19
