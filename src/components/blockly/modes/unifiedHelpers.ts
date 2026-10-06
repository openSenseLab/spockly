import type { PythonGenerator } from "blockly/python";
import {
  ensureDataPathImport,
  ensureMatplotlibImport,
  ensureNumpyImport,
  ensurePandasImport,
  escapePythonString,
  sanitizePythonIdentifier,
} from "./sharedHelpers";

/** Load a dataset from a CSV URL or local /data path into a variable. */
export function generateLoadCode(
  generator: PythonGenerator,
  datasetUrl: string,
  varName: string,
): string {
  ensurePandasImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);
  const cleanUrl = escapePythonString(datasetUrl.trim());

  return [
    `# Load dataset`,
    `${cleanVar} = pd.read_csv("${cleanUrl}")`,
    `print(f"Loaded dataset into '${cleanVar}': {len(${cleanVar})} rows, {len(${cleanVar}.columns)} columns")`,
    "",
  ].join("\n");
}

/** Run a generic analysis action on a variable. */
export function generateAnalysisCode(
  generator: PythonGenerator,
  action: string,
  varName: string,
): string {
  ensurePandasImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);

  switch (action) {
    case "SUMMARY_STATS":
      return [
        `print(f"=== Summary Statistics (${cleanVar}) ===")`,
        `print(${cleanVar}.describe())`,
        "",
      ].join("\n");

    case "PREVIEW_HEAD":
      return [
        `print(f"=== First 5 Rows (${cleanVar}) ===")`,
        `print(${cleanVar}.head())`,
        "",
      ].join("\n");

    case "DATA_INFO":
      return [
        `print(f"=== Dataset Info (${cleanVar}) ===")`,
        `${cleanVar}.info()`,
        "",
      ].join("\n");

    case "CORRELATION":
      ensureNumpyImport(generator);
      return [
        `print(f"=== Correlation Matrix (${cleanVar}) ===")`,
        `print(${cleanVar}.select_dtypes(include=[np.number]).corr())`,
        "",
      ].join("\n");

    case "SHAPE":
      return [
        `print(f"Dataset '${cleanVar}' shape: {${cleanVar}.shape[0]} rows, {${cleanVar}.shape[1]} columns")`,
        "",
      ].join("\n");

    case "GROUPBY":
      ensureNumpyImport(generator);
      return [
        `# Group by first object column and aggregate the first numeric column`,
        `_g_col = ${cleanVar}.select_dtypes(include=["object"]).columns[0]`,
        `_v_col = ${cleanVar}.select_dtypes(include=[np.number]).columns[0]`,
        `_grouped = ${cleanVar}.groupby(_g_col)[_v_col].mean().reset_index()`,
        `print(f"=== Grouped by '{_g_col}' ===")`,
        `print(_grouped)`,
        "",
      ].join("\n");

    case "MERGE":
      return [
        `# Merge with a second dataset on the first common column`,
        `_merge_col = ${cleanVar}.columns[0]`,
        `_merged = ${cleanVar}.merge(_other, on=_merge_col, how="inner")`,
        `print(f"Merged on '{_merge_col}': {len(_merged)} rows")`,
        "",
      ].join("\n");

    default:
      return "";
  }
}

/** Generate and save a visualization for a variable. */
export function generateVisualizationCode(
  generator: PythonGenerator,
  chartType: string,
  title: string,
  varName: string,
): string {
  ensurePandasImport(generator);
  ensureMatplotlibImport(generator);
  ensureNumpyImport(generator);
  ensureDataPathImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);
  const cleanTitle = title.trim() || "Dataset Distribution";
  const escapedTitle = escapePythonString(cleanTitle);
  let outputFilename = "plot.png";

  const plotLines: string[] = [
    `# Generate visualization`,
    `plt.close('all')`,
  ];

  switch (chartType) {
    case "HIST":
      outputFilename = "muenster_histogram.png";
      plotLines.push(
        `${cleanVar}.hist(figsize=(8, 4))`,
        `plt.suptitle("${escapedTitle}")`,
      );
      break;
    case "BOX":
      outputFilename = "muenster_boxplot.png";
      plotLines.push(
        `plt.figure(figsize=(8, 4))`,
        `${cleanVar}.plot(kind="box", figsize=(8, 4))`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    case "LINE":
      outputFilename = "muenster_line.png";
      plotLines.push(
        `plt.figure(figsize=(8, 4))`,
        `${cleanVar}.plot(kind="line", figsize=(8, 4))`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    case "BAR":
      outputFilename = "muenster_deviation.png";
      plotLines.push(
        `plt.figure(figsize=(8, 4))`,
        `${cleanVar}.head(10).plot(kind="bar", figsize=(8, 4))`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    case "TIMESERIES":
      outputFilename = "muenster_timeseries.png";
      plotLines.push(
        `plt.figure(figsize=(12, 5))`,
        `_ts = ${cleanVar}.set_index(${cleanVar}.columns[0])`,
        `plt.plot(_ts.index, _ts.iloc[:, 0].values, color="black", linewidth=2)`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    case "SCATTER":
      outputFilename = "muenster_scatter.png";
      plotLines.push(
        `plt.figure(figsize=(8, 6))`,
        `_num = ${cleanVar}.select_dtypes(include=[np.number])`,
        `plt.scatter(_num.iloc[:, 0], _num.iloc[:, 1], s=60, edgecolor="black")`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    case "SPATIAL":
      outputFilename = "muenster_station_map.png";
      plotLines.push(
        `plt.figure(figsize=(9, 9))`,
        `_num = ${cleanVar}.select_dtypes(include=[np.number])`,
        `_points = plt.scatter(_num.iloc[:, 0], _num.iloc[:, 1], c=_num.iloc[:, 2], cmap="coolwarm", s=120, edgecolor="black")`,
        `plt.colorbar(_points)`,
        `plt.title("${escapedTitle}")`,
      );
      break;
    default:
      plotLines.push(
        `plt.figure(figsize=(8, 4))`,
        `${cleanVar}.plot()`,
        `plt.title("${escapedTitle}")`,
      );
      break;
  }

  plotLines.push(
    `plt.tight_layout()`,
    `plt.savefig(os.path.join(OUTPUT_DIR, "${outputFilename}"))`,
    `plt.close('all')`,
    `print(f"✓ Visualization '${cleanTitle}' (${chartType}) generated and saved to the output directory.")`,
    `print(f"  Summary: {len(${cleanVar})} rows plotted across numeric features.")`,
    "",
  );

  return plotLines.join("\n");
}

/** Generate one canonical, self-contained Unified block workshop procedure. */
export function generateWorkshopStarterCode(
  generator: PythonGenerator,
  output: string,
  title: string,
  dataset: string,
  locationDataset: string,
  preprocess: string,
  analysis: string,
): string {
  ensurePandasImport(generator);
  ensureNumpyImport(generator);
  ensureMatplotlibImport(generator);
  ensureDataPathImport(generator);
  const escapedTitle = escapePythonString(title.trim() || "Münster temperature investigation");
  const escapedDataset = escapePythonString(dataset.trim());
  const escapedLocationDataset = escapePythonString(locationDataset.trim());

  const lines = [
    `# ========================================`,
    `# Unified block workshop starter: ${output}`,
    `# ========================================`,
    `df_raw = pd.read_csv("${escapedDataset}", sep=None, engine="python", encoding="utf-8")`,
    `df = df_raw.copy()`,
    `# Decisions: preprocess=${preprocess}, analyze=${analysis}, output=${output}`,
  ];

  if (preprocess === "CLEAN_SENSOR") {
    lines.push(
      `df["measurement_timestamp"] = pd.to_datetime(df["measurement_timestamp"], errors="coerce")`,
      `for _col in ["temperature", "air_humidity"]:`,
      `    df[_col] = pd.to_numeric(df[_col].astype(str).str.replace(",", "."), errors="coerce")`,
      `df = df.dropna(subset=["measurement_timestamp", "temperature"])`,
      `df = df[(df["temperature"] >= -30) & (df["temperature"] <= 50)]`,
      `df = df.drop_duplicates(subset=["device_id", "measurement_timestamp"])`,
    );
  } else if (preprocess === "CLEAN_MISSING") {
    lines.push(`df = df.dropna()`);
  }

  if (output === "TIMESERIES") {
    lines.push(
      `df_time = df.set_index("measurement_timestamp")`,
      `city_hourly = df_time["temperature"].resample("1h").mean()`,
      `plt.figure(figsize=(14, 5))`,
      `plt.plot(city_hourly.index, city_hourly.values, color="black", linewidth=2)`,
      `plt.title("${escapedTitle}")`,
      `plt.xlabel("Time")`,
      `plt.ylabel("Temperature (°C)")`,
      `plt.grid(True, linestyle="--", alpha=0.3)`,
      `plt.tight_layout()`,
      `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_timeseries.png"))`,
      `plt.close("all")`,
      `print("Saved canonical output: muenster_timeseries.png")`,
    );
  } else {
    lines.push(
      `station_stats = df.groupby(["device_id", "device_name"])["temperature"].agg(["mean", "min", "max", "count"]).reset_index()`,
      `station_stats["deviation"] = station_stats["mean"] - df["temperature"].mean()`,
      `station_stats = station_stats.sort_values("deviation", ascending=False).round(2)`,
    );

    if (output === "LOCATION") {
      lines.push(
        `with open("${escapedLocationDataset}", "r", encoding="utf-8") as _f:`,
        `    _geo = json.load(_f) if "json" in globals() else __import__("json").load(_f)`,
        `_rows = []`,
        `for _feature in _geo["features"]:`,
        `    _row = dict(_feature["properties"])`,
        `    _coords = _feature["geometry"]["coordinates"]`,
        `    _row["x"], _row["y"] = _coords[0], _coords[1]`,
        `    _rows.append(_row)`,
        `stations = pd.DataFrame(_rows)`,
        `station_stats["device_id"] = station_stats["device_id"].astype(str)`,
        `stations["device_id"] = stations["device_id"].astype(str)`,
        `station_map = station_stats.merge(stations[["device_id", "x", "y"]], on="device_id", how="inner")`,
        `_limit = station_map["deviation"].abs().max()`,
        `plt.figure(figsize=(9, 9))`,
        `_points = plt.scatter(station_map["x"], station_map["y"], c=station_map["deviation"], cmap="coolwarm", vmin=-_limit, vmax=_limit, s=120, edgecolor="black")`,
        `plt.colorbar(_points, label="Deviation from mean of available readings (K)")`,
        `plt.title("${escapedTitle}")`,
        `plt.xlabel("Longitude / x")`,
        `plt.ylabel("Latitude / y")`,
        `plt.gca().set_aspect("equal", adjustable="datalim")`,
        `plt.tight_layout()`,
        `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_station_map.png"))`,
        `station_map.to_csv(os.path.join(OUTPUT_DIR, "muenster_station_statistics.csv"), index=False)`,
        `plt.close("all")`,
        `print("Saved canonical outputs: muenster_station_map.png, muenster_station_statistics.csv")`,
      );
    } else {
      lines.push(
        `plt.figure(figsize=(10, max(4, len(station_stats) * 0.3)))`,
        `_colors = ["darkred" if _value > 0 else "steelblue" for _value in station_stats["deviation"]]`,
        `plt.barh(station_stats["device_name"], station_stats["deviation"], color=_colors)`,
        `plt.axvline(0, color="black", linewidth=1)`,
        `plt.title("${escapedTitle}")`,
        `plt.xlabel("Deviation (K)")`,
        `plt.gca().invert_yaxis()`,
        `plt.tight_layout()`,
        `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_deviation.png"))`,
        `station_stats.to_csv(os.path.join(OUTPUT_DIR, "muenster_station_statistics.csv"), index=False)`,
        `plt.close("all")`,
        `print("Saved canonical outputs: muenster_deviation.png, muenster_station_statistics.csv")`,
      );
    }
  }

  return lines.join("\n") + "\n";
}

/** Generate the full Münster urban-heat unified workflow. */
export function generateHeatIslandsUnifiedCode(
  generator: PythonGenerator,
): string {
  ensurePandasImport(generator);
  ensureNumpyImport(generator);
  ensureMatplotlibImport(generator);
  ensureDataPathImport(generator);

  const sourceNote = "Data: Stadt Münster, Stadt Temperatur – dl-de/by-2-0";

  return [
    `# ========================================`,
    `# Example investigation – station comparison`,
    `# ========================================`,
    `# 1) Load measurements (separator detected, as in the reference script)`,
    `df_raw = pd.read_csv(os.path.join(DATA_DIR, "muenster_measurements_72h.csv"), sep=None, engine="python", encoding="utf-8")`,
    `print(f"Loaded measurements: {len(df_raw)} rows")`,
    ``,
    `# 2) Clean: convert timestamp to datetime (and to Europe/Berlin if tz-aware)`,
    `df = df_raw.copy()`,
    `df["measurement_timestamp"] = pd.to_datetime(df["measurement_timestamp"], errors="coerce")`,
    `if df["measurement_timestamp"].dt.tz is not None:`,
    `    df["measurement_timestamp"] = df["measurement_timestamp"].dt.tz_convert("Europe/Berlin")`,
    ``,
    `# 3) Clean: convert numbers (handles German decimal commas)`,
    `for _col in ["temperature", "air_humidity"]:`,
    `    df[_col] = df[_col].astype(str).str.replace(",", ".")`,
    `    df[_col] = pd.to_numeric(df[_col], errors="coerce")`,
    ``,
    `# 4) Inspect quality flags (without filtering, as in the reference)`,
    `print("Temperature flags:")`,
    `print(df["flag_temperature"].value_counts(dropna=False))`,
    `print("Missing values per column:")`,
    `print(df.isna().sum())`,
    ``,
    `# 5) Clean: drop missing, filter plausible range, drop duplicates`,
    `_rows_before = len(df)`,
    `df = df.dropna(subset=["measurement_timestamp", "temperature"])`,
    `df = df[(df["temperature"] >= -30) & (df["temperature"] <= 50)]`,
    `df = df.drop_duplicates(subset=["device_id", "measurement_timestamp"])`,
    `_rows_after = len(df)`,
    `cleaning_report = pd.DataFrame({`,
    `    "stage": ["before", "after"],`,
    `    "rows": [_rows_before, _rows_after],`,
    `    "stations": [df_raw["device_id"].nunique(), df["device_id"].nunique()],`,
    `})`,
    `print(f"Rows removed during cleaning: {_rows_before - _rows_after}")`,
    `print(f"Cleaned measurements: {len(df)} rows")`,
    `print("Time range:", df["measurement_timestamp"].min(), "to", df["measurement_timestamp"].max())`,
    ``,
    `# 6) Analyze: per-station statistics and record-weighted reference`,
    `station_stats = df.groupby(["device_id", "device_name"])["temperature"].agg(["mean", "min", "max", "count"]).reset_index()`,
    `city_mean = df["temperature"].mean()`,
    `station_stats["deviation"] = station_stats["mean"] - city_mean`,
    `station_stats = station_stats.sort_values("deviation", ascending=False).round(2)`,
    `print("Mean of available sensor readings:", round(city_mean, 2), "°C")`,
    `print(station_stats)`,
    `hottest_station = station_stats.iloc[0]["device_name"]`,
    `coolest_station = station_stats.iloc[-1]["device_name"]`,
    `print("Highest mean among sampled stations:", hottest_station, "| Lowest mean:", coolest_station)`,
    ``,
    `# 7) Analyze: daily cycle and correlation`,
    `df["hour"] = df["measurement_timestamp"].dt.hour`,
    `hour_of_day = df.groupby("hour")["temperature"].mean().reset_index()`,
    `hour_of_day.columns = ["hour", "mean_temperature"]`,
    `correlation = df[["temperature", "air_humidity"]].corr().reset_index()`,
    `print("Correlation temperature/humidity:")`,
    `print(df[["temperature", "air_humidity"]].corr().round(2))`,
    ``,
    `# 8) Visualize: time series (reference vs highest/lowest mean stations)`,
    `df_time = df.set_index("measurement_timestamp")`,
    `city_hourly = df_time["temperature"].resample("1h").mean()`,
    `hot_hourly = df_time[df_time["device_name"] == hottest_station]["temperature"].resample("1h").mean()`,
    `cool_hourly = df_time[df_time["device_name"] == coolest_station]["temperature"].resample("1h").mean()`,
    `hourly_comparison = pd.DataFrame({`,
    `    "time": city_hourly.index,`,
    `    "mean_of_available_readings": city_hourly.values,`,
    `    "highest_mean_station": hot_hourly.values,`,
    `    "lowest_mean_station": cool_hourly.values,`,
    `})`,
    `plt.figure(figsize=(14, 5))`,
    `plt.plot(city_hourly.index, city_hourly.values, label="Mean of available readings", color="black", linewidth=2)`,
    `plt.plot(hot_hourly.index, hot_hourly.values, label="Highest mean: " + hottest_station, color="darkred")`,
    `plt.plot(cool_hourly.index, cool_hourly.values, label="Lowest mean: " + coolest_station, color="steelblue")`,
    `plt.title("Air temperature in Münster – sampled stations")`,
    `plt.xlabel("Time")`,
    `plt.ylabel("Temperature (°C)")`,
    `plt.grid(True, linestyle="--", alpha=0.3)`,
    `plt.legend()`,
    `plt.figtext(0.99, 0.01, "${sourceNote}", ha="right", fontsize=8, color="gray")`,
    `plt.tight_layout()`,
    `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_timeseries.png"))`,
    `plt.close('all')`,
    ``,
    `# 9) Visualize: daily cycle`,
    `plt.figure(figsize=(10, 4))`,
    `plt.bar(hour_of_day["hour"], hour_of_day["mean_temperature"], color="orange")`,
    `plt.title("Average daily temperature cycle – Münster")`,
    `plt.xlabel("Hour of the day")`,
    `plt.ylabel("Mean temperature (°C)")`,
    `plt.xticks(range(0, 24))`,
    `plt.tight_layout()`,
    `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_daily_cycle.png"))`,
    `plt.close('all')`,
    ``,
    `# 10) Visualize: deviation bar chart`,
    `plt.figure(figsize=(10, max(4, len(station_stats) * 0.3)))`,
    `_colors = ["darkred" if v > 0 else "steelblue" for v in station_stats["deviation"]]`,
    `plt.barh(station_stats["device_name"], station_stats["deviation"], color=_colors)`,
    `plt.axvline(0, color="black", linewidth=1)`,
    `plt.title("Deviation from the mean of available sensor readings")`,
    `plt.xlabel("Deviation (K)")`,
    `plt.gca().invert_yaxis()`,
    `plt.tight_layout()`,
    `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_deviation.png"))`,
    `plt.close('all')`,
    ``,
    `# 11) Load stations and merge with statistics`,
    `import json`,
    `with open(os.path.join(DATA_DIR, "muenster_stations.geojson"), "r", encoding="utf-8") as _f:`,
    `    _geo = json.load(_f)`,
    `_rows = []`,
    `for _feature in _geo["features"]:`,
    `    _row = dict(_feature["properties"])`,
    `    _coords = _feature["geometry"]["coordinates"]`,
    `    _row["x"] = _coords[0]`,
    `    _row["y"] = _coords[1]`,
    `    _rows.append(_row)`,
    `stations = pd.DataFrame(_rows)`,
    `stations["device_id"] = stations["device_id"].astype(str)`,
    `station_stats["device_id"] = station_stats["device_id"].astype(str)`,
    `station_map = station_stats.merge(stations[["device_id", "x", "y"]], on="device_id", how="inner")`,
    `print("Stations with coordinates:", len(station_map))`,
    ``,
    `# 12) Visualize: location plot (coordinates, not a metric map)`,
    `_limit = station_map["deviation"].abs().max()`,
    `plt.figure(figsize=(9, 9))`,
    `_points = plt.scatter(station_map["x"], station_map["y"], c=station_map["deviation"], cmap="coolwarm", vmin=-_limit, vmax=_limit, s=120, edgecolor="black")`,
    `plt.colorbar(_points, label="Deviation from mean of available readings (K)")`,
    `plt.title("Münster station locations – deviation from mean of available readings")`,
    `plt.xlabel("Longitude / x")`,
    `plt.ylabel("Latitude / y")`,
    `plt.gca().set_aspect("equal", adjustable="datalim")`,
    `plt.figtext(0.99, 0.01, "${sourceNote}", ha="right", fontsize=8, color="gray")`,
    `plt.tight_layout()`,
    `plt.savefig(os.path.join(OUTPUT_DIR, "muenster_station_map.png"))`,
    `plt.close('all')`,
    ``,
    `# 13) Export results`,
    `station_map.to_csv(os.path.join(OUTPUT_DIR, "muenster_station_statistics.csv"), index=False)`,
    `print("Inspectable tables: df_raw (raw), df (cleaned), cleaning_report, station_stats, hourly_comparison, hour_of_day, correlation, station_map")`,
    `print("Note: projected basemap and interactive map are omitted (not available in the browser runtime).")`,
    `print("Results saved in folder:", OUTPUT_DIR)`,
    "",
  ].join("\n");
}
