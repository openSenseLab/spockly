"""Generate the synthetic sample datasets shipped in public/data.

The values are invented for teaching purposes (realistic ranges, deliberate
missing values) and must not be read as real measurements.
Run: python3 scripts/make_samples.py
"""

import csv
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(42)

CENTER_LAT, CENTER_LON = 51.9607, 7.6261


def stations():
    kinds = [("traffic", 34, 9), ("urban", 24, 6), ("suburban", 18, 5), ("rural", 13, 4)]
    rows = []
    for i in range(1, 61):
        kind, pm10_mean, pm10_sd = rng.choices(kinds, weights=[3, 4, 3, 2])[0]
        spread = {"traffic": 0.03, "urban": 0.04, "suburban": 0.07, "rural": 0.11}[kind]
        lat = CENTER_LAT + rng.gauss(0, spread)
        lon = CENTER_LON + rng.gauss(0, spread * 1.6)
        pm10 = max(3.0, rng.gauss(pm10_mean, pm10_sd))
        pm25 = max(1.5, pm10 * rng.uniform(0.55, 0.75))
        no2 = max(4.0, rng.gauss(pm10_mean * 1.2, 7))
        temperature = rng.gauss(11.5 if kind != "rural" else 10.4, 0.8)
        installed = date(2019, 1, 1) + timedelta(days=rng.randint(0, 5 * 365))
        row = {
            "station": f"S{i:02d}",
            "type": kind,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "pm10": round(pm10, 1),
            "pm25": round(pm25, 1),
            "no2": round(no2, 1),
            "temperature": round(temperature, 1),
            "installed": installed.isoformat(),
        }
        # Deliberate gaps so learners meet missing values during inspection.
        if rng.random() < 0.08:
            row["pm25"] = ""
        if rng.random() < 0.05:
            row["no2"] = ""
        rows.append(row)
    with open(OUT / "stations.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def zones():
    features = []
    size_lat, size_lon = 0.06, 0.1
    for r, row_name in enumerate("ABC"):
        for c in range(3):
            south = CENTER_LAT - 1.5 * size_lat + r * size_lat
            west = CENTER_LON - 1.5 * size_lon + c * size_lon
            ring = [
                [round(west, 5), round(south, 5)],
                [round(west + size_lon, 5), round(south, 5)],
                [round(west + size_lon, 5), round(south + size_lat, 5)],
                [round(west, 5), round(south + size_lat, 5)],
                [round(west, 5), round(south, 5)],
            ]
            central = r == 1 and c == 1
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "zone": f"{row_name}{c + 1}",
                        "population": rng.randint(60000, 90000) if central else rng.randint(8000, 35000),
                        "green_share": round(rng.uniform(0.1, 0.25) if central else rng.uniform(0.3, 0.7), 2),
                    },
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                }
            )
    with open(OUT / "zones.geojson", "w") as handle:
        json.dump({"type": "FeatureCollection", "features": features}, handle)


def weather():
    rows = []
    start = date(2024, 1, 1)
    for day in range(366):
        current = start + timedelta(days=day)
        seasonal = 10.5 - 8.5 * math.cos(2 * math.pi * (day - 15) / 366)
        temp = seasonal + rng.gauss(0, 2.6)
        rain = 0.0 if rng.random() < 0.52 else round(rng.expovariate(1 / 4.2), 1)
        rows.append(
            {
                "date": current.isoformat(),
                "month": current.strftime("%m"),
                "temp_mean": round(temp, 1),
                "temp_max": round(temp + rng.uniform(2, 7), 1),
                "precipitation_mm": rain,
                "sunshine_h": round(max(0.0, rng.gauss(4.5 - 3 * math.cos(2 * math.pi * day / 366), 2.5)), 1),
            }
        )
    with open(OUT / "weather.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    stations()
    zones()
    weather()
    print("written to", OUT)
