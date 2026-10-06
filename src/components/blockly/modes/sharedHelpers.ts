import type { PythonGenerator } from "blockly/python";

/**
 * Access helper for Blockly's internal definitions_ dictionary.
 * In Blockly's architecture, definitions_ is used to collect unique imports and
 * top-level definitions across all generated blocks so they are deduplicated and
 * prepended to the top of the program.
 */
type GeneratorWithDefinitions = {
  definitions_: Record<string, string>;
};

function getDefinitions(generator: PythonGenerator): Record<string, string> {
  return (generator as unknown as GeneratorWithDefinitions).definitions_;
}

/**
 * Sanitize a user-provided string to ensure it is a valid Python identifier.
 */
export function sanitizePythonIdentifier(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "df";
  }

  let clean = trimmed.replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(clean)) {
    clean = `_${clean}`;
  }
  return clean;
}

/**
 * Escape quotes and backslashes for safe embedding inside Python string literals.
 */
export function escapePythonString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Parse a comma-separated list of column names (as produced by a text block)
 * into a Python list literal. Handles surrounding quotes and trims whitespace.
 * Falls back to the original code if it is not a simple quoted string.
 */
export function parseCommaSeparatedList(code: string): string {
  const trimmed = code.trim();
  // Strip a single pair of surrounding double or single quotes.
  let inner = trimmed;
  if (
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"))
  ) {
    inner = inner.slice(1, -1);
  }

  const parts = inner
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "[]";
  }

  return `[${parts.map((part) => `"${escapePythonString(part)}"`).join(", ")}]`;
}

export function ensurePandasImport(generator: PythonGenerator): void {
  getDefinitions(generator)["import_pandas"] = "import pandas as pd";
}

export function ensureNumpyImport(generator: PythonGenerator): void {
  getDefinitions(generator)["import_numpy"] = "import numpy as np";
}

export function ensureMatplotlibImport(generator: PythonGenerator): void {
  getDefinitions(generator)["import_matplotlib"] = [
    "import matplotlib",
    "matplotlib.use('Agg')",
    "import matplotlib.pyplot as plt",
  ].join("\n");
}

/**
 * Register the imports needed to read local data files from the Pyodide FS.
 * The worker preloads `/data/...` files, so the generated code reads them directly.
 */
export function ensureDataPathImport(generator: PythonGenerator): void {
  getDefinitions(generator)["import_data_path"] = [
    "import os",
    "DATA_DIR = '/data'",
    "OUTPUT_DIR = '/output'",
    "os.makedirs(OUTPUT_DIR, exist_ok=True)",
  ].join("\n");
}

/**
 * Register the composable data-science helper functions used by the "Data Flow"
 * branch. Each helper is a small, named Python function that performs one
 * concept (clean, group, merge, plot, print) and returns a value. This keeps the
 * generated code readable and teaches the relationship between operations.
 */
export function ensureSpocklyHelpers(generator: PythonGenerator): void {
  getDefinitions(generator)["dsf_helpers"] = [
    // --- Data sources ---
    `def _spockly_load_geojson(path):`,
    `    import json`,
    `    with open(path, "r", encoding="utf-8") as _f:`,
    `        _geo = json.load(_f)`,
    `    _rows = []`,
    `    for _feature in _geo["features"]:`,
    `        _row = dict(_feature["properties"])`,
    `        _coords = _feature["geometry"]["coordinates"]`,
    `        _row["x"] = _coords[0]`,
    `        _row["y"] = _coords[1]`,
    `        _rows.append(_row)`,
    `    return pd.DataFrame(_rows)`,
    ``,
    // --- Transformations (DataFrame → DataFrame) ---
    `def _spockly_clean_types(df, column, kind):`,
    `    if kind == "DATETIME":`,
    `        df[column] = pd.to_datetime(df[column], errors="coerce")`,
    `        if df[column].dt.tz is not None:`,
    `            df[column] = df[column].dt.tz_convert("Europe/Berlin")`,
    `    else:`,
    `        df[column] = df[column].astype(str).str.replace(",", ".")`,
    `        df[column] = pd.to_numeric(df[column], errors="coerce")`,
    `    return df`,
    ``,
    `def _spockly_clean_missing(df, strategy, column=None):`,
    `    if strategy == "DROP_NA_COLUMN" and column:`,
    `        return df.dropna(subset=[column])`,
    `    return df.dropna()`,
    ``,
    `def _spockly_clean_filter(df, column, lo, hi):`,
    `    return df[(df[column] >= lo) & (df[column] <= hi)]`,
    ``,
    `def _spockly_clean_dedup(df, subset):`,
    `    if subset:`,
    `        return df.drop_duplicates(subset=list(subset))`,
    `    return df.drop_duplicates()`,
    ``,
    `def _spockly_groupby(df, group_cols, value_col, agg):`,
    `    out = df.groupby(list(group_cols))[value_col].agg(agg).reset_index()`,
    `    out.columns = [*out.columns[:-1], f"{value_col}_{agg}"]`,
    `    return out`,
    ``,
    `def _spockly_spatial_join(summary, locations, key):`,
    `    # Match IDs as text on both sides so the types align (e.g. "1003" vs 1003).`,
    `    _left = summary.copy()`,
    `    _right = locations.copy()`,
    `    if key in _left.columns:`,
    `        _left[key] = _left[key].astype(str)`,
    `    if key in _right.columns:`,
    `        _right[key] = _right[key].astype(str)`,
    `    _out = _left.merge(_right, on=key, how="inner")`,
    `    print(f"Stations with coordinates: {len(_out)}")`,
    `    return _out`,
    ``,
    // --- Inspection & analysis helpers ---
    `def _spockly_inspect(df):`,
    `    print("Shape (rows, columns):", df.shape)`,
    `    print("Columns:", list(df.columns))`,
    `    print("Data types:")`,
    `    print(df.dtypes)`,
    `    if "device_id" in df.columns:`,
    `        print("Number of stations:", df["device_id"].nunique())`,
    `    if "measurement_timestamp" in df.columns:`,
    `        try:`,
    `            _ts = pd.to_datetime(df["measurement_timestamp"], errors="coerce")`,
    `            print("Time range:", _ts.min(), "to", _ts.max())`,
    `        except Exception:`,
    `            pass`,
    `    print("Missing values per column:")`,
    `    print(df.isna().sum())`,
    `    return df`,
    ``,
    `def _spockly_count_categories(df, column):`,
    `    if column not in df.columns:`,
    `        print(f"Column '{column}' not found. Available columns: {list(df.columns)}")`,
    `        return pd.DataFrame()`,
    `    return df[column].value_counts(dropna=False).reset_index()`,
    ``,
    `def _spockly_station_compare(df, station_col, value_col):`,
    `    if len(df) == 0:`,
    `        print("No data to compare.")`,
    `        return pd.DataFrame()`,
    `    out = df.groupby(station_col)[value_col].agg(["mean", "min", "max", "count"]).reset_index()`,
    `    if "device_name" in df.columns and station_col != "device_name":`,
    `        names = df.groupby(station_col)["device_name"].first()`,
    `        out = out.merge(names, on=station_col, how="left")`,
    `    reference = df[value_col].mean()`,
    `    out["reference"] = reference`,
    `    out["deviation"] = out["mean"] - reference`,
    `    out = out.sort_values("deviation", ascending=False)`,
    `    print(f"Reference (mean of available readings): {reference:.2f}")`,
    `    if len(out) > 0:`,
    `        print("Highest mean station:", out.iloc[0][station_col])`,
    `        print("Lowest mean station:", out.iloc[-1][station_col])`,
    `    return out`,
    ``,
    `def _spockly_hourly(df, value_col, time_col):`,
    `    _df = df.copy()`,
    `    _df[time_col] = pd.to_datetime(_df[time_col], errors="coerce")`,
    `    _df = _df.dropna(subset=[time_col])`,
    `    _df = _df.set_index(time_col)`,
    `    _out = _df[value_col].resample("1h").mean().reset_index()`,
    `    _out.columns = [time_col, value_col]`,
    `    return _out.sort_values(time_col)`,
    ``,
    `def _spockly_hour_of_day(df, value_col, time_col):`,
    `    _df = df.copy()`,
    `    _df[time_col] = pd.to_datetime(_df[time_col], errors="coerce")`,
    `    _df = _df.dropna(subset=[time_col])`,
    `    _df["hour"] = _df[time_col].dt.hour`,
    `    _out = _df.groupby("hour")[value_col].mean().reset_index()`,
    `    _out.columns = ["hour", value_col]`,
    `    return _out.sort_values("hour")`,
    ``,
    // --- Visualizations (DataFrame → Figure) ---
    `def _spockly_save_plot(fig, base_name):`,
    `    import os`,
    `    os.makedirs("/output", exist_ok=True)`,
    `    _name = base_name`,
    `    _i = 1`,
    `    while os.path.exists(os.path.join("/output", _name)):`,
    `        _i += 1`,
    `        _name = f"{base_name.rsplit('.', 1)[0]}_{_i}.png"`,
    `    fig.savefig(os.path.join("/output", _name))`,
    `    plt.close('all')`,
    `    print(f"✓ Saved plot to '{_name}'.")`,
    `    return fig`,
    ``,
    `def _spockly_plot_timeseries(df, time_col, value_col, title):`,
    `    plt.close('all')`,
    `    _ts = df.set_index(time_col)[value_col]`,
    `    fig, ax = plt.subplots(figsize=(12, 5))`,
    `    ax.plot(_ts.index, _ts.values, color="black", linewidth=2)`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel(time_col)`,
    `    ax.set_ylabel(value_col)`,
    `    ax.grid(True, linestyle="--", alpha=0.3)`,
    `    fig.tight_layout()`,
    `    return _spockly_save_plot(fig, "muenster_timeseries.png")`,
    ``,
    `def _spockly_plot_bar(df, x_col, y_col, title):`,
    `    plt.close('all')`,
    `    fig, ax = plt.subplots(figsize=(10, max(4, len(df) * 0.3)))`,
    `    ax.bar(df[x_col].astype(str), df[y_col])`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel(x_col)`,
    `    ax.set_ylabel(y_col)`,
    `    ax.tick_params(axis="x", rotation=45)`,
    `    fig.tight_layout()`,
    `    _out_name = "muenster_deviation.png" if str(y_col).lower() == "deviation" or "deviation" in str(title).lower() else "bar.png"`,
    `    return _spockly_save_plot(fig, _out_name)`,
    ``,
    `def _spockly_plot_scatter(df, x_col, y_col, color_col, title):`,
    `    plt.close('all')`,
    `    fig, ax = plt.subplots(figsize=(8, 6))`,
    `    if color_col:`,
    `        _sc = ax.scatter(df[x_col], df[y_col], c=df[color_col], cmap="coolwarm", s=60, edgecolor="black")`,
    `        fig.colorbar(_sc, label=color_col)`,
    `    else:`,
    `        ax.scatter(df[x_col], df[y_col], s=60, edgecolor="black")`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel(x_col)`,
    `    ax.set_ylabel(y_col)`,
    `    ax.grid(True, linestyle="--", alpha=0.3)`,
    `    fig.tight_layout()`,
    `    return _spockly_save_plot(fig, "scatter.png")`,
    ``,
    `def _spockly_plot_location(df, x_col, y_col, color_col, title):`,
    `    plt.close('all')`,
    `    _missing = [c for c in [x_col, y_col, color_col] if c not in df.columns]`,
    `    if _missing:`,
    `        print(f"Missing columns for location plot: {_missing}")`,
    `        print(f"Available columns: {list(df.columns)}")`,
    `        return None`,
    `    _sub = df[[x_col, y_col, color_col]].dropna()`,
    `    if len(_sub) == 0:`,
    `        print("No rows with coordinates and values to plot.")`,
    `        return None`,
    `    fig, ax = plt.subplots(figsize=(9, 9))`,
    `    _plimit = _sub[color_col].max()`,
    `    _nlimit = _sub[color_col].min()`,
    `    if _plimit is None or _plimit != _plimit:`,
    `        _plimit = 1.0`,
    `    if _nlimit is None or _nlimit != _nlimit:`,
    `        _nlimit = 1.0`,
    `    print(f"Plotting {len(_sub)} points with color range: {_nlimit:.2f} to {_plimit:.2f}")`,
    `    _sc = ax.scatter(_sub[x_col], _sub[y_col], c=_sub[color_col], cmap="coolwarm", vmin=_nlimit, vmax=_plimit, s=120, edgecolor="black")`,
    `    fig.colorbar(_sc, label="Deviation from mean of available readings (K)")`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel("Longitude / x")`,
    `    ax.set_ylabel("Latitude / y")`,
    `    ax.set_aspect("equal", adjustable="datalim")`,
    `    fig.text(0.99, 0.01, "Data: Stadt Münster, Stadt Temperatur – dl-de/by-2-0", ha="right", fontsize=8, color="gray")`,
    `    fig.tight_layout()`,
    `    return _spockly_save_plot(fig, "muenster_station_map.png")`,
    ``,
    `def _spockly_plot_hourly_compare(df, time_col, value_col, station_col, title):`,
    `    plt.close('all')`,
    `    _df = df.copy()`,
    `    _df[time_col] = pd.to_datetime(_df[time_col], errors="coerce")`,
    `    _df = _df.dropna(subset=[time_col])`,
    `    _df = _df.set_index(time_col)`,
    `    _ref = _df[value_col].resample("1h").mean()`,
    `    fig, ax = plt.subplots(figsize=(14, 5))`,
    `    ax.plot(_ref.index, _ref.values, label="Mean of available readings", color="black", linewidth=2)`,
    `    if station_col in df.columns:`,
    `        for _sid in df[station_col].dropna().unique():`,
    `            _sub = _df[_df[station_col] == _sid][value_col].resample("1h").mean()`,
    `            ax.plot(_sub.index, _sub.values, label=str(_sid), linewidth=1)`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel(time_col)`,
    `    ax.set_ylabel(value_col)`,
    `    ax.grid(True, linestyle="--", alpha=0.3)`,
    `    ax.legend(fontsize=8)`,
    `    fig.tight_layout()`,
    `    return _spockly_save_plot(fig, "hourly_compare.png")`,
    ``,
    `def _spockly_plot_scatter_temp_hum(df, title):`,
    `    plt.close('all')`,
    `    fig, ax = plt.subplots(figsize=(8, 6))`,
    `    _sub = df[["temperature", "air_humidity"]].dropna()`,
    `    ax.scatter(_sub["temperature"], _sub["air_humidity"], s=30, alpha=0.5, edgecolor="none")`,
    `    ax.set_title(title)`,
    `    ax.set_xlabel("Temperature (°C)")`,
    `    ax.set_ylabel("Air humidity (%)")`,
    `    ax.grid(True, linestyle="--", alpha=0.3)`,
    `    fig.tight_layout()`,
    `    return _spockly_save_plot(fig, "temp_hum.png")`,
    ``,
    // --- Print (observe a value) ---
    `def _spockly_print(value, label=None):`,
    `    if label:`,
    `        print(f"=== {label} ===")`,
    `    if hasattr(value, "head"):`,
    `        print(value.head(20))`,
    `    else:`,
    `        print(value)`,
    ``,
  ].join("\n");
}

// =============================================================================
// GENERATOR-LEVEL HELPERS (emit expressions / statements)
// =============================================================================

/** Load a CSV file (local /data path or remote URL) into a DataFrame. */
export function generateLoadCsvCode(
  generator: PythonGenerator,
  varName: string,
  source: string,
): string {
  ensurePandasImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);
  const cleanSource = escapePythonString(source.trim());

  return [
    `# Load CSV into '${cleanVar}'`,
    `${cleanVar} = pd.read_csv("${cleanSource}")`,
    `print(f"Loaded '${cleanVar}': {len(${cleanVar})} rows, {len(${cleanVar}.columns)} columns")`,
    "",
  ].join("\n");
}

/** Load an uploaded CSV file (written to /data/uploaded.csv) into a DataFrame. */
export function generateUploadCsvCode(
  generator: PythonGenerator,
  varName: string,
): string {
  ensurePandasImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);

  return [
    `# Load uploaded CSV into '${cleanVar}'`,
    `${cleanVar} = pd.read_csv("/data/uploaded.csv")`,
    `print(f"Loaded uploaded CSV '${cleanVar}': {len(${cleanVar})} rows, {len(${cleanVar}.columns)} columns")`,
    "",
  ].join("\n");
}

/** Load a GeoJSON file and flatten its features into a DataFrame with x/y columns. */
export function generateLoadGeoJsonCode(
  generator: PythonGenerator,
  varName: string,
  source: string,
): string {
  ensurePandasImport(generator);
  const cleanVar = sanitizePythonIdentifier(varName);
  const cleanSource = escapePythonString(source.trim());

  return [
    `# Load GeoJSON into '${cleanVar}' and flatten features to x/y`,
    `import json`,
    `with open("${cleanSource}", "r", encoding="utf-8") as _f:`,
    `    _geo = json.load(_f)`,
    `_rows = []`,
    `for _feature in _geo["features"]:`,
    `    _row = dict(_feature["properties"])`,
    `    _coords = _feature["geometry"]["coordinates"]`,
    `    _row["x"] = _coords[0]`,
    `    _row["y"] = _coords[1]`,
    `    _rows.append(_row)`,
    `${cleanVar} = pd.DataFrame(_rows)`,
    `print(f"Loaded '${cleanVar}': {len(${cleanVar})} features")`,
    "",
  ].join("\n");
}

/** Export a variable to a CSV file in the output directory. */
export function generateExportCsvCode(
  generator: PythonGenerator,
  dfExpr: string,
  filename: string,
): string {
  ensurePandasImport(generator);
  ensureDataPathImport(generator);
  const cleanFilename = escapePythonString(filename.trim() || "result.csv");

  return [
    `# Export DataFrame to CSV`,
    `${dfExpr}.to_csv(os.path.join(OUTPUT_DIR, "${cleanFilename}"), index=False)`,
    `print(f"✓ Exported DataFrame to '${cleanFilename}'.")`,
    "",
  ].join("\n");
}

/** Export a matplotlib Figure to a PNG file in the output directory. */
export function generateExportPlotCode(
  generator: PythonGenerator,
  plotExpr: string,
  filename: string,
): string {
  ensureMatplotlibImport(generator);
  ensureDataPathImport(generator);
  const cleanFilename = escapePythonString(filename.trim() || "plot.png");

  return [
    `# Export plot to PNG`,
    `${plotExpr}.savefig(os.path.join(OUTPUT_DIR, "${cleanFilename}"))`,
    `plt.close('all')`,
    `print(f"✓ Exported plot to '${cleanFilename}'.")`,
    "",
  ].join("\n");
}
