Real responses from the NASA POWER API (power.larc.nasa.gov, API v2.10.0),
recorded on 2026-10-13 for tests. Not changed.

All requests: `longitude=7.6252&latitude=51.9625&community=RE&format=JSON` (Münster).

- `daily-muenster-2025-01.json` — `GET /api/temporal/daily/point?parameters=T2M,PRECTOTCORR,WS50M&start=20250101&end=20250110`
- `daily-recent-with-gaps.json` — `GET /api/temporal/daily/point?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&start=20260923&end=20261013`
  (the newest days are not available yet and come back as the fill value -999)
- `monthly-muenster-2024-2025.json` — `GET /api/temporal/monthly/point?parameters=T2M,PRECTOTCORR&start=2024&end=2025`
  (month "13" of each year is the annual value)
- `error-422-start-date.json` — the same request with `start=19700101&end=19700102` (HTTP 422)
