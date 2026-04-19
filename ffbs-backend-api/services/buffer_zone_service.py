"""
Buffer Zone Assessment Service

Evaluates buffer zone effectiveness by:
1. Building an outward buffer ring around the farm boundary polygon (shapely + geopandas)
2. Fetching Sentinel-2 NDVI + SCL within the ring bounding box via stackstac
3. Classifying SCL land-cover adjacent to the farm boundary
4. Computing a composite drift-risk score (NDVI quality + bare-soil fraction)
5. Flagging EU Organic Regulation 2018/848 width compliance

API contract
------------
Input  : geojson (FeatureCollection), start_date, end_date, buffer_m (default 50), cloud_cover
Output : dict — see `assess()` docstring for field list
"""

import numpy as np
import geopandas as gpd
import stackstac
from shapely.geometry import mapping
from shapely.ops import unary_union

from services.stac_service import search_stac

# ── Sentinel-2 SCL class registry ────────────────────────────────────────────
SCL_CLASSES = {
    0:  "No Data",
    1:  "Saturated/Defective",
    2:  "Dark Area",
    3:  "Cloud Shadow",
    4:  "Vegetation",
    5:  "Bare Soil",
    6:  "Water",
    7:  "Low-Prob Cloud",
    8:  "Med-Prob Cloud",
    9:  "High-Prob Cloud",
    10: "Thin Cirrus",
    11: "Snow/Ice",
}

# SCL classes that indicate high contamination / drift risk when dominant in buffer
HIGH_RISK_SCL = {5, 2}  # Bare soil, dark/disturbed area → likely conventional tillage
WATER_SCL     = {6}     # Water body adjacency → runoff risk


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _build_buffer_ring(geojson: dict, buffer_m: float) -> tuple:
    """
    Expand the farm boundary outward by buffer_m metres and return the ring.

    Returns
    -------
    ring_geojson : dict   — GeoJSON FeatureCollection of the ring only
    outer_bounds : tuple  — (minx, miny, maxx, maxy) in WGS84 for STAC search
    """
    gdf = gpd.GeoDataFrame.from_features(geojson["features"], crs="EPSG:4326")
    gdf_proj = gdf.to_crs("EPSG:3857")  # metric CRS so buffer_m is in metres

    merged    = unary_union(gdf_proj.geometry)
    outer     = merged.buffer(buffer_m)
    ring      = outer.difference(merged)

    ring_gdf  = gpd.GeoDataFrame(geometry=[ring],  crs="EPSG:3857").to_crs("EPSG:4326")
    outer_gdf = gpd.GeoDataFrame(geometry=[outer], crs="EPSG:3857").to_crs("EPSG:4326")

    ring_geojson = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": mapping(geom), "properties": {}}
            for geom in ring_gdf.geometry
        ],
    }
    outer_bounds = tuple(outer_gdf.total_bounds)  # (minx, miny, maxx, maxy)
    return ring_geojson, outer_bounds


# ── Main assess function ──────────────────────────────────────────────────────

def assess(
    geojson:     dict,
    start_date:  str,
    end_date:    str,
    buffer_m:    float = 50.0,
    cloud_cover: float = 30.0,
) -> dict:
    """
    Full buffer zone assessment.

    Returns a dict containing:
      buffer_m            : float  — buffer width used (metres)
      overall_risk        : str    — "Low" / "Medium" / "High"
      composite_score     : float  — 0–100 (lower = safer)
      risk                : str    — alias of overall_risk (legacy frontend compat)
      mean_ndvi           : float  — (legacy compat)
      min_ndvi            : float  — (legacy compat)
      std_ndvi            : float  — (legacy compat)
      buffer_failures     : int    — months with mean NDVI < 0.25 (legacy compat)
      failure_months      : list   — ["YYYY-MM", ...]
      ndvi                : dict   — {mean, min, std, risk, failure_months}
      neighbour_land_cover: dict   — {class_name: {pixels, pct}, ...}
      bare_soil_pct       : float  — % buffer pixels classified as bare/disturbed soil
      water_adj_pct       : float  — % buffer pixels classified as water
      eu_compliant        : bool   — True if mean NDVI > 0.30 (active vegetated buffer)
      scene_count         : int    — number of Sentinel-2 time steps used
      series              : list   — [{date, mean}, ...] monthly NDVI for charting
      bounds              : list   — [minx, miny, maxx, maxy]
      error               : str    — present only on failure
    """

    # 1. Build buffer ring and bounding box
    ring_geojson, bounds = _build_buffer_ring(geojson, buffer_m)

    # 2. Search Sentinel-2 L2A
    items = search_stac("sentinel-2-l2a", bounds, start_date, end_date, cloud_cover)
    if not items:
        return {
            "error":    "No Sentinel-2 scenes found for the given date range and AOI.",
            "buffer_m": buffer_m,
            "bounds":   list(bounds),
            "buffer_ring_geojson": ring_geojson,
        }

    # 3. Build monthly median stack — NDVI bands + SCL
    try:
        stack = stackstac.stack(
            items=items,
            epsg=3857,
            assets=["nir", "red", "scl"],
            bounds_latlon=list(bounds),
            resolution=20,
        ).resample(time="MS").median("time", keep_attrs=True).compute()
    except Exception as e:
        return {"error": f"Raster processing failed: {e}", "buffer_m": buffer_m}

    # 4. Compute NDVI over all timesteps
    nir  = stack.sel(band="nir").astype(float)
    red  = stack.sel(band="red").astype(float)
    ndvi = (nir - red) / (nir + red + 1e-6)

    ndvi_all  = ndvi.values.flatten()
    ndvi_all  = ndvi_all[np.isfinite(ndvi_all) & (ndvi_all > -1) & (ndvi_all < 1)]

    mean_ndvi = float(np.nanmean(ndvi_all)) if len(ndvi_all) else 0.0
    min_ndvi  = float(np.nanmin(ndvi_all))  if len(ndvi_all) else 0.0
    std_ndvi  = float(np.nanstd(ndvi_all))  if len(ndvi_all) else 0.0

    # 5. Per-timestep failure detection (mean NDVI < 0.25 → insufficient buffer)
    failure_months = []
    series = []
    for i, t in enumerate(stack.time.values):
        vals  = ndvi.isel(time=i).values.flatten()
        valid = vals[np.isfinite(vals) & (vals > -1) & (vals < 1)]
        if len(valid):
            ts_mean = float(np.nanmean(valid))
            series.append({"date": str(t)[:7], "mean": round(ts_mean, 4)})
            if ts_mean < 0.25:
                failure_months.append(str(t)[:7])

    ndvi_risk = (
        "Low"    if mean_ndvi > 0.45 else
        "High"   if mean_ndvi < 0.25 else
        "Medium"
    )

    # 6. SCL neighbour land-cover — median SCL across all timesteps
    scl = stack.sel(band="scl")
    scl_median = np.nanmedian(scl.values, axis=0).flatten().astype(int)
    total_px   = int((scl_median > 0).sum())  # exclude no-data pixels

    scl_breakdown = {}
    for cls_id, cls_name in SCL_CLASSES.items():
        count = int((scl_median == cls_id).sum())
        if count > 0:
            scl_breakdown[cls_name] = {
                "pixels": count,
                "pct":    round(count / max(total_px, 1) * 100, 1),
            }

    high_risk_px  = int(sum((scl_median == c).sum() for c in HIGH_RISK_SCL))
    water_px      = int(sum((scl_median == c).sum() for c in WATER_SCL))
    high_risk_pct = round(high_risk_px / max(total_px, 1) * 100, 1)
    water_pct     = round(water_px     / max(total_px, 1) * 100, 1)

    # 7. Composite risk score
    #    60 % NDVI quality (sparse buffer = higher score)
    #    40 % bare-soil fraction (bare soil = contamination pathway)
    ndvi_score      = max(0.0, min(100.0, (1.0 - mean_ndvi) * 100.0))
    bare_soil_score = float(high_risk_pct)
    composite_score = round(0.6 * ndvi_score + 0.4 * bare_soil_score, 1)

    overall_risk = (
        "Low"    if composite_score < 25 else
        "High"   if composite_score > 55 else
        "Medium"
    )

    # 8. EU Organic Regulation 2018/848 compliance
    #    Buffer is considered compliant if it shows active vegetation (NDVI > 0.30)
    eu_compliant = mean_ndvi > 0.30

    return {
        # ── Spatial metadata ────────────────────────────────────────────────
        "buffer_m":         buffer_m,
        "bounds":           list(bounds),
        "scene_count":      len(stack.time.values),

        # ── Risk assessment ─────────────────────────────────────────────────
        "overall_risk":     overall_risk,
        "composite_score":  composite_score,
        "eu_compliant":     eu_compliant,

        # ── NDVI details ────────────────────────────────────────────────────
        "ndvi": {
            "mean":           round(mean_ndvi, 4),
            "min":            round(min_ndvi, 4),
            "std":            round(std_ndvi, 4),
            "risk":           ndvi_risk,
            "failure_months": failure_months,
        },

        # ── SCL land-cover at buffer boundary ───────────────────────────────
        "neighbour_land_cover": scl_breakdown,
        "bare_soil_pct":    high_risk_pct,
        "water_adj_pct":    water_pct,

        # ── Monthly series for charting ─────────────────────────────────────
        "series":           series,

        # ── Buffer ring geometry for map display ────────────────────────────
        "buffer_ring_geojson": ring_geojson,

        # ── Legacy fields — existing DetailPanel frontend reads these ────────
        "risk":             overall_risk,
        "mean_ndvi":        round(mean_ndvi, 4),
        "min_ndvi":         round(min_ndvi, 4),
        "std_ndvi":         round(std_ndvi, 4),
        "buffer_failures":  len(failure_months),
        "failure_months":   failure_months,
    }
