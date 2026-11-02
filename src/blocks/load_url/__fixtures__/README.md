Real answers from web addresses (most of them examples of the block), recorded
on 2026-10-28 unless noted and trimmed (nothing else changed):

- `usgs-2.5_week-three.geojson` — https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson
  (U.S. Geological Survey), the first 3 of 365 features.
- `brightsky-muenster-four-hours.json` (no longer an example, used as an own address) — https://api.brightsky.dev/weather?lat=51.96&lon=7.63&date=2026-10-20&last_date=2026-10-27
  (Bright Sky, data of the Deutscher Wetterdienst), the first 4 of the hourly
  `weather` records; `sources` (3 stations) as delivered.
- `pegelonline-stations-two.json` (no longer an example, used as an own address) — https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json
  (PEGELONLINE), only the stations CELLE and MÜNSTER OW out of 786.
- `gbif-kraniche-muenster-2024-three.json` (recorded 2026-11-02) — https://api.gbif.org/v1/occurrence/search?taxonKey=2474950&decimalLatitude=51.8401448,52.0600251&decimalLongitude=7.4737853,7.7743634&year=2024&hasCoordinate=true&limit=300
  (GBIF, common crane sightings in Münster in 2024), the first 3 of 126 results;
  `count`, `endOfRecords` etc. as delivered.
- `owid-co2-per-capita-germany-three.csv` (no longer an example, used as an own CSV address) — https://ourworldindata.org/grapher/co-emissions-per-capita.csv
  (Our World in Data), the header and Germany's last 3 years out of 26 509 rows.
- `emsc-germany-2025-three.geojson` (recorded 2026-11-02) — https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=47&maxlat=55.1&minlon=5.8&maxlon=15.1&start=2025-01-01&end=2025-12-31&minmag=2&limit=1000
  (EMSC), the first 3 of 193 features; `metadata.count` set to 3.
- `eonet-storms-2025-three.geojson` (recorded 2026-11-02) — https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=severeStorms&status=all&start=2025-01-01&end=2025-12-31
  (NASA EONET), the first 3 of 1935 features (track points of 97 storms). The
  answer comes with Content-Type application/rss+xml although it is GeoJSON.
