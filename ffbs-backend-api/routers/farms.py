from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
import json

from database.connection import get_db
from database.models import Farm, User
from auth.jwt import get_current_user

router = APIRouter(prefix="/farms", tags=["farms"])


# ---------- Schemas ----------

class FarmCreate(BaseModel):
    name: str
    geojson: dict          # GeoJSON Feature or FeatureCollection
    country: Optional[str] = None
    region: Optional[str] = None
    crop_type: Optional[str] = None
    notes: Optional[str] = None


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    crop_type: Optional[str] = None
    notes: Optional[str] = None


class FarmResponse(BaseModel):
    id: int
    name: str
    geojson: dict
    country: Optional[str]
    region: Optional[str]
    crop_type: Optional[str]
    area_ha: Optional[float]
    notes: Optional[str]
    centroid: Optional[dict]

    class Config:
        from_attributes = True


# ---------- Helpers ----------

def geojson_to_wkt_polygon(geojson: dict) -> str:
    """Extract polygon geometry from GeoJSON Feature or FeatureCollection and return WKT."""
    if geojson.get("type") == "FeatureCollection":
        features = geojson.get("features", [])
        if not features:
            raise ValueError("Empty FeatureCollection")
        geom = features[0].get("geometry")
    elif geojson.get("type") == "Feature":
        geom = geojson.get("geometry")
    else:
        geom = geojson  # raw geometry object

    if not geom:
        raise ValueError("No geometry found in GeoJSON")

    geom_type = geom.get("type")
    coords = geom.get("coordinates")

    if geom_type == "Polygon":
        rings = []
        for ring in coords:
            pts = ", ".join(f"{lng} {lat}" for lng, lat in ring)
            rings.append(f"({pts})")
        return f"POLYGON({', '.join(rings)})"
    elif geom_type == "MultiPolygon":
        # Use first polygon
        ring = coords[0][0]
        pts = ", ".join(f"{lng} {lat}" for lng, lat in ring)
        return f"POLYGON(({pts}))"
    else:
        raise ValueError(f"Unsupported geometry type: {geom_type}")


def farm_to_response(farm: Farm, db: Session) -> dict:
    """Convert Farm model to response dict with GeoJSON geometry."""
    # Fetch geometry as GeoJSON from PostGIS
    result = db.execute(
        text("SELECT ST_AsGeoJSON(geometry)::json AS geom, ST_AsGeoJSON(centroid)::json AS cent, ST_Area(geometry::geography)/10000 AS area_ha FROM farms WHERE id = :id"),
        {"id": farm.id}
    ).fetchone()

    geojson_geom = result.geom if result else {}
    centroid = result.cent if result else {}
    area_ha = round(result.area_ha, 4) if result and result.area_ha else None

    return {
        "id": farm.id,
        "name": farm.name,
        "geojson": {
            "type": "Feature",
            "geometry": geojson_geom,
            "properties": {
                "name": farm.name,
                "country": farm.country,
                "region": farm.region,
                "crop_type": farm.crop_type,
                "area_ha": area_ha,
                "notes": farm.notes,
            }
        },
        "country": farm.country,
        "region": farm.region,
        "crop_type": farm.crop_type,
        "area_ha": area_ha,
        "notes": farm.notes,
        "centroid": centroid,
    }


# ---------- Endpoints ----------

@router.get("/", response_model=List[dict])
def list_farms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farms = db.query(Farm).filter(Farm.user_id == current_user.id).all()
    return [farm_to_response(f, db) for f in farms]


@router.post("/", status_code=201, response_model=dict)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        wkt = geojson_to_wkt_polygon(payload.geojson)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    farm = Farm(
        name=payload.name,
        geometry=f"SRID=4326;{wkt}",
        centroid=f"SRID=4326;POINT(0 0)",  # will be updated below
        country=payload.country,
        region=payload.region,
        crop_type=payload.crop_type,
        notes=payload.notes,
        user_id=current_user.id,
    )
    db.add(farm)
    db.flush()  # get farm.id

    # Compute real centroid via PostGIS
    db.execute(
        text("UPDATE farms SET centroid = ST_Centroid(geometry), area_ha = ST_Area(geometry::geography)/10000 WHERE id = :id"),
        {"id": farm.id}
    )
    db.commit()
    db.refresh(farm)

    return farm_to_response(farm, db)


@router.get("/{farm_id}", response_model=dict)
def get_farm(farm_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm_to_response(farm, db)


@router.put("/{farm_id}", response_model=dict)
def update_farm(farm_id: int, payload: FarmUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(farm, field, value)

    db.commit()
    db.refresh(farm)
    return farm_to_response(farm, db)


@router.delete("/{farm_id}", status_code=204)
def delete_farm(farm_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    db.delete(farm)
    db.commit()


@router.get("/{farm_id}/geojson")
def get_farm_geojson(farm_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return farm as a GeoJSON FeatureCollection (ready to pass to EO processing endpoints)."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    result = db.execute(
        text("SELECT ST_AsGeoJSON(geometry)::json AS geom FROM farms WHERE id = :id"),
        {"id": farm.id}
    ).fetchone()

    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": result.geom,
            "properties": {"name": farm.name, "farm_id": farm.id}
        }]
    }
