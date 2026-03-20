"""
Evapotranspiration Router
Computes actual ET (ETa) using:
  - Sentinel-2 NDVI via Element84 STAC + stackstac
  - Reference ET (ETo) from Open-Meteo ERA5 archive (free, no API key)
  - FAO-56 Kc-NDVI: Kc = 1.25 × NDVI − 0.2  →  ETa = Kc × ETo (mm/day)
"""

import os
import io
import traceback
import numpy as np
import httpx
import stackstac
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

import geopandas as gpd
from services.stac_service import search_stac, get_bounds

RESULTS_DIR = "results"
SERVER_URL  = os.getenv("FASTAPI_PUBLIC_URL", "http://localhost:8000")

router = APIRouter(prefix="/et", tags=["evapotranspiration"])


class ETRequest(BaseModel):
    geojson:     dict
    start_date:  str
    end_date:    str
    cloud_cover: Optional[float] = 30


# ── Open-Meteo ERA5 ETo fetch ─────────────────────────────────────────────────

def _fetch_eto(lat: float, lon: float, start_date: str, end_date: str) -> dict:
    """
    Fetch daily ETo (Penman-Monteith) from Open-Meteo ERA5 archive.
    Returns {date_str: eto_mm_day, ...}
    Free, no API key required.
    """
    url = "https://archive-api.open-meteo.com/v1/era5"
    params = {
        "latitude":  round(lat, 4),
        "longitude": round(lon, 4),
        "start_date": start_date,
        "end_date":   end_date,
        "daily":      "et0_fao_evapotranspiration",
        "timezone":   "UTC",
    }
    resp = httpx.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    daily = data.get("daily", {})
    dates  = daily.get("time", [])
    eto    = daily.get("et0_fao_evapotranspiration", [])

    return {d: float(e) for d, e in zip(dates, eto) if e is not None}


def _mean_eto_for_scene(eto_dict: dict, scene_date: str, window_days: int = 7) -> float:
    """Average ETo over ±window_days around the scene acquisition date."""
    dt = datetime.strptime(scene_date, "%Y-%m-%d")
    vals = []
    for delta in range(-window_days, window_days + 1):
        d = (dt + timedelta(days=delta)).strftime("%Y-%m-%d")
        if d in eto_dict:
            vals.append(eto_dict[d])
    return float(np.mean(vals)) if vals else 3.5   # fallback: 3.5 mm/day global avg


# ── Chart helper ──────────────────────────────────────────────────────────────

def _save_et_chart(series: list, filename: str) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    png_path = os.path.join(RESULTS_DIR, f"{filename}.png")

    dates  = [datetime.strptime(s["date"], "%Y-%m-%d") for s in series]
    eta    = [s["eta_mm_day"] for s in series]
    eto    = [s["eto_mm_day"] for s in series]
    kc     = [s["kc"] for s in series]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), dpi=150, sharex=True)
    fig.patch.set_facecolor("#1e1e2e")
    for ax in (ax1, ax2):
        ax.set_facecolor("#1e1e2e")
        for spine in ax.spines.values():
            spine.set_edgecolor("#374151")
        ax.tick_params(colors="#9ca3af", labelsize=7)

    ax1.plot(dates, eta, color="#38bdf8", linewidth=1.8, label="ETa (actual)")
    ax1.plot(dates, eto, color="#64748b", linewidth=1.2, linestyle="--", label="ETo (reference)")
    ax1.fill_between(dates, eta, alpha=0.2, color="#38bdf8")
    ax1.set_ylabel("mm/day", color="#9ca3af", fontsize=8)
    ax1.set_title("Actual Evapotranspiration (ETa) — Kc × ETo", color="white", fontsize=9, pad=6)
    ax1.legend(fontsize=7, facecolor="#2d2d3f", edgecolor="#374151", labelcolor="white")
    ax1.grid(axis="y", color="#374151", linewidth=0.5, linestyle="--")

    ax2.plot(dates, kc, color="#4ade80", linewidth=1.6, label="Crop Coefficient (Kc)")
    ax2.axhline(1.0, color="#6b7280", linewidth=0.8, linestyle=":")
    ax2.set_ylabel("Kc", color="#9ca3af", fontsize=8)
    ax2.set_ylim(0, 1.5)
    ax2.set_title("Crop Coefficient Kc = 1.25 × NDVI − 0.2", color="#9ca3af", fontsize=8, pad=4)
    ax2.legend(fontsize=7, facecolor="#2d2d3f", edgecolor="#374151", labelcolor="white")
    ax2.grid(axis="y", color="#374151", linewidth=0.5, linestyle="--")

    import matplotlib.dates as mdates
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax2.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=35, ha="right", fontsize=7, color="#9ca3af")

    plt.tight_layout()
    plt.savefig(png_path, dpi=150, bbox_inches="tight", facecolor="#1e1e2e")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}"


def _save_et_map(eta_grid: np.ndarray, bounds, filename: str) -> str:
    """Save ETa spatial map as PNG with a blue-white colormap."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    png_path = os.path.join(RESULTS_DIR, f"{filename}_map.png")

    valid = eta_grid[np.isfinite(eta_grid) & (eta_grid > 0)]
    vmin  = float(np.percentile(valid, 2))  if valid.size else 0
    vmax  = float(np.percentile(valid, 98)) if valid.size else 8

    cmap = mcolors.LinearSegmentedColormap.from_list(
        "et", ["#7f1d1d", "#fbbf24", "#34d399", "#0ea5e9", "#1e3a5f"]
    )
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig, ax = plt.subplots(figsize=(8, 6), dpi=150)
    fig.patch.set_facecolor("#000")
    ax.set_facecolor("#000")

    masked = np.where(np.isfinite(eta_grid) & (eta_grid > 0), eta_grid, np.nan)
    im = ax.imshow(masked, cmap=cmap, norm=norm,
                   extent=[bounds[0], bounds[2], bounds[1], bounds[3]],
                   origin="upper", interpolation="nearest")

    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("ETa (mm/day)", color="white", fontsize=8)
    cbar.ax.tick_params(colors="white", labelsize=7)

    ax.set_title("Actual Evapotranspiration", color="white", fontsize=9)
    ax.axis("off")
    plt.tight_layout(pad=0.5)
    plt.savefig(png_path, dpi=150, bbox_inches="tight", facecolor="#000")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}_map"


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post("/compute")
def compute_et(params: ETRequest):
    """
    Compute actual ET (ETa) over the AOI for the given date range.
    Returns:
      - time-series of daily ETa per scene (chart URL)
      - spatial ETa map for the most recent scene (PNG URL + bbox)
      - summary statistics
    """
    try:
        bounds = get_bounds(params.geojson)
        minx, miny, maxx, maxy = bounds
        lat_center = (miny + maxy) / 2
        lon_center  = (minx + maxx) / 2

        # ── 1. Fetch ETo from Open-Meteo ──────────────────────────────────────
        eto_dict = _fetch_eto(lat_center, lon_center, params.start_date, params.end_date)
        if not eto_dict:
            raise HTTPException(502, "Open-Meteo returned no ETo data for this location/period.")

        # ── 2. Fetch Sentinel-2 scenes ────────────────────────────────────────
        items = search_stac("sentinel-2-l2a", bounds, params.start_date, params.end_date, params.cloud_cover)
        if not items:
            raise HTTPException(404, "No Sentinel-2 scenes found for this area and date range.")

        # ── 3. Compute NDVI → Kc → ETa per scene ─────────────────────────────
        stack = stackstac.stack(
            items=items,
            epsg=4326,
            assets=["nir", "red"],
            bounds_latlon=list(bounds),
            resolution=0.0001,   # ~10m in degrees at mid-latitudes
        ).compute()

        nir  = stack.sel(band="nir").astype(float)
        red  = stack.sel(band="red").astype(float)
        ndvi = (nir - red) / (nir + red + 1e-6)
        ndvi = ndvi.clip(-1, 1)

        series       = []
        last_eta_grid = None
        last_bounds   = bounds

        for i, t in enumerate(stack.time.values):
            scene_date = str(t)[:10]
            ndvi_scene = ndvi.isel(time=i).values  # 2D array

            valid_mask = np.isfinite(ndvi_scene) & (ndvi_scene > -1) & (ndvi_scene < 1)
            if not valid_mask.any():
                continue

            mean_ndvi = float(np.nanmean(ndvi_scene[valid_mask]))

            # FAO-56 Kc-NDVI (clamped 0.1 – 1.4)
            kc_scene  = np.clip(1.25 * ndvi_scene - 0.2, 0.1, 1.4)
            mean_kc   = float(np.nanmean(kc_scene[valid_mask]))

            eto_val   = _mean_eto_for_scene(eto_dict, scene_date)
            eta_grid  = kc_scene * eto_val
            mean_eta  = float(np.nanmean(eta_grid[valid_mask]))

            series.append({
                "date":       scene_date,
                "mean_ndvi":  round(mean_ndvi, 4),
                "kc":         round(mean_kc,   4),
                "eto_mm_day": round(eto_val,    2),
                "eta_mm_day": round(mean_eta,   2),
            })
            last_eta_grid = eta_grid

        series.sort(key=lambda x: x["date"])

        if not series:
            raise HTTPException(422, "No valid NDVI pixels found in any scene.")

        # ── 4. Summary stats ──────────────────────────────────────────────────
        mean_eta_all = float(np.mean([s["eta_mm_day"] for s in series]))
        mean_kc_all  = float(np.mean([s["kc"]         for s in series]))
        mean_eto_all = float(np.mean([s["eto_mm_day"]  for s in series]))
        total_eta_mm = float(np.sum([s["eta_mm_day"]   for s in series]))

        stress_days  = sum(1 for s in series if s["kc"] < 0.5)
        stress_label = "High" if stress_days > len(series) * 0.4 else \
                       "Medium" if stress_days > len(series) * 0.15 else "Low"

        # ── 5. Charts ─────────────────────────────────────────────────────────
        ts      = params.start_date.replace("-", "") + "_" + params.end_date.replace("-", "")
        chart_url = _save_et_chart(series, f"et_series_{ts}")

        map_url   = None
        if last_eta_grid is not None:
            map_url = _save_et_map(last_eta_grid, last_bounds, f"et_map_{ts}")

        return {
            "status":       "success",
            "scene_count":  len(series),
            "summary": {
                "mean_eta_mm_day":   round(mean_eta_all, 2),
                "mean_kc":           round(mean_kc_all,  4),
                "mean_eto_mm_day":   round(mean_eto_all, 2),
                "total_eta_mm":      round(total_eta_mm, 1),
                "water_stress":      stress_label,
                "stress_scene_count": stress_days,
            },
            "series":       series,
            "chart_url":    chart_url,
            "map_url":      map_url,
            "bbox":         list(bounds),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, str(e))
