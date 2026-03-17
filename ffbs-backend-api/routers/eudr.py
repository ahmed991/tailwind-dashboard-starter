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
        stack = stackstac.stack(
            items=items,
            epsg=4326,
            assets=["nir", "red"],
            bounds_latlon=bounds,
            resolution=0.0001,   # ~10 m in degrees
        ).median("time", keep_attrs=True).compute()

        # stack.time holds the median timestamps — one per original scene group
        # Re-stack without resampling to get individual scene NDVI
        stack_raw = stackstac.stack(
            items=items,
            epsg=4326,
            assets=["nir", "red"],
            bounds_latlon=bounds,
            resolution=0.0001,
        ).compute()

        nir = stack_raw.sel(band="nir").astype(float)
        red = stack_raw.sel(band="red").astype(float)
        ndvi = (nir - red) / (nir + red + 1e-6)

        results = []
        for i, t in enumerate(stack_raw.time.values):
            scene_ndvi = ndvi.isel(time=i)
            valid = scene_ndvi.values[np.isfinite(scene_ndvi.values)]
            if len(valid) == 0:
                continue
            mean_val = float(np.nanmean(valid))
            date_str = str(t)[:10]
            results.append({"date": date_str, "mean": round(mean_val, 4)})

        # Sort by date
        results.sort(key=lambda x: x["date"])
        return {"time_series": results, "count": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
