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
        return {"time_series": results, "count": len(results)}

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


def _median_ndvi(items, bounds):
    """Return 2-D spatial-median NDVI array for a set of STAC items."""
    stack = stackstac.stack(
        items=items,
        epsg=3857,
        assets=["nir", "red"],
        bounds_latlon=list(bounds),
        resolution=60,
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
        baseline_ndvi = _median_ndvi(baseline_items, bounds)
        current_ndvi  = _median_ndvi(current_items,  bounds)

        # Align shapes (take minimum common extent)
        h = min(baseline_ndvi.shape[0], current_ndvi.shape[0])
        w = min(baseline_ndvi.shape[1], current_ndvi.shape[1])
        change = current_ndvi[:h, :w] - baseline_ndvi[:h, :w]

        # Mask no-data
        mask = ~(np.isfinite(baseline_ndvi[:h, :w]) & np.isfinite(current_ndvi[:h, :w]))
        change_masked = np.ma.array(change, mask=mask)

        # Render — diverging RdYlGn, vmin/vmax symmetric at ±0.3
        _, ax = plt.subplots(figsize=(8, 8), dpi=150)
        ax.axis("off")
        cmap = plt.get_cmap("RdYlGn")
        cmap.set_bad(alpha=0)
        ax.imshow(change_masked, cmap=cmap, vmin=-0.3, vmax=0.3, interpolation="nearest")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0,
                    facecolor="none", transparent=True, dpi=150)
        plt.close()
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
                                 headers={"Cache-Control": "no-cache"})

    except Exception as e:
        import traceback
        print(f"[EUDR change map] ERROR:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
