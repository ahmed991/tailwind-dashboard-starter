"""
Heavy Metal Contamination Router
Estimates spatial distribution of Pb, Cu, Zn using Sentinel-2 L2A surface
reflectance and regression equations from peer-reviewed literature.

⚠ DISCLAIMER: Equations were calibrated for a mining region in Kazakhstan.
Results are relative spatial proxies, NOT calibrated concentration measurements.
Do not use for regulatory or clinical decisions without local ground-truth.
"""

import io
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
import stackstac
from services.stac_service import search_stac, get_bounds

router = APIRouter(prefix="/heavy-metals", tags=["heavy-metals"])

DISCLAIMER = (
    "Proxy model based on equations calibrated in a mining region (Ust-Kamenogorsk, "
    "Kazakhstan). Absolute values are not reliable outside that region. Interpret as "
    "relative spatial patterns only."
)

# EU soil guideline thresholds (mg/kg)
THRESHOLDS = {
    "pb": {"low": 100,  "high": 300},
    "cu": {"low": 50,   "high": 150},
    "zn": {"low": 100,  "high": 300},
}

METAL_LABELS = {"pb": "Lead (Pb)", "cu": "Copper (Cu)", "zn": "Zinc (Zn)"}
METAL_UNITS  = "mg/kg (proxy)"


class HeavyMetalRequest(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    cloud_cover: Optional[float] = 10   # spec recommends < 10%
    metal: Optional[Literal["pb", "cu", "zn", "all"]] = "all"


def _classify(value: float, thresholds: dict) -> str:
    if value < thresholds["low"]:
        return "Low"
    if value < thresholds["high"]:
        return "Medium"
    return "High"


def _compute_bands(geojson, start_date, end_date, cloud_cover=10):
    """
    Query STAC, stack B02/B03/B04/B06/B08/B11, compute median composite,
    return dict of 2-D reflectance arrays and WGS84 bounds.
    """
    bounds = get_bounds(geojson)
    items  = search_stac("sentinel-2-l2a", bounds, start_date, end_date, cloud_cover)
    if not items:
        raise HTTPException(404, "No Sentinel-2 scenes found — try a wider date range or higher cloud_cover.")

    # Element84 STAC asset names for sentinel-2-l2a
    asset_map = {
        "blue":      "B2",
        "green":     "B3",
        "red":       "B4",
        "rededge2":  "B6",   # 740 nm red edge
        "nir":       "B8",
        "swir16":    "B11",
    }

    stack = stackstac.stack(
        items=items,
        epsg=3857,
        assets=list(asset_map.keys()),
        bounds_latlon=list(bounds),
        resolution=10,
        chunksize=2048,
    ).median("time", keep_attrs=True).compute()

    bands = {}
    for asset, band_name in asset_map.items():
        try:
            arr = stack.sel(band=asset).values.astype(float)
            # DN → surface reflectance
            arr = arr / 10000.0
            arr[arr <= 0] = np.nan
            bands[band_name] = arr
        except KeyError:
            pass  # asset not present in this scene set

    return bands, bounds


def _apply_equations(bands: dict) -> dict:
    """
    Apply regression equations from literature.
    Pb = 147.31*B2 + 28.17*(B3/B8) + 58.12*(B11/B6) − 110.96
    Cu = 1.98 − 9.48*(B3/B8) + 98.21*B4 + 19.23*(B11/B6)
    Zn = 29.1 − 6.37*(B3/B8) + 8.21*(B6/B8) + 110.41*B3
    """
    B2  = bands.get("B2")
    B3  = bands.get("B3")
    B4  = bands.get("B4")
    B6  = bands.get("B6")
    B8  = bands.get("B8")
    B11 = bands.get("B11")

    eps = 1e-6
    r38  = B3  / (B8  + eps)
    r116 = B11 / (B6  + eps)
    r68  = B6  / (B8  + eps)

    pb = 147.31 * B2  + 28.17 * r38 + 58.12 * r116 - 110.96
    cu = 1.98          - 9.48 * r38 + 98.21 * B4   + 19.23 * r116
    zn = 29.1           - 6.37 * r38 + 8.21 * r68  + 110.41 * B3

    # Clip to physically plausible range
    pb = np.clip(pb, 0, 2000)
    cu = np.clip(cu, 0, 1000)
    zn = np.clip(zn, 0, 3000)

    return {"pb": pb, "cu": cu, "zn": zn}


def _array_stats(arr: np.ndarray) -> dict:
    valid = arr[np.isfinite(arr)]
    if len(valid) == 0:
        return {"mean": None, "min": None, "max": None, "p25": None, "p75": None}
    return {
        "mean": round(float(np.mean(valid)),   2),
        "min":  round(float(np.min(valid)),    2),
        "max":  round(float(np.max(valid)),    2),
        "p25":  round(float(np.percentile(valid, 25)), 2),
        "p75":  round(float(np.percentile(valid, 75)), 2),
    }


# ── POST /heavy-metals/compute ─────────────────────────────────────────────────
@router.post("/compute")
def compute_heavy_metals(params: HeavyMetalRequest):
    """
    Compute Pb / Cu / Zn proxy estimates for the AOI.
    Returns per-metal statistics and risk classification.
    """
    try:
        bands, bounds = _compute_bands(
            params.geojson, params.start_date, params.end_date, params.cloud_cover
        )
        metals = _apply_equations(bands)

        result = {}
        targets = ["pb", "cu", "zn"] if params.metal == "all" else [params.metal]
        for m in targets:
            stats = _array_stats(metals[m])
            result[m] = {
                "label":      METAL_LABELS[m],
                "unit":       METAL_UNITS,
                "stats":      stats,
                "risk":       _classify(stats["mean"] or 0, THRESHOLDS[m]) if stats["mean"] else "Unknown",
                "thresholds": THRESHOLDS[m],
            }

        west, south, east, north = (
            float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])
        )
        return {
            "metals":     result,
            "bounds":     [west, south, east, north],
            "disclaimer": DISCLAIMER,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── POST /heavy-metals/png ─────────────────────────────────────────────────────
@router.post("/png")
def heavy_metals_png(params: HeavyMetalRequest):
    """
    Render a single-metal concentration map as a transparent PNG.
    Colormap: green (low) → yellow (medium) → red (high).
    metal must be one of: pb | cu | zn
    """
    if params.metal == "all":
        params.metal = "pb"   # default to Pb if unspecified

    try:
        bands, bounds = _compute_bands(
            params.geojson, params.start_date, params.end_date, params.cloud_cover
        )
        metals = _apply_equations(bands)
        arr    = metals[params.metal]

        thr    = THRESHOLDS[params.metal]
        vmin   = 0
        vmax   = thr["high"] * 1.5   # headroom above "high" threshold

        # Custom diverging green→yellow→red
        cmap = mcolors.LinearSegmentedColormap.from_list(
            "hm",
            ["#22c55e", "#eab308", "#ef4444"],
            N=256,
        )
        cmap.set_bad(alpha=0)

        masked = np.ma.array(arr, mask=~np.isfinite(arr))

        fig, ax = plt.subplots(figsize=(10, 10), dpi=200)
        ax.axis("off")
        ax.imshow(masked, cmap=cmap, vmin=vmin, vmax=vmax, interpolation="bilinear")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0,
                    facecolor="none", transparent=True, dpi=200)
        plt.close()
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
                                 headers={"Cache-Control": "no-cache"})

    except HTTPException:
        raise
    except Exception as e:
        import traceback; print(traceback.format_exc())
        raise HTTPException(500, str(e))


# ── POST /heavy-metals/info ────────────────────────────────────────────────────
@router.post("/info")
def heavy_metals_info(params: HeavyMetalRequest):
    """Return WGS84 bounds for Mapbox image overlay."""
    bounds = get_bounds(params.geojson)
    west, south, east, north = (
        float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])
    )
    return {"bounds": [west, south, east, north]}
