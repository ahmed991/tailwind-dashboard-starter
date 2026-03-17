"""
EUDR Deforestation Router — Sub-Task 3
NDVI time-series + change map via Element84 STAC (sentinel-2-l2a).
"""

import io
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
import stackstac
import rasterio.transform
from services.stac_service import search_stac, get_bounds

router = APIRouter(prefix="/eudr", tags=["eudr"])


class TimeSeriesRequest(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    cloud_cover: Optional[float] = 30
    satellite_sensor: Optional[str] = "sentinel-2"
    aggregate: Optional[str] = "scene"   # "scene" | "daily" | "weekly" | "monthly"


SENSOR_COLLECTION = {
    "sentinel-2": "sentinel-2-l2a",
    "landsat":    "landsat-c2-l2",
}


@router.post("/ndvi-timeseries")
def ndvi_timeseries(params: TimeSeriesRequest):
    """
    Search STAC (Element84) for scenes over the AOI+period,
    compute per-scene spatial-mean NDVI, return [{date, mean}].
    """
    collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
    bounds = get_bounds(params.geojson)

    items = search_stac(collection, bounds, params.start_date, params.end_date, params.cloud_cover)
    if not items:
        return {"time_series": [], "message": "No scenes found for the given parameters."}

    try:
        # Single stack — no resample, keep individual acquisition times
        stack = stackstac.stack(
            items=items,
            epsg=3857,
            assets=["nir", "red"],
            bounds_latlon=list(bounds),
            resolution=60,          # 60 m for fast per-scene compute
        ).compute()

        nir  = stack.sel(band="nir").astype(float)
        red  = stack.sel(band="red").astype(float)
        ndvi = (nir - red) / (nir + red + 1e-6)

        results = []
        for i, t in enumerate(stack.time.values):
            vals = ndvi.isel(time=i).values
            valid = vals[np.isfinite(vals) & (vals > -1) & (vals < 1)]
            if len(valid) == 0:
                continue
            results.append({
                "date": str(t)[:10],
                "mean": round(float(np.nanmean(valid)), 4),
            })

        results.sort(key=lambda x: x["date"])

        # Aggregate if requested
        agg = params.aggregate or "scene"
        if agg != "scene" and results:
            from collections import defaultdict
            from datetime import date as _date
            buckets = defaultdict(list)
            for pt in results:
                d = _date.fromisoformat(pt["date"])
                if agg == "daily":
                    key = pt["date"]
                elif agg == "weekly":
                    # ISO year-week e.g. "2023-W04"
                    key = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
                else:  # monthly
                    key = pt["date"][:7]   # "2023-01"
                buckets[key].append(pt["mean"])
            results = [
                {"date": k, "mean": round(float(np.mean(v)), 4)}
                for k, v in sorted(buckets.items())
            ]

        return {"time_series": results, "count": len(results), "aggregate": agg}

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[EUDR] ERROR:\n{tb}")
        raise HTTPException(status_code=500, detail=f"{str(e)}\n\n{tb}")


class ChangeMapRequest(BaseModel):
    geojson: dict
    start_date: str          # baseline period start
    end_date: str            # current period end
    cloud_cover: Optional[float] = 30
    satellite_sensor: Optional[str] = "sentinel-2"


def _median_ndvi(items, bounds, resolution=10):
    """Return 2-D spatial-median NDVI array for a set of STAC items."""
    stack = stackstac.stack(
        items=items,
        epsg=3857,
        assets=["nir", "red"],
        bounds_latlon=list(bounds),
        resolution=resolution,
    ).median("time", keep_attrs=True).compute()
    nir  = stack.sel(band="nir").astype(float)
    red  = stack.sel(band="red").astype(float)
    ndvi = (nir - red) / (nir + red + 1e-6)
    return ndvi.values   # 2-D array


@router.post("/ndvi-change-map/info")
def ndvi_change_map_info(params: ChangeMapRequest):
    """
    Return WGS84 bounds + PNG URL for an NDVI change map
    (current period minus baseline period).
    """
    bounds = get_bounds(params.geojson)
    west, south, east, north = float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])
    return {
        "bounds": [west, south, east, north],
        "png_url": "http://localhost:8000/eudr/ndvi-change-map/png",
        "params": params.dict(),
    }


@router.post("/ndvi-change-map/png")
def ndvi_change_map_png(params: ChangeMapRequest):
    """
    Compute NDVI change (end-period median − start-period median),
    render as transparent PNG with RdYlGn diverging colormap.
    """
    collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
    bounds = get_bounds(params.geojson)

    # Split date range in half for baseline vs current
    from datetime import date
    d0 = date.fromisoformat(params.start_date)
    d1 = date.fromisoformat(params.end_date)
    mid = d0 + (d1 - d0) / 2

    baseline_items = search_stac(collection, bounds, params.start_date, mid.isoformat(), params.cloud_cover)
    current_items  = search_stac(collection, bounds, mid.isoformat(),   params.end_date, params.cloud_cover)

    if not baseline_items or not current_items:
        raise HTTPException(404, "Not enough scenes for change detection — try a wider date range.")

    try:
        baseline_ndvi = _median_ndvi(baseline_items, bounds, resolution=10)
        current_ndvi  = _median_ndvi(current_items,  bounds, resolution=10)

        # Align shapes (take minimum common extent)
        h = min(baseline_ndvi.shape[0], current_ndvi.shape[0])
        w = min(baseline_ndvi.shape[1], current_ndvi.shape[1])
        change = current_ndvi[:h, :w] - baseline_ndvi[:h, :w]

        # Mask no-data
        mask = ~(np.isfinite(baseline_ndvi[:h, :w]) & np.isfinite(current_ndvi[:h, :w]))
        change_masked = np.ma.array(change, mask=mask)

        # Render — diverging RdYlGn, vmin/vmax symmetric at ±0.3
        _, ax = plt.subplots(figsize=(10, 10), dpi=200)
        ax.axis("off")
        cmap = plt.get_cmap("RdYlGn")
        cmap.set_bad(alpha=0)
        ax.imshow(change_masked, cmap=cmap, vmin=-0.3, vmax=0.3, interpolation="bilinear")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0,
                    facecolor="none", transparent=True, dpi=200)
        plt.close()
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
                                 headers={"Cache-Control": "no-cache"})

    except Exception as e:
        import traceback
        print(f"[EUDR change map] ERROR:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Shared request schema for the three risk endpoints ────────────────────────
class RiskRequest(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    cloud_cover: Optional[float] = 30
    satellite_sensor: Optional[str] = "sentinel-2"
    aggregate: Optional[str] = "monthly"   # "scene" | "weekly" | "monthly"


def _split_and_fetch(params: RiskRequest):
    """Fetch baseline + current STAC items and compute per-period mean NDVI series."""
    from datetime import date
    collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
    bounds = get_bounds(params.geojson)
    d0  = date.fromisoformat(params.start_date)
    d1  = date.fromisoformat(params.end_date)
    mid = d0 + (d1 - d0) // 2

    baseline_items = search_stac(collection, bounds, params.start_date, mid.isoformat(), params.cloud_cover)
    current_items  = search_stac(collection, bounds, mid.isoformat(),   params.end_date, params.cloud_cover)
    return bounds, baseline_items, current_items, mid


def _scene_ndvi_series(items, bounds):
    """Per-scene spatial-mean NDVI list [{date, mean}] at 60 m for speed."""
    stack = stackstac.stack(
        items=items, epsg=3857, assets=["nir", "red"],
        bounds_latlon=list(bounds), resolution=60,
    ).compute()
    nir  = stack.sel(band="nir").astype(float)
    red  = stack.sel(band="red").astype(float)
    ndvi = (nir - red) / (nir + red + 1e-6)
    out = []
    for i, t in enumerate(stack.time.values):
        vals  = ndvi.isel(time=i).values
        valid = vals[np.isfinite(vals) & (vals > -1) & (vals < 1)]
        if len(valid):
            out.append({"date": str(t)[:10], "mean": round(float(np.nanmean(valid)), 4)})
    return sorted(out, key=lambda x: x["date"])


def _aggregate_series(series, aggregate="monthly"):
    """Bucket a per-scene series into weekly or monthly composites."""
    if aggregate == "scene" or not series:
        return series
    from collections import defaultdict
    from datetime import date as _date
    buckets = defaultdict(list)
    for pt in series:
        d = _date.fromisoformat(pt["date"])
        key = pt["date"][:7] if aggregate == "monthly" else f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        buckets[key].append(pt["mean"])
    return [
        {"date": k, "mean": round(float(np.mean(v)), 4)}
        for k, v in sorted(buckets.items())
    ]


# ── 1. Forest → Ag Detection ─────────────────────────────────────────────────
@router.post("/forest-to-ag")
def forest_to_ag(params: RiskRequest):
    """
    Detect forest-to-agriculture transition.
    Forest: median NDVI > 0.50 in baseline.
    Agricultural: median NDVI < 0.30 in current period.
    """
    try:
        bounds, baseline_items, current_items, mid = _split_and_fetch(params)
        if not baseline_items or not current_items:
            raise HTTPException(404, "Insufficient scenes — widen the date range.")

        baseline_series = _aggregate_series(_scene_ndvi_series(baseline_items, bounds), params.aggregate)
        current_series  = _aggregate_series(_scene_ndvi_series(current_items,  bounds), params.aggregate)

        baseline_mean = float(np.mean([p["mean"] for p in baseline_series])) if baseline_series else 0
        current_mean  = float(np.mean([p["mean"] for p in current_series]))  if current_series  else 0

        forest_pixels    = sum(1 for p in baseline_series if p["mean"] > 0.50)
        ag_pixels        = sum(1 for p in current_series  if p["mean"] < 0.30)
        transition_score = max(0.0, baseline_mean - current_mean)
        detected         = baseline_mean > 0.45 and current_mean < 0.35

        # Identify the earliest date where NDVI crossed below 0.35
        transition_date = None
        for p in current_series:
            if p["mean"] < 0.35:
                transition_date = p["date"]
                break

        return {
            "detected":         detected,
            "transition_date":  transition_date,
            "baseline_ndvi":    round(baseline_mean, 4),
            "current_ndvi":     round(current_mean,  4),
            "ndvi_drop":        round(transition_score, 4),
            "forest_scenes":    forest_pixels,
            "ag_scenes":        ag_pixels,
            "baseline_period":  {"start": params.start_date, "end": mid.isoformat()},
            "current_period":   {"start": mid.isoformat(),   "end": params.end_date},
            "baseline_series":  baseline_series,
            "current_series":   current_series,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── Risk Zones PNG overlay ────────────────────────────────────────────────────
@router.post("/risk-zones/png")
def risk_zones_png(params: ChangeMapRequest):
    """
    Compute per-pixel NDVI median across the full period, classify as
    Low / Medium / High deforestation risk, return a transparent PNG.
      Green  = Low    (NDVI > 0.35)
      Yellow = Medium (0.20 – 0.35)
      Red    = High   (NDVI < 0.20)
    """
    collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
    bounds = get_bounds(params.geojson)
    items  = search_stac(collection, bounds, params.start_date, params.end_date, params.cloud_cover)
    if not items:
        raise HTTPException(404, "No scenes found — try a wider date range.")
    try:
        ndvi = _median_ndvi(items, bounds, resolution=10)

        # Classify: 1=Low (green), 2=Medium (yellow), 3=High (red), nan=no-data
        classified = np.full_like(ndvi, np.nan, dtype=float)
        valid = np.isfinite(ndvi)
        classified[valid & (ndvi >  0.35)] = 1
        classified[valid & (ndvi >= 0.20) & (ndvi <= 0.35)] = 2
        classified[valid & (ndvi <  0.20)] = 3

        cmap = mcolors.ListedColormap(["#22c55e", "#eab308", "#ef4444"])
        norm = mcolors.BoundaryNorm([0.5, 1.5, 2.5, 3.5], cmap.N)
        cmap.set_bad(alpha=0)

        fig, ax = plt.subplots(figsize=(10, 10), dpi=200)
        ax.axis("off")
        ax.imshow(classified, cmap=cmap, norm=norm, interpolation="nearest")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0,
                    facecolor="none", transparent=True, dpi=200)
        plt.close()
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
                                 headers={"Cache-Control": "no-cache"})
    except Exception as e:
        import traceback
        print(f"[EUDR risk map] ERROR:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/risk-zones/info")
def risk_zones_info(params: ChangeMapRequest):
    """Return WGS84 bounds for the risk zones PNG overlay."""
    bounds = get_bounds(params.geojson)
    west, south, east, north = float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])
    return {"bounds": [west, south, east, north]}


# ── 2. Risk Zones ─────────────────────────────────────────────────────────────
@router.post("/risk-zones")
def risk_zones(params: RiskRequest):
    """
    Classify deforestation risk from NDVI statistics across the full period.
      High   — NDVI min < 0.20 OR trend slope < −0.002/month
      Medium — NDVI min 0.20–0.35 OR moderate declining trend
      Low    — NDVI stable and min > 0.35
    """
    try:
        collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
        bounds     = get_bounds(params.geojson)
        items      = search_stac(collection, bounds, params.start_date, params.end_date, params.cloud_cover)
        if not items:
            raise HTTPException(404, "No scenes found.")

        series = _aggregate_series(_scene_ndvi_series(items, bounds), params.aggregate)
        if not series:
            raise HTTPException(422, "Could not compute NDVI for the AOI.")

        vals    = [p["mean"] for p in series]
        ndvi_min  = float(np.min(vals))
        ndvi_max  = float(np.max(vals))
        ndvi_mean = float(np.mean(vals))
        ndvi_std  = float(np.std(vals))

        # Linear trend (slope per observation step)
        n = len(vals)
        if n >= 3:
            xs    = np.arange(n, dtype=float)
            slope = float(np.polyfit(xs, vals, 1)[0])
        else:
            slope = 0.0

        # Risk classification
        if ndvi_min < 0.20 or slope < -0.005:
            risk = "High"
        elif ndvi_min < 0.35 or slope < -0.002:
            risk = "Medium"
        else:
            risk = "Low"

        # Confidence: more scenes = more confident
        confidence = min(100, int((n / 12) * 100))

        return {
            "risk":       risk,
            "ndvi_min":   round(ndvi_min,  4),
            "ndvi_max":   round(ndvi_max,  4),
            "ndvi_mean":  round(ndvi_mean, 4),
            "ndvi_std":   round(ndvi_std,  4),
            "trend_slope": round(slope,    6),
            "confidence": confidence,
            "scene_count": n,
            "series":     series,
            "thresholds": {
                "high":   "NDVI min < 0.20 or slope < −0.005/scene",
                "medium": "NDVI min 0.20–0.35 or slope < −0.002/scene",
                "low":    "NDVI stable, min > 0.35",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── 3. Deforestation Alerts ───────────────────────────────────────────────────
@router.post("/deforestation-alerts")
def deforestation_alerts(params: RiskRequest):
    """
    Flag consecutive-scene NDVI drops exceeding threshold as clearing events.
    Severity:
      Critical — drop > 0.25
      High     — drop 0.15–0.25
      Medium   — drop 0.08–0.15
    """
    try:
        collection = SENSOR_COLLECTION.get(params.satellite_sensor, "sentinel-2-l2a")
        bounds     = get_bounds(params.geojson)
        items      = search_stac(collection, bounds, params.start_date, params.end_date, params.cloud_cover)
        if not items:
            raise HTTPException(404, "No scenes found.")

        series = _aggregate_series(_scene_ndvi_series(items, bounds), params.aggregate)
        if len(series) < 2:
            raise HTTPException(422, "Need at least 2 scenes to detect alerts.")

        alerts = []
        for i in range(1, len(series)):
            drop = series[i-1]["mean"] - series[i]["mean"]
            if drop >= 0.08:
                if   drop >= 0.25: severity = "Critical"
                elif drop >= 0.15: severity = "High"
                else:              severity = "Medium"
                alerts.append({
                    "date":           series[i]["date"],
                    "from_date":      series[i-1]["date"],
                    "ndvi_before":    series[i-1]["mean"],
                    "ndvi_after":     series[i]["mean"],
                    "drop":           round(drop, 4),
                    "severity":       severity,
                })

        overall_status = (
            "Critical" if any(a["severity"] == "Critical" for a in alerts) else
            "High"     if any(a["severity"] == "High"     for a in alerts) else
            "Medium"   if alerts else
            "Clear"
        )

        return {
            "status":      overall_status,
            "alert_count": len(alerts),
            "alerts":      alerts,
            "series":      series,
            "period":      {"start": params.start_date, "end": params.end_date},
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))
