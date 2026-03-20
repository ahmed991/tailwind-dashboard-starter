"""
Tree Species Classification Router
Detects Eucalyptus vs. Beech using Sentinel-2A Red Edge bands:
  - NDRE  = (B8A - B5) / (B8A + B5)   → evergreen canopy proxy
  - RECI  = (B7 / B5) - 1              → chlorophyll index (species separator)
  - Classification: NDRE > 0.28 → Eucalyptus | NDRE < 0.18 & seasonal drop → Beech

Default AOI: Šumava / Bohemian Forest, Czech Republic (mixed beech-spruce forest)
"""

import os
import io
import traceback
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

import stackstac
from services.stac_service import search_stac, get_bounds

RESULTS_DIR = "results"
SERVER_URL  = os.getenv("FASTAPI_PUBLIC_URL", "http://localhost:8000")

router = APIRouter(prefix="/tree-species", tags=["tree-species"])

# ── Default AOI: Šumava / Bohemian Forest ────────────────────────────────────
SUMAVA_GEOJSON = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {"name": "Šumava — Bohemian Forest, Czech Republic"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [13.15, 48.75], [13.65, 48.75],
                [13.65, 49.10], [13.15, 49.10],
                [13.15, 48.75],
            ]]
        }
    }]
}


class TreeSpeciesRequest(BaseModel):
    geojson:     Optional[dict]  = None   # defaults to Šumava AOI
    start_date:  str             = "2023-06-01"
    end_date:    str             = "2023-09-30"
    cloud_cover: Optional[float] = 20


# ── Map helpers ───────────────────────────────────────────────────────────────

def _save_ndre_map(ndre: np.ndarray, bounds, filename: str) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{filename}.png")

    cmap = mcolors.LinearSegmentedColormap.from_list(
        "ndre_species",
        ["#3d1f00", "#7a3800", "#c8780a", "#e8c840", "#4aba28", "#00d050", "#00ff60"],
    )
    valid = ndre[np.isfinite(ndre)]
    vmin = float(np.percentile(valid, 2))  if valid.size else -0.1
    vmax = float(np.percentile(valid, 98)) if valid.size else  0.6
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig, ax = plt.subplots(figsize=(9, 7), dpi=150)
    fig.patch.set_facecolor("#0a0a0a")
    ax.set_facecolor("#0a0a0a")

    masked = np.where(np.isfinite(ndre), ndre, np.nan)
    im = ax.imshow(masked, cmap=cmap, norm=norm,
                   extent=[bounds[0], bounds[2], bounds[1], bounds[3]],
                   origin="upper", interpolation="nearest")

    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("NDRE", color="white", fontsize=8)
    cbar.ax.tick_params(colors="white", labelsize=7)

    # Threshold lines on colorbar
    for thresh, label, col in [(0.18, "← Beech zone", "#f59e0b"), (0.28, "← Eucalyptus zone", "#22c55e")]:
        cbar.ax.axhline((thresh - vmin) / (vmax - vmin), color=col, linewidth=1.5, linestyle="--")
        cbar.ax.text(1.6, (thresh - vmin) / (vmax - vmin), label, color=col,
                     fontsize=6, va="center", transform=cbar.ax.transAxes)

    ax.set_title("NDRE — Tree Species Classification · Šumava, Czech Republic",
                 color="white", fontsize=9, pad=8)
    ax.tick_params(colors="#9ca3af", labelsize=7)
    plt.tight_layout(pad=0.5)
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0a0a")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}"


def _save_class_map(ndre: np.ndarray, bounds, filename: str) -> str:
    """Classified map: eucalyptus (green) | beech (amber) | other (dark)."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{filename}.png")

    rgb = np.zeros((*ndre.shape, 4), dtype=np.uint8)
    nodata = ~np.isfinite(ndre)
    euclp  = np.isfinite(ndre) & (ndre >= 0.28)
    beech  = np.isfinite(ndre) & (ndre >= 0.10) & (ndre < 0.18)
    other  = np.isfinite(ndre) & (ndre >= 0.18) & (ndre < 0.28)

    rgb[euclp]  = [0,  210,  80, 230]   # vivid green → eucalyptus
    rgb[beech]  = [240, 160,  20, 220]   # amber → beech
    rgb[other]  = [60,  100,  80, 160]   # muted green → mixed/transitional
    rgb[nodata] = [0, 0, 0, 0]

    fig, ax = plt.subplots(figsize=(9, 7), dpi=150)
    fig.patch.set_facecolor("#0a0a0a")
    ax.set_facecolor("#0a0a0a")
    ax.imshow(rgb, extent=[bounds[0], bounds[2], bounds[1], bounds[3]],
              origin="upper", interpolation="nearest")

    from matplotlib.patches import Patch
    legend = [
        Patch(color="#00d250", label="Eucalyptus / Evergreen (NDRE ≥ 0.28)"),
        Patch(color="#f0a014", label="Beech / Deciduous (NDRE 0.10–0.18)"),
        Patch(color="#3c6450", label="Mixed / Transitional"),
    ]
    ax.legend(handles=legend, loc="lower left", fontsize=7,
              facecolor="#1a1a2e", edgecolor="#374151", labelcolor="white")
    ax.set_title("Species Classification Map · Šumava, Czech Republic",
                 color="white", fontsize=9, pad=8)
    ax.tick_params(colors="#9ca3af", labelsize=7)
    plt.tight_layout(pad=0.5)
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0a0a")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}"


def _save_reci_chart(scenes: list, filename: str) -> str:
    """Bar chart: mean NDRE + RECI per scene date."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{filename}.png")

    dates = [s["date"] for s in scenes]
    ndres = [s["mean_ndre"] for s in scenes]
    recis = [s["mean_reci"] for s in scenes]

    x = np.arange(len(dates))
    fig, ax = plt.subplots(figsize=(10, 4), dpi=150)
    fig.patch.set_facecolor("#1e1e2e")
    ax.set_facecolor("#1e1e2e")
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")
    ax.tick_params(colors="#9ca3af", labelsize=7)

    ax.bar(x - 0.2, ndres, 0.35, label="NDRE", color="#22c55e", alpha=0.85)
    ax.bar(x + 0.2, recis, 0.35, label="RECI (scaled÷3)", color="#38bdf8", alpha=0.85)
    ax.axhline(0.28, color="#22c55e", linewidth=1, linestyle="--", alpha=0.6)
    ax.axhline(0.18, color="#f59e0b", linewidth=1, linestyle="--", alpha=0.6)
    ax.set_xticks(x)
    ax.set_xticklabels(dates, rotation=35, ha="right", fontsize=7, color="#9ca3af")
    ax.set_ylabel("Index Value", color="#9ca3af", fontsize=8)
    ax.set_title("NDRE & RECI per Scene — Eucalyptus vs. Beech Thresholds",
                 color="white", fontsize=9)
    ax.legend(fontsize=7, facecolor="#2d2d3f", edgecolor="#374151", labelcolor="white")
    ax.grid(axis="y", color="#374151", linewidth=0.5, linestyle="--")

    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#1e1e2e")
    plt.close()
    return f"{SERVER_URL}/raster/{filename}"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/classify")
def classify_tree_species(params: TreeSpeciesRequest):
    """
    Classify Eucalyptus vs. Beech using Sentinel-2A Red Edge bands over the AOI.
    Defaults to Šumava / Bohemian Forest if no GeoJSON provided.
    Returns: NDRE map, classification map, scene chart, per-scene stats, area estimates.
    """
    try:
        geojson = params.geojson or SUMAVA_GEOJSON
        bounds  = get_bounds(geojson)
        minx, miny, maxx, maxy = bounds

        # ── 1. STAC search ────────────────────────────────────────────────────
        items = search_stac(
            "sentinel-2-l2a", bounds,
            params.start_date, params.end_date,
            params.cloud_cover,
        )
        if not items:
            raise HTTPException(404, "No Sentinel-2A scenes found for this area and date range.")

        # ── 2. Stack Red Edge bands ───────────────────────────────────────────
        stack = stackstac.stack(
            items=items,
            epsg=4326,
            assets=["rededge1", "rededge3", "nir08"],  # B05, B07, B8A
            bounds_latlon=list(bounds),
            resolution=0.0002,   # ~20m in degrees
        ).compute()

        b5  = stack.sel(band="rededge1").astype(float)
        b7  = stack.sel(band="rededge3").astype(float)
        b8a = stack.sel(band="nir08").astype(float)

        # ── 3. Per-scene metrics ──────────────────────────────────────────────
        scenes = []
        best_ndre = None
        best_scene_idx = 0

        for i, t in enumerate(stack.time.values):
            scene_date = str(t)[:10]

            b5_s  = b5.isel(time=i).values.astype(float)
            b7_s  = b7.isel(time=i).values.astype(float)
            b8a_s = b8a.isel(time=i).values.astype(float)

            ndre_s = (b8a_s - b5_s) / (b8a_s + b5_s + 1e-6)
            reci_s = (b7_s  / (b5_s + 1e-6)) - 1

            ndre_s = np.clip(ndre_s, -1, 1)
            reci_s = np.clip(reci_s,  0, 5)

            mask = np.isfinite(ndre_s) & (b5_s > 0) & (b8a_s > 0)
            if not mask.any():
                continue

            mean_ndre = float(np.nanmean(ndre_s[mask]))
            mean_reci = float(np.nanmean(reci_s[mask]))

            pct_eucalyptus  = float(np.mean(ndre_s[mask] >= 0.28) * 100)
            pct_beech       = float(np.mean((ndre_s[mask] >= 0.10) & (ndre_s[mask] < 0.18)) * 100)
            pct_transitional= float(np.mean((ndre_s[mask] >= 0.18) & (ndre_s[mask] < 0.28)) * 100)

            scenes.append({
                "date":             scene_date,
                "mean_ndre":        round(mean_ndre, 4),
                "mean_reci":        round(mean_reci / 3, 4),   # scaled for chart
                "pct_eucalyptus":   round(pct_eucalyptus, 1),
                "pct_beech":        round(pct_beech, 1),
                "pct_transitional": round(pct_transitional, 1),
            })

            # Keep the scene with highest mean NDRE (clearest canopy signal)
            if best_ndre is None or mean_ndre > best_ndre:
                best_ndre      = mean_ndre
                best_scene_idx = i
                best_ndre_grid = ndre_s

        scenes.sort(key=lambda x: x["date"])

        if not scenes:
            raise HTTPException(422, "No valid Red Edge pixels found.")

        # ── 4. Area estimates (using best scene) ──────────────────────────────
        px_deg  = 0.0002
        px_ha   = (px_deg * 111_000) ** 2 / 10_000   # approx ha per pixel at mid-lat
        total_px = np.isfinite(best_ndre_grid).sum()

        eucalyptus_px   = int((best_ndre_grid >= 0.28).sum())
        beech_px        = int(((best_ndre_grid >= 0.10) & (best_ndre_grid < 0.18)).sum())
        transitional_px = int(((best_ndre_grid >= 0.18) & (best_ndre_grid < 0.28)).sum())

        eucalyptus_ha   = round(eucalyptus_px   * px_ha)
        beech_ha        = round(beech_px        * px_ha)
        transitional_ha = round(transitional_px * px_ha)
        total_ha        = round(total_px        * px_ha)

        # ── 5. Generate outputs ───────────────────────────────────────────────
        ts = params.start_date.replace("-", "") + "_" + params.end_date.replace("-", "")
        ndre_map_url  = _save_ndre_map(best_ndre_grid,  bounds, f"ts_ndre_{ts}")
        class_map_url = _save_class_map(best_ndre_grid, bounds, f"ts_class_{ts}")
        chart_url     = _save_reci_chart(scenes,               f"ts_chart_{ts}")

        # ── 6. Summary stats across all scenes ───────────────────────────────
        avg_eucalyptus  = round(float(np.mean([s["pct_eucalyptus"]   for s in scenes])), 1)
        avg_beech       = round(float(np.mean([s["pct_beech"]        for s in scenes])), 1)
        avg_ndre        = round(float(np.mean([s["mean_ndre"]        for s in scenes])), 4)
        avg_reci        = round(float(np.mean([s["mean_reci"]        for s in scenes])), 4)

        dominant = (
            "Eucalyptus / Evergreen"  if avg_eucalyptus > avg_beech + 10 else
            "Beech / Deciduous"       if avg_beech > avg_eucalyptus + 10 else
            "Mixed Forest"
        )

        return {
            "status":        "success",
            "aoi":           "Šumava — Bohemian Forest, Czech Republic",
            "scene_count":   len(scenes),
            "scenes":        scenes,
            "summary": {
                "dominant_species":    dominant,
                "avg_ndre":            avg_ndre,
                "avg_reci":            avg_reci,
                "pct_eucalyptus":      avg_eucalyptus,
                "pct_beech":           avg_beech,
                "pct_transitional":    round(100 - avg_eucalyptus - avg_beech, 1),
                "eucalyptus_ha":       eucalyptus_ha,
                "beech_ha":            beech_ha,
                "transitional_ha":     transitional_ha,
                "total_ha":            total_ha,
            },
            "ndre_map_url":  ndre_map_url,
            "class_map_url": class_map_url,
            "chart_url":     chart_url,
            "bbox":          list(bounds),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, str(e))
