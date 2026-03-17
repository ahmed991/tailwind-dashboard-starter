"""
EUDR Deforestation Router — Sub-Task 3
NDVI time-series via Element84 STAC (sentinel-2-l2a) for deforestation analysis.
"""

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import stackstac
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
