"""
Tree Species Classification Router
Detects Eucalyptus vs. Beech using Sentinel-2A Red Edge bands:
  - NDRE  = (B8A - B5) / (B8A + B5)   → evergreen canopy proxy
  - RECI  = (B7 / B5) - 1              → chlorophyll index (species separator)
  - Classification: NDRE > 0.28 → Evergreen/Conifer | NDRE < 0.18 & seasonal drop → Beech/Deciduous

Regenerative status (Šumava context):
  - Native climax species = beech-fir-spruce (beech dominant)
  - "Not Found"    : conifer/plantation NDRE% > beech% + 15 (non-native dominance)
  - "At Risk"      : conifer/plantation outpacing beech but within 15%
  - "Regenerating" : beech/deciduous holds competitive or dominant share

Default AOI: Šumava / Bohemian Forest, Czech Republic (mixed beech-spruce forest)
"""

import os
import io
import traceback
import urllib.request
import json as json_mod
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

import rasterio
from rasterio.transform import from_bounds
import stackstac
from services.stac_service import search_stac, get_bounds

RESULTS_DIR = "results"
# Return relative paths so the Express thumbnail proxy resolves them correctly
# regardless of environment (Docker service name vs localhost)
SERVER_URL  = ""

router = APIRouter(prefix="/tree-species", tags=["tree-species"])

# ── Default AOI: Šumava / Bohemian Forest (precise polygon) ──────────────────
SUMAVA_GEOJSON = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {"name": "Šumava — Bohemian Forest, Czech Republic"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [13.552482159851905, 48.96731826989307],
                [13.580948321883852, 48.97164253582328],
                [13.600567653155863, 48.943737990348474],
                [13.630837426503746, 48.946440339630044],
                [13.644918290590027, 48.91980065670086],
                [13.676608003799714, 48.88057896916942],
                [13.718673490577801, 48.887607974179296],
                [13.729231015245862, 48.905661155482406],
                [13.76460598315632,  48.91825713911578],
                [13.769319285993657, 48.93866135132086],
                [13.739138235929708, 48.95736833331918],
                [13.757478102004725, 48.96061374112005],
                [13.823088343614982, 48.952701520045835],
                [13.791594084644455, 48.935916830814286],
                [13.83170075750828,  48.915544782933566],
                [13.874368915705828, 48.923982870820225],
                [13.900690041527465, 48.94428696266377],
                [13.916134704277475, 48.96360430205104],
                [13.902473360212259, 48.98481668525868],
                [13.89798930582505,  49.001268987180794],
                [13.888177798850165, 49.029605198150904],
                [13.819694648472904, 49.0330599413154],
                [13.802643581065979, 49.04332908131687],
                [13.772897162317008, 49.053561693492895],
                [13.760379109267916, 49.060724840248525],
                [13.747848971028077, 49.06071211302688],
                [13.735301367471124, 49.06478079575811],
                [13.698572420003046, 49.072427270275],
                [13.672031985056634, 49.07446837806049],
                [13.632992606377826, 49.07636994686473],
                [13.60574071904054,  49.06919622250422],
                [13.60109079391384,  49.05792805356543],
                [13.594095850372241, 49.05486086337652],
                [13.584744902089398, 49.044174701663536],
                [13.566403747360198, 49.049001882520486],
                [13.549091314564748, 49.02800301950495],
                [13.543445386260998, 49.018808201017805],
                [13.543474213102854, 49.01255582532366],
                [13.545171294339724, 49.007040555113605],
                [13.54125846726302,  48.99858371218002],
                [13.536242243956252, 48.99234153686618],
                [13.540779917610536, 48.983176447822615],
                [13.5503093511619,   48.97840504032999],
                [13.54859845244195,  48.973971632538706],
                [13.552482159851905, 48.96731826989307],
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
    for thresh, label, col in [(0.18, "← Beech zone", "#f59e0b"), (0.28, "← Conifer zone", "#22c55e")]:
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
        Patch(color="#00d250", label="Conifer / Evergreen (NDRE ≥ 0.28)"),
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


def _save_species_highlight(ndre: np.ndarray, bounds, filename: str, species: str) -> str:
    """Single-species highlight map: only target pixels coloured, rest dark."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{filename}.png")

    if species == "eucalyptus":
        mask   = np.isfinite(ndre) & (ndre >= 0.28)
        color  = np.array([0, 210, 80, 230], dtype=np.uint8)
        title  = "Conifer / Evergreen Detection (NDRE ≥ 0.28) · Šumava"
        legend_label = "Conifer / Evergreen"
        legend_color = "#00d250"
    else:  # beech
        mask   = np.isfinite(ndre) & (ndre >= 0.10) & (ndre < 0.18)
        color  = np.array([240, 160, 20, 220], dtype=np.uint8)
        title  = "Beech / Deciduous Detection (NDRE 0.10–0.18) · Šumava"
        legend_label = "Beech / Deciduous"
        legend_color = "#f0a014"

    rgb = np.zeros((*ndre.shape, 4), dtype=np.uint8)
    rgb[mask] = color
    # dim background pixels slightly so structure is visible
    background = np.isfinite(ndre) & ~mask
    rgb[background] = [30, 40, 35, 180]

    fig, ax = plt.subplots(figsize=(9, 7), dpi=150)
    fig.patch.set_facecolor("#0a0a0a")
    ax.set_facecolor("#0a0a0a")
    ax.imshow(rgb, extent=[bounds[0], bounds[2], bounds[1], bounds[3]],
              origin="upper", interpolation="nearest")

    from matplotlib.patches import Patch
    legend = [
        Patch(color=legend_color, label=legend_label),
        Patch(color="#1e2820", label="Other / Not classified"),
    ]
    ax.legend(handles=legend, loc="lower left", fontsize=7,
              facecolor="#1a1a2e", edgecolor="#374151", labelcolor="white")
    ax.set_title(title, color="white", fontsize=9, pad=8)
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


def _fetch_gbif_biodiversity(bounds) -> dict:
    """
    Query GBIF occurrence API for species observations within the AOI bounding box.
    Returns species count, kingdom breakdown, and top-10 species list.
    Non-blocking — returns empty dict on any error.
    """
    minx, miny, maxx, maxy = bounds
    # GBIF geometry search with a simplified bbox polygon (WKT)
    wkt = f"POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
    url = (
        "https://api.gbif.org/v1/occurrence/search"
        f"?geometry={urllib.request.quote(wkt)}"
        "&limit=300&hasCoordinate=true&occurrenceStatus=PRESENT"
    )
    try:
        req = urllib.request.urlopen(url, timeout=10)
        data = json_mod.loads(req.read().decode())
        results = data.get("results", [])
        total = data.get("count", 0)

        kingdom_counts: dict = {}
        species_counts: dict = {}
        for r in results:
            k = r.get("kingdom", "Unknown")
            kingdom_counts[k] = kingdom_counts.get(k, 0) + 1
            sp = r.get("species") or r.get("scientificName", "")
            if sp:
                species_counts[sp] = species_counts.get(sp, 0) + 1

        top_species = sorted(species_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        return {
            "total_occurrences": total,
            "unique_species":    len(species_counts),
            "kingdom_breakdown": kingdom_counts,
            "top_species":       [{"name": s, "count": c} for s, c in top_species],
        }
    except Exception as e:
        print(f"[tree-species] GBIF enrichment skipped: {e}")
        return {}


def _save_ndre_tif(ndre: np.ndarray, bounds, filename: str) -> str:
    """Save the raw NDRE grid as a GeoTIFF for renderTifToCanvas."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{filename}.tif")
    minx, miny, maxx, maxy = bounds
    height, width = ndre.shape
    transform = from_bounds(minx, miny, maxx, maxy, width, height)
    data = ndre.astype(np.float32)
    data[~np.isfinite(data)] = -9999
    with rasterio.open(
        path, "w",
        driver="GTiff", height=height, width=width,
        count=1, dtype="float32",
        crs="EPSG:4326", transform=transform,
        nodata=-9999,
    ) as dst:
        dst.write(data, 1)
    return f"{SERVER_URL}/raster/{filename}/tif"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/classify")
def classify_tree_species(params: TreeSpeciesRequest):
    """
    Classify Eucalyptus vs. Beech using Sentinel-2A Red Edge bands over the AOI.
    Scenes are aggregated into monthly median composites before classification.
    Defaults to Šumava / Bohemian Forest if no GeoJSON provided.
    Returns: NDRE map, classification map, monthly chart, per-month stats, area estimates.
    """
    try:
        geojson = params.geojson or SUMAVA_GEOJSON
        bounds  = get_bounds(geojson)
        minx, miny, maxx, maxy = bounds
        print(f"[tree-species] bounds={bounds} dates={params.start_date}→{params.end_date} cloud={params.cloud_cover}")

        # ── 1. STAC search ────────────────────────────────────────────────────
        items = search_stac(
            "sentinel-2-l2a", bounds,
            params.start_date, params.end_date,
            params.cloud_cover,
        )
        print(f"[tree-species] STAC returned {len(items) if items else 0} items")
        if not items:
            raise HTTPException(404, "No Sentinel-2A scenes found for this area and date range.")

        # ── 2. Stack Red Edge bands ───────────────────────────────────────────
        print(f"[tree-species] Stacking bands for {len(items)} scenes…")
        stack = stackstac.stack(
            items=items,
            epsg=4326,
            assets=["rededge1", "rededge3", "nir08"],  # B05, B07, B8A
            bounds_latlon=list(bounds),
            resolution=0.0002,   # ~20m in degrees
        ).compute()
        print(f"[tree-species] Stack shape={stack.shape}  dims={dict(stack.sizes)}")

        # ── 3. Monthly median composites ─────────────────────────────────────
        # Group all scenes by YYYY-MM, take pixel-wise median to suppress clouds
        import pandas as pd

        times = pd.DatetimeIndex(stack.time.values)
        months = times.to_period("M").unique()
        print(f"[tree-species] {len(stack.time)} scenes → {len(months)} monthly composites")

        scenes = []
        best_ndre   = None
        best_ndre_grid = None

        for month in months:
            label = str(month)          # e.g. "2023-06"
            mask_t = times.to_period("M") == month
            n_scenes = mask_t.sum()
            print(f"[tree-species] Month {label}: {n_scenes} scenes")

            month_stack = stack.isel(time=mask_t)

            # Pixel-wise median across scenes in this month (suppress clouds)
            b5_m  = month_stack.sel(band="rededge1").astype(float).median(dim="time").values
            b7_m  = month_stack.sel(band="rededge3").astype(float).median(dim="time").values
            b8a_m = month_stack.sel(band="nir08").astype(float).median(dim="time").values

            ndre_m = (b8a_m - b5_m) / (b8a_m + b5_m + 1e-6)
            reci_m = (b7_m  / (b5_m + 1e-6)) - 1

            ndre_m = np.clip(ndre_m, -1, 1)
            reci_m = np.clip(reci_m,  0, 5)

            valid = np.isfinite(ndre_m) & (b5_m > 0) & (b8a_m > 0)
            print(f"[tree-species]   valid pixels={valid.sum()}  shape={ndre_m.shape}")
            if not valid.any():
                print(f"[tree-species]   SKIP — no valid pixels")
                continue

            mean_ndre = float(np.nanmean(ndre_m[valid]))
            mean_reci = float(np.nanmean(reci_m[valid]))

            pct_eucalyptus   = float(np.mean(ndre_m[valid] >= 0.28) * 100)
            pct_beech        = float(np.mean((ndre_m[valid] >= 0.10) & (ndre_m[valid] < 0.18)) * 100)
            pct_transitional = float(np.mean((ndre_m[valid] >= 0.18) & (ndre_m[valid] < 0.28)) * 100)
            print(f"[tree-species]   ndre={mean_ndre:.4f}  reci={mean_reci:.4f}  conifer={pct_eucalyptus:.1f}%  beech={pct_beech:.1f}%")

            scenes.append({
                "date":             label,
                "mean_ndre":        round(mean_ndre, 4),
                "mean_reci":        round(mean_reci / 3, 4),
                "pct_conifer":      round(pct_eucalyptus, 1),   # NDRE ≥ 0.28 = evergreen/conifer
                "pct_beech":        round(pct_beech, 1),
                "pct_transitional": round(pct_transitional, 1),
                "scene_count":      int(n_scenes),
            })

            # Best composite = highest mean NDRE (peak canopy signal)
            if best_ndre is None or mean_ndre > best_ndre:
                best_ndre      = mean_ndre
                best_ndre_grid = ndre_m

        scenes.sort(key=lambda x: x["date"])
        print(f"[tree-species] Valid monthly composites: {len(scenes)}")

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
        print(f"[tree-species] Generating maps…")
        ts = params.start_date.replace("-", "") + "_" + params.end_date.replace("-", "")
        ndre_map_url        = _save_ndre_map(best_ndre_grid,  bounds, f"ts_ndre_{ts}")
        class_map_url       = _save_class_map(best_ndre_grid, bounds, f"ts_class_{ts}")
        eucalyptus_map_url  = _save_species_highlight(best_ndre_grid, bounds, f"ts_euclp_{ts}", "eucalyptus")
        beech_map_url       = _save_species_highlight(best_ndre_grid, bounds, f"ts_beech_{ts}", "beech")
        chart_url           = _save_reci_chart(scenes, f"ts_chart_{ts}")
        ndre_tif_url        = _save_ndre_tif(best_ndre_grid, bounds, f"ts_ndre_{ts}")

        # ── 6. Summary stats across all scenes ───────────────────────────────
        avg_eucalyptus  = round(float(np.mean([s["pct_conifer"]      for s in scenes])), 1)
        avg_beech       = round(float(np.mean([s["pct_beech"]        for s in scenes])), 1)
        avg_ndre        = round(float(np.mean([s["mean_ndre"]        for s in scenes])), 4)
        avg_reci        = round(float(np.mean([s["mean_reci"]        for s in scenes])), 4)

        dominant = (
            "Evergreen / Conifer"  if avg_eucalyptus > avg_beech + 10 else
            "Beech / Deciduous"    if avg_beech > avg_eucalyptus + 10 else
            "Mixed Forest"
        )

        # ── Regenerative status (Šumava: native climax = beech-dominated) ─────
        conifer_lead = avg_eucalyptus - avg_beech
        if conifer_lead > 15:
            regenerative_status = "Not Found"
            regenerative_note   = (
                "Conifer/plantation canopy dominates native beech by "
                f"{conifer_lead:.1f}%. Natural deciduous regeneration absent."
            )
        elif conifer_lead > 0:
            regenerative_status = "At Risk"
            regenerative_note   = (
                f"Evergreen conifers outpacing native beech by {conifer_lead:.1f}%. "
                "Regeneration under pressure — monitoring required."
            )
        else:
            regenerative_status = "Regenerating"
            regenerative_note   = (
                f"Native beech/deciduous holds {avg_beech:.1f}% canopy share. "
                "Natural forest regeneration present."
            )

        # ── Canopy cover & tree count (from best scene) ──────────────────────
        # Canopy = any pixel with NDRE > 0.10 (vegetation threshold)
        canopy_px         = int((best_ndre_grid > 0.10).sum())
        canopy_ha         = round(canopy_px * px_ha)
        canopy_cover_pct  = round(canopy_px / max(total_px, 1) * 100, 1)
        # Šumava mixed forest: ~400-600 trees/ha; use 500 as central estimate
        estimated_tree_count = int(canopy_ha * 500)

        print(
            f"[tree-species] Done. dominant={dominant}  regen={regenerative_status} "
            f"euclp={avg_eucalyptus}%  beech={avg_beech}%  "
            f"canopy={canopy_cover_pct}%  trees≈{estimated_tree_count:,}"
        )

        # ── Biodiversity enrichment (GBIF, non-blocking) ─────────────────────
        biodiversity = _fetch_gbif_biodiversity(bounds)

        return {
            "status":          "success",
            "_ts":             ts,
            "aoi":             "Šumava — Bohemian Forest, Czech Republic",
            "month_count":     len(scenes),
            "scene_count":     len(items),
            "scenes":          scenes,
            "summary": {
                "dominant_species":      dominant,
                "regenerative_status":   regenerative_status,
                "regenerative_note":     regenerative_note,
                "avg_ndre":              avg_ndre,
                "avg_reci":              avg_reci,
                "pct_conifer":           avg_eucalyptus,
                "pct_beech":             avg_beech,
                "pct_transitional":      round(100 - avg_eucalyptus - avg_beech, 1),
                "conifer_ha":            eucalyptus_ha,
                "beech_ha":              beech_ha,
                "transitional_ha":       transitional_ha,
                "total_ha":              total_ha,
                "canopy_cover_pct":      canopy_cover_pct,
                "canopy_ha":             canopy_ha,
                "estimated_tree_count":  estimated_tree_count,
            },
            "biodiversity":       biodiversity,
            "ndre_tif_url":       ndre_tif_url,
            "ndre_map_url":       ndre_map_url,
            "class_map_url":      class_map_url,
            "eucalyptus_map_url": eucalyptus_map_url,
            "beech_map_url":      beech_map_url,
            "chart_url":          chart_url,
            "bbox":               list(bounds),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[tree-species] ERROR: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, str(e))
