"""spockly runtime: the app's side of running learner code.

Generated code is plain pandas / GeoPandas / Altair / folium and never calls this
module. The runtime only provides what a notebook front end provides:

- ``display(obj)``: shows tables, charts (Altair), maps (folium) and values,
  like ``display`` in Jupyter;
- ``print`` capture, in order with the other outputs;
- profiles of loaded datasets for the inspection task;
- the column names of all DataFrames, for the block dropdowns.
"""

import builtins
import json
import math
import os
import re
import sys

import numpy as np
import pandas as pd

MAX_TABLE_ROWS = 500
PREVIEW_ROWS = 20
MAP_PREVIEW_FEATURES = 1000
STRUCTURE_SAMPLE = 200
STRUCTURE_MAX_KEYS = 60
STRUCTURE_MAX_DEPTH = 6

LAT_NAMES = ("lat", "latitude", "breite", "breitengrad")
LON_NAMES = ("lon", "lng", "long", "longitude", "laenge", "länge", "laengengrad")

#: Helper variables the generated code uses; not offered as datasets in dropdowns.
TEMPORARY_NAMES = {"df", "joined", "nearest", "points", "grid", "cells", "chart", "m", "centre", "centres"}

_OUTPUTS = []


class SpocklyError(Exception):
    def __init__(self, code, arg=""):
        super().__init__(f"SPK|{code}|{arg}")


# ---------------------------------------------------------------------------
# JSON-safe values
# ---------------------------------------------------------------------------


def _clean(value):
    if value is None:
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        return None if math.isnan(number) or math.isinf(number) else number
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list, tuple)):
        text = json.dumps(value, ensure_ascii=False, default=str)
        return text if len(text) <= 200 else text[:197] + "…"
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return str(value)


def _geometry_label(geometry):
    if geometry is None:
        return None
    interface = getattr(geometry, "__geo_interface__", geometry)
    if not isinstance(interface, dict):
        return None
    if interface.get("type") == "Point":
        lon, lat = interface["coordinates"][:2]
        return f"Point ({lon}, {lat})"
    return interface.get("type")


def _is_geometry_column(series):
    return series.name == "geometry" or type(series.dtype).__name__ == "GeometryDtype"


def _records(df, limit, columns=None):
    columns = [c for c in (columns or list(df.columns)) if c in df.columns]
    geometry_columns = {c for c in columns if _is_geometry_column(df[c])}
    records = []
    for row in df.head(limit)[columns].itertuples(index=False, name=None):
        records.append(
            {
                str(column): _geometry_label(value) if column in geometry_columns else _clean(value)
                for column, value in zip(columns, row)
            }
        )
    return records


def _dumps(payload):
    return json.dumps(payload, allow_nan=False, default=str)


def _kind(series):
    if _is_geometry_column(series):
        return "geometry"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    values = series.dropna()
    if len(values) == 0:
        return "text"
    unique = _safe_nunique(values)
    if unique <= 50 and unique / len(values) <= 0.5:
        return "category"
    return "text"


def _fields(df, columns=None):
    columns = columns or list(df.columns)
    return [{"name": str(c), "kind": _kind(df[c])} for c in columns if c in df.columns]


def _safe_nunique(series):
    try:
        return int(series.nunique(dropna=True))
    except TypeError:
        return int(series.dropna().astype(str).nunique())


def _find_column(df, names):
    lookup = {str(c).lower(): c for c in df.columns}
    for name in names:
        if name in lookup and pd.api.types.is_numeric_dtype(df[lookup[name]]):
            return lookup[name]
    return None


def _lat_lon_columns(df):
    lat = _find_column(df, LAT_NAMES)
    lon = _find_column(df, LON_NAMES)
    return (lat, lon) if lat is not None and lon is not None else (None, None)


def _geometries(df):
    """GeoJSON geometry dicts (or None) aligned with df rows: shapely objects, dicts or lat/lon columns."""
    geometry_columns = [c for c in df.columns if _is_geometry_column(df[c])]
    if geometry_columns:
        result = []
        for value in df[geometry_columns[0]]:
            interface = getattr(value, "__geo_interface__", value)
            result.append(interface if isinstance(interface, dict) and not getattr(value, "is_empty", False) else None)
        return result
    lat, lon = _lat_lon_columns(df)
    if lat is None:
        return None
    return [_point(x, y) for x, y in zip(df[lon], df[lat])]


def _point(lon, lat):
    try:
        lon, lat = float(lon), float(lat)
    except (TypeError, ValueError):
        return None
    if math.isnan(lon) or math.isnan(lat) or abs(lat) > 90 or abs(lon) > 180:
        return None
    return {"type": "Point", "coordinates": [lon, lat]}



def _iter_positions(coordinates):
    if not coordinates:
        return
    if isinstance(coordinates[0], (int, float)):
        yield coordinates
        return
    for part in coordinates:
        yield from _iter_positions(part)


def _geometry_positions(geometry):
    if not geometry:
        return
    if geometry.get("type") == "GeometryCollection":
        for part in geometry.get("geometries", []):
            yield from _geometry_positions(part)
        return
    yield from _iter_positions(geometry.get("coordinates"))


def _representative_point(geometry):
    if not geometry:
        return None
    if geometry.get("type") == "Point":
        return tuple(geometry["coordinates"][:2])
    positions = list(_geometry_positions(geometry))
    if not positions:
        return None
    return (
        sum(p[0] for p in positions) / len(positions),
        sum(p[1] for p in positions) / len(positions),
    )


def _bbox(geometries):
    xs, ys = [], []
    for geometry in geometries:
        for position in _geometry_positions(geometry):
            xs.append(position[0])
            ys.append(position[1])
    if not xs:
        return None
    return [min(xs), min(ys), max(xs), max(ys)]



def _to_geojson(df, limit):
    geometries = _geometries(df)
    if geometries is None:
        raise SpocklyError("not_spatial")
    columns = [c for c in df.columns if c != "geometry"]
    features = []
    for geometry, record in zip(geometries[:limit], _records(df, limit, columns)):
        if geometry is None:
            continue
        features.append({"type": "Feature", "geometry": geometry, "properties": record})
    return {"type": "FeatureCollection", "features": features}



def _json_type(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def _structure(value, depth=0):
    """Describe the shape of a JSON value: keys, types, array lengths, an example."""
    kind = _json_type(value)
    node = {"type": kind}
    if kind == "object":
        if depth >= STRUCTURE_MAX_DEPTH:
            node["truncated"] = True
            return node
        node["children"] = [
            {"key": str(key), **_structure(child, depth + 1)}
            for key, child in list(value.items())[:STRUCTURE_MAX_KEYS]
        ]
    elif kind == "array":
        node["length"] = len(value)
        if value and depth < STRUCTURE_MAX_DEPTH:
            node["items"] = _merge_structures([_structure(item, depth + 1) for item in value[:STRUCTURE_SAMPLE]])
    elif kind != "null":
        text = str(value)
        node["example"] = text if len(text) <= 60 else text[:57] + "…"
    return node


def _merge_structures(nodes):
    """Combine the shapes of many array items into one (keys united, types joined)."""
    types = []
    for node in nodes:
        for kind in node["type"].split("|"):
            if kind not in types:
                types.append(kind)
    merged = {"type": "|".join(types)}
    objects = [node for node in nodes if "children" in node]
    if objects:
        order, by_key = [], {}
        for node in objects:
            for child in node["children"]:
                if child["key"] not in by_key:
                    order.append(child["key"])
                    by_key[child["key"]] = []
                by_key[child["key"]].append({k: v for k, v in child.items() if k != "key"})
        merged["children"] = [{"key": key, **_merge_structures(by_key[key])} for key in order[:STRUCTURE_MAX_KEYS]]
    arrays = [node for node in nodes if node["type"] == "array"]
    if arrays:
        merged["length"] = max(node.get("length", 0) for node in arrays)
        items = [node["items"] for node in arrays if "items" in node]
        if items:
            merged["items"] = _merge_structures(items)
    examples = [node["example"] for node in nodes if "example" in node]
    if examples:
        merged["example"] = examples[0]
    if any(node.get("truncated") for node in nodes):
        merged["truncated"] = True
    return merged



def _profile_column(series):
    kind = _kind(series)
    profile = {
        "name": str(series.name),
        "kind": kind,
        "dtype": str(series.dtype),
        "missing": int(series.isna().sum()),
        "unique": _safe_nunique(series) if kind != "geometry" else int(series.notna().sum()),
    }
    values = series.dropna()
    if kind == "number" and len(values):
        finite = values[np.isfinite(values.astype(float))].astype(float)
        if len(finite):
            profile.update(
                {
                    "min": _clean(finite.min()),
                    "max": _clean(finite.max()),
                    "mean": _clean(finite.mean()),
                    "median": _clean(finite.median()),
                    "std": _clean(finite.std()) if len(finite) > 1 else None,
                }
            )
            bins = min(12, max(1, _safe_nunique(finite)))
            counts, edges = np.histogram(finite, bins=bins)
            profile["histogram"] = [
                {"start": float(edges[i]), "end": float(edges[i + 1]), "count": int(counts[i])}
                for i in range(len(counts))
            ]
    elif kind == "date" and len(values):
        profile.update({"min": _clean(values.min()), "max": _clean(values.max())})
    elif kind in ("category", "text", "boolean") and len(values):
        counts = values.astype(str).value_counts().head(6)
        profile["top"] = [{"value": str(k), "count": int(v)} for k, v in counts.items()]
    elif kind == "geometry":
        types = pd.Series([getattr(g, "geom_type", None) or (g.get("type") if isinstance(g, dict) else None) for g in values]).dropna().value_counts()
        profile["top"] = [{"value": str(k), "count": int(v)} for k, v in types.items()]
    return profile


def _wgs84(df):
    """Maps and bounding boxes need longitude/latitude; reproject other coordinate systems."""
    crs = getattr(df, "crs", None)
    if crs is None or not hasattr(df, "to_crs"):
        return df
    try:
        return df if crs.to_epsg() == 4326 else df.to_crs("EPSG:4326")
    except Exception:  # noqa: BLE001 - a broken CRS should not stop the inspection
        return df


def _profile(name, df):
    geo = _wgs84(df)
    geometries = _geometries(geo)
    spatial = geometries is not None
    geometry_types = sorted({g["type"] for g in geometries or [] if g}) if spatial else []
    crs = getattr(df, "crs", None)
    return {
        "name": name,
        "rows": int(len(df)),
        "columns": [_profile_column(df[c]) for c in df.columns],
        "spatial": spatial,
        "geometryTypes": geometry_types,
        "bbox": _bbox(geometries) if spatial else None,
        "preview": _records(df, PREVIEW_ROWS),
        "mapPreview": _to_geojson(geo, MAP_PREVIEW_FEATURES) if spatial else None,
        "crs": crs.to_string() if crs is not None else None,
    }


def _download_name(url):
    """Same rule as the code generator: the file name a downloaded GIS file is saved under."""
    name = re.split(r"[?#]", url)[0].rstrip("/").split("/")[-1]
    return re.sub(r"[^\w.-]+", "_", name) or "download.zip"


def _layers(kind, ref):
    """All layers of a multi-layer GIS file (zip with several Shapefiles, GeoPackage)."""
    if kind not in ("file", "url"):
        return None
    path = ref if kind == "file" else _download_name(ref)
    if not path.lower().endswith((".zip", ".gpkg")) or not os.path.exists(path):
        return None
    try:
        import fiona  # noqa: PLC0415 - only present when GIS files are read

        return list(fiona.listlayers(f"zip://{path}" if path.lower().endswith(".zip") else path))
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Notebook side: display, print capture, inspection, schemas
# ---------------------------------------------------------------------------


class _PrintCapture:
    """Turns print() calls into text outputs, keeping their order among other outputs."""

    def write(self, value):
        if value:
            if _OUTPUTS and _OUTPUTS[-1]["type"] == "text":
                _OUTPUTS[-1]["text"] += value
            else:
                _OUTPUTS.append({"type": "text", "text": value})
        return len(value)

    def flush(self):
        pass


def _table(df, title=""):
    if not isinstance(df.index, pd.RangeIndex):
        df = df.reset_index()
    return {
        "type": "table",
        "title": str(title or ""),
        "columns": _fields(df),
        "rows": _records(df, MAX_TABLE_ROWS),
        "totalRows": int(len(df)),
    }


def _output_for(obj):
    module = type(obj).__module__ or ""
    if module.startswith("pandas.io.formats.style"):
        return _table(obj.data, getattr(obj, "caption", "") or "")
    if isinstance(obj, pd.DataFrame):
        return _table(obj)
    if isinstance(obj, pd.Series):
        return _table(obj.to_frame(obj.name if obj.name is not None else "value"))
    if module.startswith("altair") and hasattr(obj, "to_dict"):
        try:
            spec = obj.to_dict()
        except Exception as error:  # noqa: BLE001
            if type(error).__name__ == "MaxRowsError":
                raise SpocklyError("too_many_rows") from error
            raise
        return {"type": "vega", "title": "", "spec": spec}
    if module.startswith("folium") and hasattr(obj, "get_root"):
        return {"type": "html", "title": "", "html": obj.get_root().render()}
    if isinstance(obj, (bool, np.bool_, int, float, np.integer, np.floating)):
        return {"type": "value", "label": "", "value": _clean(obj)}
    return {"type": "text", "text": str(obj)}


def display(*objects):
    """Show tables, charts, maps and values below the blocks (like Jupyter's display)."""
    for obj in objects:
        _OUTPUTS.append(_output_for(obj))


builtins.display = display


def _json_info(namespace, name):
    raw = namespace.get(f"{name}_json")
    if raw is None or not isinstance(raw, (dict, list)):
        return None
    is_geojson = isinstance(raw, dict) and raw.get("type") in ("FeatureCollection", "Feature")
    return {
        "kind": "geojson" if is_geojson else "json",
        "structure": _structure(raw),
        "recordsPath": ["features"] if is_geojson else ([] if isinstance(raw, list) else None),
        "geometryKey": "geometry" if is_geojson else None,
    }


MAX_PICK_VALUES = 1000


def _distinct_values(series):
    """Sorted distinct values of a column, for the value picker of "is one of" (small columns only)."""
    if _is_geometry_column(series) or pd.api.types.is_datetime64_any_dtype(series):
        return None
    values = series.dropna()
    try:
        unique = pd.unique(values)
    except TypeError:
        return None
    if len(unique) == 0 or len(unique) > MAX_PICK_VALUES:
        return None
    cleaned = [_clean(value) for value in unique]
    return sorted(cleaned, key=lambda value: (isinstance(value, str), value))


def _schema_fields(df):
    fields = []
    for column in df.columns:
        field = {"name": str(column), "kind": _kind(df[column])}
        values = _distinct_values(df[column])
        if values is not None:
            field["values"] = values
        fields.append(field)
    return fields


def schemas(namespace):
    return {
        name: _schema_fields(value)
        for name, value in namespace.items()
        if isinstance(value, pd.DataFrame) and not name.startswith("_") and name not in TEMPORARY_NAMES
    }


def coordinate_systems(namespace):
    """CRS of every GeoDataFrame, so the blocks can compute in it (metric) or via UTM (degrees)."""
    systems = {}
    for name, value in namespace.items():
        crs = getattr(value, "crs", None)
        if not isinstance(value, pd.DataFrame) or crs is None or name.startswith("_") or name in TEMPORARY_NAMES:
            continue
        try:
            systems[name] = {"crs": crs.to_string(), "projected": bool(crs.is_projected)}
        except Exception:  # noqa: BLE001
            continue
    return systems


def begin():
    _OUTPUTS.clear()
    sys.stdout = _PrintCapture()


def end(namespace, inspect=()):
    """Collect outputs; profile the datasets a data block loaded (inspect = [{name, kind, ref}])."""
    sys.stdout = sys.__stdout__
    outputs = list(_OUTPUTS)
    _OUTPUTS.clear()
    for entry in inspect:
        entry = dict(entry)
        value = namespace.get(entry["name"])
        if isinstance(value, pd.DataFrame):
            profile = _profile(entry["name"], value)
            profile["json"] = _json_info(namespace, entry["name"])
            profile["layers"] = _layers(entry["kind"], entry["ref"])
            outputs.append({"type": "inspection", "source": {"kind": entry["kind"], "ref": entry["ref"]}, "profile": profile})
    return _dumps({"outputs": outputs, "schemas": schemas(namespace), "crs": coordinate_systems(namespace)})
