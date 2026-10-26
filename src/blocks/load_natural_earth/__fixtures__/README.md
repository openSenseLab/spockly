Real data from Natural Earth (public domain, naturalearthdata.com), version 5.1.2,
downloaded on 2026-10-26 from
`https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/`.

- `countries-110m-three.geojson` — `ne_110m_admin_0_countries.geojson`, trimmed to three
  countries (Fiji, France, Germany). Nothing else was changed. France's `ISO_A3` is `-99`
  in the source, which is how Natural Earth marks unknown values.
- `lakes-10m-three.geojson` — `ne_10m_lakes.geojson`, trimmed to Bodensee, "Lago di Como" and
  Lake Victoria. Nothing else was changed. The "Lago di Como" outline lies at 8.49–8.85° E,
  45.72–46.17° N, where Lago Maggiore is: a labelling error in the source.
- `lakes-europe-10m-two.geojson` — `ne_10m_lakes_europe.geojson`, trimmed to Lago di Como
  (the real one, 9.07–9.41° E) and CHIEMSEE (written in capitals in the source). Nothing else was changed.
