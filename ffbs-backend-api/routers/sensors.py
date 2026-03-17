"""
Sensors Router — Sub-Task 1: Multi-Sensor Data Integration Layer

Exposes all available satellite sensors, their supported indicators,
and the processing endpoint that routes to the correct service.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

from database.connection import get_db
from database.models import ProcessingJob, Farm, User
from auth.jwt import get_current_user
from processor import process_indicator
from services.stac_service import historical_viewer, get_bounds
from services.cdse_service import (
    search_sentinel3, get_sentinel3_product_types,
    search_sentinel5p, get_sentinel5p_product_types,
)
from schemas import RequestParams, ViewerParams

router = APIRouter(prefix="/sensors", tags=["sensors"])
_executor = ThreadPoolExecutor()

PLANET_API_KEY = os.getenv("PLANET_API_KEY", "")


# ---------- Sensor Registry ----------

SENSOR_REGISTRY = {
    "sentinel-2": {
        "display_name": "Sentinel-2 L2A (Multispectral)",
        "source": "AWS Element84 STAC",
        "resolution_m": 10,
        "revisit_days": 5,
        "is_active": True,
        "requires_key": False,
        "indicators": ["NDVI", "NDWI", "NDMI", "EVI", "SAVI", "MSI", "PVI", "LAI",
                       "Soil Fertility Map", "Main Crop Identification", "Green Forest Change"],
        "bands": ["blue", "green", "red", "rededge1", "rededge2", "rededge3",
                  "nir", "nir08", "swir16", "swir22", "scl"],
        "description": "ESA Copernicus multispectral satellite. 10m resolution, 5-day revisit.",
    },
    "sentinel-1": {
        "display_name": "Sentinel-1 GRD (SAR)",
        "source": "AWS Element84 STAC",
        "resolution_m": 10,
        "revisit_days": 6,
        "is_active": True,
        "requires_key": False,
        "indicators": ["Soil Moisture", "Forest Structure", "Flood Detection", "Crop Classification"],
        "bands": ["vv", "vh"],
        "description": "SAR (Synthetic Aperture Radar) — works through clouds. Soil moisture, forest structure.",
    },
    "sentinel-3": {
        "display_name": "Sentinel-3 OLCI/SLSTR",
        "source": "Copernicus Data Space (CDSE)",
        "resolution_m": 300,
        "revisit_days": 2,
        "is_active": True,
        "requires_key": True,
        "key_source": "https://dataspace.copernicus.eu/",
        "indicators": ["Water Quality", "Chlorophyll", "Land Surface Temperature", "OGVI", "OTCI"],
        "bands": ["Oa01-Oa21 (OLCI)", "S1-S9 (SLSTR)"],
        "description": "300m resolution, ~2 day revisit. Water quality, chlorophyll, LST.",
    },
    "landsat": {
        "display_name": "Landsat 8/9 C2 L2",
        "source": "AWS Element84 STAC",
        "resolution_m": 30,
        "revisit_days": 16,
        "is_active": True,
        "requires_key": False,
        "indicators": ["NDVI", "NDWI", "EVI", "SAVI"],
        "bands": ["blue", "green", "red", "nir08", "swir16", "swir22"],
        "description": "USGS/NASA 30m multispectral. 40+ year archive for long-term trend analysis.",
    },
    "planet": {
        "display_name": "PlanetScope (3m daily)",
        "source": "Planet Labs API",
        "resolution_m": 3,
        "revisit_days": 1,
        "is_active": bool(PLANET_API_KEY),
        "requires_key": True,
        "key_source": "https://www.planet.com/",
        "indicators": ["NDVI", "NDWI", "High-Res Crop Monitoring"],
        "bands": ["blue", "green", "red", "nir"],
        "description": "3m daily imagery. Highest frequency optical monitoring.",
        "status_note": "" if PLANET_API_KEY else "Planet API key not configured. Set PLANET_API_KEY env var.",
    },
    "naip": {
        "display_name": "NAIP (Aerial, USA only)",
        "source": "AWS Element84 STAC",
        "resolution_m": 1,
        "revisit_days": 365,
        "is_active": True,
        "requires_key": False,
        "indicators": ["NDVI", "Crop Mapping"],
        "bands": ["red", "green", "blue", "nir"],
        "description": "1m aerial imagery for USA. Annual. Very high resolution.",
    },
    "cop-dem-30": {
        "display_name": "Copernicus DEM 30m",
        "source": "AWS Element84 STAC",
        "resolution_m": 30,
        "revisit_days": None,
        "is_active": True,
        "requires_key": False,
        "indicators": ["Terrain Analysis", "Slope", "Aspect"],
        "bands": ["data"],
        "description": "Global 30m Digital Elevation Model.",
    },
    "sentinel-5p": {
        "display_name": "Sentinel-5P TROPOMI (GHG / Air Quality)",
        "source": "Copernicus Data Space (CDSE)",
        "resolution_m": 5500,
        "revisit_days": 1,
        "is_active": True,
        "requires_key": True,
        "key_source": "https://dataspace.copernicus.eu/",
        "indicators": ["CO", "CH4", "NO2", "O3", "SO2"],
        "bands": ["TROPOMI L2 columns"],
        "description": "Daily global GHG and air quality columns. 5.5×3.5 km resolution. Requires CDSE credentials.",
    },
    "enmap": {
        "display_name": "EnMAP (Hyperspectral)",
        "source": "DLR / CDSE",
        "resolution_m": 30,
        "revisit_days": 27,
        "is_active": False,
        "requires_key": True,
        "key_source": "https://www.enmap.org/",
        "indicators": ["Soil Organic Carbon", "Nitrogen Mapping", "Mineral Detection", "Pesticide Residues"],
        "bands": ["224 spectral bands (420-2450nm)"],
        "description": "Hyperspectral — 224 bands. Soil chemistry, mineral composition. Coming in Sub-Task 2.",
    },
    "pixxel": {
        "display_name": "PIXXEL Hyperspectral",
        "source": "Pixxel API",
        "resolution_m": 5,
        "revisit_days": 3,
        "is_active": False,
        "requires_key": True,
        "key_source": "https://pixxel.space/",
        "indicators": ["Crop Stress", "Toxin Detection", "Disease Mapping"],
        "bands": ["150+ spectral bands"],
        "description": "5m hyperspectral. Crop biochemical anomaly and toxin detection. Sub-Task 2.",
    },
    "biomass": {
        "display_name": "ESA BIOMASS Mission",
        "source": "ESA STAC (when available)",
        "resolution_m": 200,
        "revisit_days": 25,
        "is_active": False,
        "requires_key": False,
        "indicators": ["Forest Carbon Stock", "Above-Ground Biomass", "Forest Structure"],
        "bands": ["P-band SAR"],
        "description": "P-band SAR for forest carbon stock estimation. Launched 2025, data TBD.",
    },
}


# ---------- Schemas ----------

class SensorProcessRequest(BaseModel):
    farm_id: int
    sensor: str
    indicator: str
    start_date: str
    end_date: str
    cloud_cover: Optional[float] = 30.0
    resample: Optional[str] = "MS"


class Sentinel3Request(BaseModel):
    farm_id: int
    product_type: str = "S3_OLCI_L2_LFR"
    start_date: str
    end_date: str
    max_results: int = 20


class Sentinel5PRequest(BaseModel):
    farm_id: int
    product_type: str = "L2__CO____"
    start_date: str
    end_date: str
    max_results: int = 20


# ---------- Endpoints ----------

@router.get("/")
def list_sensors():
    """List all sensors with their status, indicators, and metadata."""
    return {
        "sensors": SENSOR_REGISTRY,
        "total": len(SENSOR_REGISTRY),
        "active": sum(1 for s in SENSOR_REGISTRY.values() if s["is_active"]),
    }


@router.get("/{sensor_name}")
def get_sensor(sensor_name: str):
    """Get details for a specific sensor."""
    sensor = SENSOR_REGISTRY.get(sensor_name)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor '{sensor_name}' not found")
    return {"sensor": sensor_name, **sensor}


@router.post("/process")
async def process_sensor_data(
    payload: SensorProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit an EO processing job for a farm using a specific sensor + indicator.
    Stores the job in the DB and runs processing synchronously (async jobs in Sub-Task 7).
    """
    # Validate sensor
    sensor_info = SENSOR_REGISTRY.get(payload.sensor)
    if not sensor_info:
        raise HTTPException(status_code=400, detail=f"Unknown sensor: {payload.sensor}")
    if not sensor_info["is_active"]:
        raise HTTPException(status_code=400, detail=f"Sensor '{payload.sensor}' not yet active: {sensor_info.get('description')}")

    # Check Planet key if needed
    if payload.sensor == "planet" and not PLANET_API_KEY:
        raise HTTPException(status_code=400, detail="Planet API key not configured")

    # Get farm + geometry
    farm = db.query(Farm).filter(Farm.id == payload.farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    geojson_result = db.execute(
        text("SELECT ST_AsGeoJSON(geometry)::json AS geom FROM farms WHERE id = :id"),
        {"id": farm.id}
    ).fetchone()
    geojson = {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": geojson_result.geom, "properties": {}}]
    }

    # Create job record
    job = ProcessingJob(
        farm_id=farm.id,
        user_id=current_user.id,
        sensor=payload.sensor,
        indicator=payload.indicator,
        start_date=payload.start_date,
        end_date=payload.end_date,
        cloud_cover=payload.cloud_cover,
        resample=payload.resample,
        status="running",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Run processing
    try:
        params = RequestParams(
            geojson=geojson,
            start_date=payload.start_date,
            end_date=payload.end_date,
            satellite_sensor=payload.sensor if payload.sensor in ["sentinel-2", "sentinel-1", "landsat", "naip", "cop-dem-30", "cop-dem-90"] else "sentinel-2",
            indicator=payload.indicator,
            cloud_cover=payload.cloud_cover,
            resample=payload.resample,
        )
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, process_indicator, params)

        job.status = "completed"
        job.result = result
        job.completed_at = datetime.utcnow()
        db.commit()

        return {"status": "completed", "job_id": job.id, "result": result}

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.post("/sentinel-3/search")
def search_sentinel3_products(
    payload: Sentinel3Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search Copernicus Data Space for Sentinel-3 products over a farm."""
    farm = db.query(Farm).filter(Farm.id == payload.farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    bounds_result = db.execute(
        text("SELECT ST_XMin(geometry) as xmin, ST_YMin(geometry) as ymin, ST_XMax(geometry) as xmax, ST_YMax(geometry) as ymax FROM farms WHERE id = :id"),
        {"id": farm.id}
    ).fetchone()

    bounds = [bounds_result.xmin, bounds_result.ymin, bounds_result.xmax, bounds_result.ymax]
    result = search_sentinel3(bounds, payload.start_date, payload.end_date, payload.product_type, payload.max_results)
    return result


@router.get("/sentinel-3/product-types")
def sentinel3_product_types():
    """List available Sentinel-3 product types."""
    return get_sentinel3_product_types()


@router.post("/sentinel-5p/search")
def search_sentinel5p_products(
    payload: Sentinel5PRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search Copernicus Data Space for Sentinel-5P TROPOMI GHG products over a farm."""
    farm = db.query(Farm).filter(Farm.id == payload.farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    bounds_result = db.execute(
        text("SELECT ST_XMin(geometry) as xmin, ST_YMin(geometry) as ymin, ST_XMax(geometry) as xmax, ST_YMax(geometry) as ymax FROM farms WHERE id = :id"),
        {"id": farm.id}
    ).fetchone()

    bounds = [bounds_result.xmin, bounds_result.ymin, bounds_result.xmax, bounds_result.ymax]
    result = search_sentinel5p(bounds, payload.start_date, payload.end_date, payload.product_type, payload.max_results)
    return result


@router.get("/sentinel-5p/product-types")
def sentinel5p_product_types():
    """List available Sentinel-5P TROPOMI product types for GHG monitoring."""
    return get_sentinel5p_product_types()


@router.get("/jobs/")
def list_jobs(
    farm_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List processing jobs for the current user."""
    query = db.query(ProcessingJob).filter(ProcessingJob.user_id == current_user.id)
    if farm_id:
        query = query.filter(ProcessingJob.farm_id == farm_id)
    jobs = query.order_by(ProcessingJob.created_at.desc()).limit(50).all()
    return [
        {
            "id": j.id,
            "farm_id": j.farm_id,
            "sensor": j.sensor,
            "indicator": j.indicator,
            "status": j.status,
            "start_date": j.start_date,
            "end_date": j.end_date,
            "created_at": j.created_at,
            "completed_at": j.completed_at,
            "has_result": j.result is not None,
        }
        for j in jobs
    ]


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get full result for a processing job."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id, ProcessingJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "farm_id": job.farm_id,
        "sensor": job.sensor,
        "indicator": job.indicator,
        "status": job.status,
        "error_message": job.error_message,
        "result": job.result,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
    }
