"""
Organic & Regenerative Compliance Router — Sub-Task 4
Six STAC-backed indicators using Sentinel-2 (NDVI) and Sentinel-1 (SAR).
"""

import io
import os
import time
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import stackstac
from services.stac_service import search_stac, get_bounds


def _compute_with_retry(stack, retries=3, delay=2):
    """Retry stackstac .compute() on transient S3/rasterio read errors."""
    for attempt in range(retries):
        try:
            return stack.compute()
        except Exception as e:
            if attempt < retries - 1 and ("RasterioIOError" in str(e) or "Read failed" in str(e)):
                print(f"⚠️ S3 read error (attempt {attempt+1}/{retries}), retrying in {delay}s: {e}")
                time.sleep(delay)
            else:
                raise

RESULTS_DIR = "results"
SERVER_URL = os.getenv("FASTAPI_PUBLIC_URL", "http://localhost:8000")

router = APIRouter(prefix="/organic", tags=["organic"])

STAC_ENDPOINT = "https://earth-search.aws.element84.com/v1"

SENSOR_COLLECTION = {
    "sentinel-2": "sentinel-2-l2a",
    "sentinel-1": "sentinel-1-grd",
    "landsat":    "landsat-c2-l2",
}


class OrganicRequest(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    cloud_cover: Optional[float] = 30
    satellite_sensor: Optional[str] = "sentinel-2"
    buffer_m: Optional[float] = 50.0  # metres — used only by /buffer-zone


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _s2_ndvi_series(geojson, start_date, end_date, cloud_cover=30):
    """Monthly S2 NDVI series over the AOI."""
    bounds = get_bounds(geojson)
    items  = search_stac("sentinel-2-l2a", bounds, start_date, end_date, cloud_cover)
    if not items:
        return [], bounds

    stack = _compute_with_retry(stackstac.stack(
        items=items, epsg=3857, assets=["nir", "red"],
        bounds_latlon=list(bounds), resolution=60,
    ))

    nir  = stack.sel(band="nir").astype(float)
    red  = stack.sel(band="red").astype(float)
    ndvi = (nir - red) / (nir + red + 1e-6)

    scene_series = []
    for i, t in enumerate(stack.time.values):
        vals  = ndvi.isel(time=i).values
        valid = vals[np.isfinite(vals) & (vals > -1) & (vals < 1)]
        if len(valid):
            scene_series.append({"date": str(t)[:10], "mean": round(float(np.nanmean(valid)), 4)})
    scene_series.sort(key=lambda x: x["date"])

    # Monthly composite
    from collections import defaultdict
    buckets = defaultdict(list)
    for pt in scene_series:
        buckets[pt["date"][:7]].append(pt["mean"])
    monthly = [{"date": k, "mean": round(float(np.mean(v)), 4)} for k, v in sorted(buckets.items())]
    return monthly, bounds


def _s1_sar_series(geojson, start_date, end_date):
    """
    Monthly Sentinel-1 mean VH backscatter series over the AOI.
    NOTE: sentinel-1-grd on Element84 is stored on requester-pays S3.
    Reading pixels requires AWS credentials + AWS_REQUEST_PAYER=requester.
    Returns [] with a warning if access is denied.
    """
    bounds = get_bounds(geojson)
    items  = search_stac("sentinel-1-grd", bounds, start_date, end_date, cloud_cover=100)
    if not items:
        return []

    try:
        stack = _compute_with_retry(stackstac.stack(
            items=items, epsg=3857, assets=["vh"],
            bounds_latlon=list(bounds), resolution=20,
        ))

        vh = stack.sel(band="vh").astype(float)
        scene_series = []
        for i, t in enumerate(stack.time.values):
            vals  = vh.isel(time=i).values
            valid = vals[np.isfinite(vals) & (vals > 0)]
            if len(valid):
                scene_series.append({"date": str(t)[:10], "vh_mean": round(float(np.nanmean(valid)), 6)})
        scene_series.sort(key=lambda x: x["date"])

        from collections import defaultdict
        buckets = defaultdict(list)
        for pt in scene_series:
            buckets[pt["date"][:7]].append(pt["vh_mean"])
        return [{"date": k, "vh_mean": round(float(np.mean(v)), 6)} for k, v in sorted(buckets.items())]

    except Exception as e:
        print(f"[SAR] Could not read S1 pixels (likely requester-pays): {e}")
        return []


# ── 1. Crop Rotation Detection ─────────────────────────────────────────────────
@router.post("/crop-rotation")
def crop_rotation(params: OrganicRequest):
    """
    Detect crop rotation by comparing per-year NDVI peak month.
    Rotation is indicated when peak month shifts by ≥ 2 months across years.
    """
    try:
        monthly, _ = _s2_ndvi_series(params.geojson, params.start_date, params.end_date, params.cloud_cover)
        if not monthly:
            raise HTTPException(404, "No Sentinel-2 scenes found.")

        # Group by year
        from collections import defaultdict
        by_year = defaultdict(list)
        for pt in monthly:
            by_year[pt["date"][:4]].append(pt)

        years = []
        for yr, pts in sorted(by_year.items()):
            if not pts:
                continue
            peak = max(pts, key=lambda p: p["mean"])
            years.append({
                "year":       yr,
                "peak_month": int(peak["date"][5:7]),
                "peak_ndvi":  peak["mean"],
                "mean_ndvi":  round(float(np.mean([p["mean"] for p in pts])), 4),
            })

        peak_months = [y["peak_month"] for y in years]
        rotation_detected = len(set(peak_months)) > 1 and (
            len(years) >= 2 and max(peak_months) - min(peak_months) >= 2
        )

        return {
            "detected": rotation_detected,
            "years":    years,
            "year_count": len(years),
            "peak_month_spread": max(peak_months) - min(peak_months) if peak_months else 0,
            "series":   monthly,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── 2. Cover Crop Verification ─────────────────────────────────────────────────
@router.post("/cover-crop")
def cover_crop(params: OrganicRequest):
    """
    Verify cover crop presence in off-season (Nov–Feb) using S2 NDVI.
    If satellite_sensor=sentinel-1, additionally checks VH backscatter > threshold.
    NDVI > 0.25 in off-season confirms active cover cropping.
    """
    try:
        monthly, _ = _s2_ndvi_series(params.geojson, params.start_date, params.end_date, params.cloud_cover)
        if not monthly:
            raise HTTPException(404, "No Sentinel-2 scenes found.")

        off_season = [pt for pt in monthly if int(pt["date"][5:7]) in (11, 12, 1, 2)]
        growing    = [pt for pt in monthly if int(pt["date"][5:7]) not in (11, 12, 1, 2)]

        off_mean  = float(np.mean([p["mean"] for p in off_season])) if off_season else 0
        grow_mean = float(np.mean([p["mean"] for p in growing]))    if growing    else 0
        verified  = len(off_season) > 0 and off_mean > 0.25

        sar_result = None
        if params.satellite_sensor == "sentinel-1":
            sar = _s1_sar_series(params.geojson, params.start_date, params.end_date)
            if sar:
                sar_off = [pt for pt in sar if int(pt["date"][5:7]) in (11, 12, 1, 2)]
                sar_mean = float(np.mean([p["vh_mean"] for p in sar_off])) if sar_off else None
                sar_result = {
                    "off_season_vh_mean": round(sar_mean, 6) if sar_mean else None,
                    "vegetation_present": sar_mean is not None and sar_mean > 0.05,
                    "sar_series": sar,
                }
            else:
                sar_result = {
                    "note": "S1 GRD data is on requester-pays S3. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REQUEST_PAYER=requester to enable.",
                    "off_season_vh_mean": None, "vegetation_present": None, "sar_series": [],
                }

        return {
            "verified":        verified,
            "off_season_ndvi": round(off_mean, 4),
            "growing_ndvi":    round(grow_mean, 4),
            "off_season_obs":  len(off_season),
            "ndvi_contrast":   round(grow_mean - off_mean, 4),
            "sar":             sar_result,
            "series":          monthly,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── 3. Compost Application Map ─────────────────────────────────────────────────
@router.post("/compost-map")
def compost_map(params: OrganicRequest):
    """
    Detect rapid spring NDVI green-up (Mar–May) as a proxy for organic amendment.
    An uplift > 0.05 relative to autumn/winter baseline suggests compost application.
    """
    try:
        monthly, _ = _s2_ndvi_series(params.geojson, params.start_date, params.end_date, params.cloud_cover)
        if not monthly:
            raise HTTPException(404, "No Sentinel-2 scenes found.")

        spring   = [pt for pt in monthly if int(pt["date"][5:7]) in (3, 4, 5)]
        baseline = [pt for pt in monthly if int(pt["date"][5:7]) in (11, 12, 1, 2)]

        spring_mean   = float(np.mean([p["mean"] for p in spring]))   if spring   else 0
        baseline_mean = float(np.mean([p["mean"] for p in baseline])) if baseline else 0
        uplift        = spring_mean - baseline_mean
        detected      = uplift > 0.05 and spring_mean > 0.3

        # Find the fastest green-up month
        best_month = None
        if spring:
            best_month = max(spring, key=lambda p: p["mean"])["date"]

        return {
            "detected":       detected,
            "uplift":         round(uplift, 4),
            "spring_mean":    round(spring_mean, 4),
            "baseline_mean":  round(baseline_mean, 4),
            "best_green_up":  best_month,
            "spring_obs":     len(spring),
            "series":         monthly,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── 4. Soil Carbon Trend ───────────────────────────────────────────────────────
@router.post("/soil-carbon")
def soil_carbon(params: OrganicRequest):
    """
    Proxy soil carbon accumulation from multi-year NDVI trend.
    Sustained positive slope (> 0.001/month) → organic matter building up.
    Carbon proxy: mean NDVI × 45 tC/ha (rough vegetation-carbon conversion).
    """
    try:
        monthly, _ = _s2_ndvi_series(params.geojson, params.start_date, params.end_date, params.cloud_cover)
        if len(monthly) < 3:
            raise HTTPException(422, "Need at least 3 monthly observations for trend analysis.")

        vals = [p["mean"] for p in monthly]
        n    = len(vals)
        xs   = np.arange(n, dtype=float)
        slope, intercept = np.polyfit(xs, vals, 1)
        mean_ndvi = float(np.mean(vals))

        trend = "Accumulating" if slope > 0.001 else "Depleting" if slope < -0.001 else "Stable"
        carbon_proxy = mean_ndvi * 45  # rough tC/ha

        # Year-over-year annual means for context
        from collections import defaultdict
        by_year = defaultdict(list)
        for pt in monthly:
            by_year[pt["date"][:4]].append(pt["mean"])
        annual = [{"year": yr, "mean_ndvi": round(float(np.mean(v)), 4)} for yr, v in sorted(by_year.items())]

        return {
            "trend":          trend,
            "slope_per_month": round(float(slope), 6),
            "carbon_proxy_t_ha": round(carbon_proxy, 1),
            "mean_ndvi":      round(mean_ndvi, 4),
            "scene_count":    n,
            "annual":         annual,
            "series":         monthly,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── Chart helper ───────────────────────────────────────────────────────────────

def _save_dip_chart(monthly: list, dips: list, filename: str) -> str:
    """
    Plot NDVI time series with dip events highlighted.
    Saves to results/<filename>.png and returns its /raster URL.
    """
    os.makedirs(RESULTS_DIR, exist_ok=True)
    png_path = os.path.join(RESULTS_DIR, f"{filename}.png")

    dates = [datetime.strptime(p["date"], "%Y-%m") for p in monthly]
    values = [p["mean"] for p in monthly]
    dip_dates = {d["date"] for d in dips}

    fig, ax = plt.subplots(figsize=(10, 4), dpi=150)
    fig.patch.set_facecolor("#1e1e2e")
    ax.set_facecolor("#1e1e2e")

    # Shade dip months
    for dip in dips:
        dip_dt = datetime.strptime(dip["date"], "%Y-%m")
        color = "#ef4444" if dip["severity"] == "High" else "#f97316"
        ax.axvspan(
            mdates.date2num(dip_dt) - 15,
            mdates.date2num(dip_dt) + 15,
            color=color, alpha=0.25, zorder=1,
        )
        ax.annotate(
            f"−{dip['drop']:.2f}\n({dip['severity']})",
            xy=(dip_dt, dip["ndvi_after"]),
            xytext=(0, -28), textcoords="offset points",
            ha="center", fontsize=6,
            color="#ef4444" if dip["severity"] == "High" else "#f97316",
            arrowprops=dict(arrowstyle="-", color="#666", lw=0.8),
        )

    # NDVI line — green where clean, red markers on dips
    ax.plot(dates, values, color="#4ade80", linewidth=1.5, zorder=2, label="NDVI")
    clean_dates  = [d for d, p in zip(dates, monthly) if p["date"] not in dip_dates]
    clean_vals   = [p["mean"] for p in monthly if p["date"] not in dip_dates]
    flagged_dates = [d for d, p in zip(dates, monthly) if p["date"] in dip_dates]
    flagged_vals  = [p["mean"] for p in monthly if p["date"] in dip_dates]

    ax.scatter(clean_dates,   clean_vals,   color="#4ade80", s=20, zorder=3)
    ax.scatter(flagged_dates, flagged_vals, color="#ef4444", s=35, zorder=3,
               marker="v", label="Dip event")

    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=35, ha="right", fontsize=7, color="#9ca3af")
    ax.tick_params(axis="y", colors="#9ca3af", labelsize=7)
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")

    ax.set_ylabel("NDVI", color="#9ca3af", fontsize=8)
    ax.set_title("Chemical-Free Verification — NDVI Dip Analysis", color="white", fontsize=9, pad=8)
    ax.set_ylim(0, 1)
    ax.grid(axis="y", color="#374151", linewidth=0.5, linestyle="--")
    if dips:
        ax.legend(fontsize=7, facecolor="#2d2d3f", edgecolor="#374151", labelcolor="white")

    plt.tight_layout()
    plt.savefig(png_path, dpi=150, bbox_inches="tight", facecolor="#1e1e2e")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}"


# ── 5. Chemical-Free Verification ─────────────────────────────────────────────
@router.post("/chemical-free")
def chemical_free(params: OrganicRequest):
    """
    Detect abrupt NDVI dips (> 0.12 drop month-to-month) as proxy for
    pesticide/herbicide events. Clean organic fields show smooth NDVI curves.
    If satellite_sensor=sentinel-1, SAR backscatter anomalies supplement NDVI.
    """
    try:
        monthly, _ = _s2_ndvi_series(params.geojson, params.start_date, params.end_date, params.cloud_cover)
        if len(monthly) < 2:
            raise HTTPException(422, "Need at least 2 monthly observations.")

        dips = []
        for i in range(1, len(monthly)):
            drop = monthly[i-1]["mean"] - monthly[i]["mean"]
            if drop > 0.12:
                severity = "High" if drop > 0.20 else "Medium"
                dips.append({
                    "date":     monthly[i]["date"],
                    "from":     monthly[i-1]["date"],
                    "ndvi_before": monthly[i-1]["mean"],
                    "ndvi_after":  monthly[i]["mean"],
                    "drop":     round(drop, 4),
                    "severity": severity,
                })

        # SAR supplement: sudden decrease in VH backscatter can indicate soil disturbance
        sar_events = []
        sar_note   = None
        if params.satellite_sensor == "sentinel-1":
            sar = _s1_sar_series(params.geojson, params.start_date, params.end_date)
            if not sar:
                sar_note = "S1 GRD is requester-pays. Set AWS credentials + AWS_REQUEST_PAYER=requester to enable SAR disturbance detection."
            for i in range(1, len(sar)):
                sar_drop = sar[i-1]["vh_mean"] - sar[i]["vh_mean"]
                if sar_drop > 0.02:  # significant SAR backscatter drop
                    sar_events.append({
                        "date":     sar[i]["date"],
                        "vh_drop":  round(sar_drop, 6),
                    })

        verified = len(dips) == 0
        score    = max(0, 100 - len(dips) * 20)

        ts = params.start_date.replace("-", "") + "_" + params.end_date.replace("-", "")
        chart_url = _save_dip_chart(monthly, dips, f"chemical_free_{ts}")

        return {
            "verified":    verified,
            "score":       score,
            "dip_count":   len(dips),
            "dips":        dips,
            "sar_events":  sar_events,
            "sar_note":    sar_note,
            "mean_ndvi":   round(float(np.mean([p["mean"] for p in monthly])), 4),
            "series":      monthly,
            "chart_url":   chart_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── 6. Buffer Zone & Drift Risk ───────────────────────────────────────────────
@router.post("/buffer-zone")
def buffer_zone(params: OrganicRequest):
    """
    Evaluate buffer zone effectiveness using a proper outward buffer ring.

    Steps:
      1. Expands the farm boundary by `buffer_m` metres (default 50 m) using shapely.
      2. Fetches Sentinel-2 NDVI + SCL within that ring via stackstac.
      3. Classifies SCL land-cover at the buffer boundary (bare soil, vegetation, water, …).
      4. Computes a composite drift-risk score (60 % NDVI quality + 40 % bare-soil fraction).
      5. Flags EU Organic Regulation 2018/848 compliance (active vegetation required).
    """
    from services.buffer_zone_service import assess
    try:
        result = assess(
            geojson=params.geojson,
            start_date=params.start_date,
            end_date=params.end_date,
            buffer_m=params.buffer_m,
            cloud_cover=params.cloud_cover,
        )
        if "error" in result:
            raise HTTPException(404, result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))
