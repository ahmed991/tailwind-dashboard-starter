"""
Case Study Router — Khargone Organic Cotton Pilot
Serves local GeoTIFF rasters (drone indices, CHM, orthomosaic) as PNG overlays
with WGS84 bounds for Mapbox image source rendering.
"""

import os
import io
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.cm as cm
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import rasterio
from rasterio.warp import transform_bounds
from rasterio.crs import CRS
from rasterio.enums import Resampling

router = APIRouter(prefix="/case-study", tags=["case-study"])

DATA_DIR = "/app/case_study_data"

RASTER_MAP = {
    "ndvi":      f"{DATA_DIR}/indices/ndvi/ndvi.tif",
    "green":     f"{DATA_DIR}/indices/green/green.tif",
    "nir":       f"{DATA_DIR}/indices/nir/nir.tif",
    "red_edge":  f"{DATA_DIR}/indices/red_edge/red_edge.tif",
    "chm":       f"{DATA_DIR}/chm/DATA_CHM_reclassify.tif",
    "chm_full":  f"{DATA_DIR}/chm/CHM.tif",
}

RASTER_COLORMAPS = {
    "ndvi":      "RdYlGn",
    "green":     "Greens",
    "nir":       "YlOrRd",
    "red_edge":  "RdPu",
    "chm":       "YlGn",
    "orthomosaic": None,  # RGB — special handling
}

MAX_DIM = 1024  # max output PNG dimension (downsample for performance)


def get_wgs84_bounds(src):
    """Transform raster bounds to WGS84 [west, south, east, north]."""
    bounds = transform_bounds(src.crs, CRS.from_epsg(4326), *src.bounds)
    return list(bounds)  # [west, south, east, north]


def read_downsampled(src, max_dim=MAX_DIM):
    """Read raster downsampled to max_dim on the longest axis."""
    scale = min(max_dim / src.width, max_dim / src.height, 1.0)
    out_w = max(1, int(src.width * scale))
    out_h = max(1, int(src.height * scale))
    data = src.read(
        out_shape=(src.count, out_h, out_w),
        resampling=Resampling.average,
    )
    return data


@router.get("/raster/{name}/info")
def raster_info(name: str):
    """Return bounds (WGS84) and PNG URL for a named raster."""
    path = RASTER_MAP.get(name)
    if not path:
        raise HTTPException(404, f"Unknown raster '{name}'")
    if not os.path.exists(path):
        raise HTTPException(404, f"File not found on server: {path}")

    with rasterio.open(path) as src:
        bounds = get_wgs84_bounds(src)
        bands = src.count
        crs = str(src.crs)

    return {
        "name": name,
        "bounds": bounds,  # [west, south, east, north]
        "png_url": f"http://localhost:8000/case-study/raster/{name}/png",
        "bands": bands,
        "crs": crs,
    }


@router.get("/raster/{name}/png")
def raster_png(name: str):
    """Render raster as PNG and stream back."""
    path = RASTER_MAP.get(name)
    if not path:
        raise HTTPException(404, f"Unknown raster '{name}'")
    if not os.path.exists(path):
        raise HTTPException(404, f"File not found: {path}")

    with rasterio.open(path) as src:
        data = read_downsampled(src)

    fig, ax = plt.subplots(figsize=(8, 8), dpi=150)
    ax.axis("off")

    if name == "orthomosaic" and data.shape[0] >= 3:
        # RGB composite
        rgb = np.stack([data[0], data[1], data[2]], axis=-1).astype(float)
        rgb = (rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-6)
        ax.imshow(rgb)
    else:
        band = data[0].astype(float)
        nodata_mask = band == 0
        band_masked = np.ma.array(band, mask=nodata_mask)
        cmap_name = RASTER_COLORMAPS.get(name, "viridis")
        ax.imshow(band_masked, cmap=cmap_name, interpolation="nearest")

    plt.tight_layout(pad=0)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0,
                facecolor="none", transparent=True, dpi=150)
    plt.close()
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png", headers={
        "Cache-Control": "public, max-age=3600",
    })
