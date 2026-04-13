from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, JSON, Text, Enum
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from database.connection import Base
import enum


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    organisation = Column(String)
    role = Column(String)          # "brand" | "regulatory" | "farmer"
    role_data = Column(JSON)       # stores full role-specific profile from registration
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    farms = relationship("Farm", back_populates="owner")
    jobs = relationship("ProcessingJob", back_populates="user")


class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # PostGIS geometry: POLYGON in WGS84
    geometry = Column(Geometry("POLYGON", srid=4326), nullable=False)
    centroid = Column(Geometry("POINT", srid=4326))
    country = Column(String)
    region = Column(String)
    crop_type = Column(String)
    area_ha = Column(Float)
    notes = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="farms")
    jobs = relationship("ProcessingJob", back_populates="farm")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sensor = Column(String, nullable=False)       # sentinel-2, sentinel-1, sentinel-3, planet, etc.
    indicator = Column(String, nullable=False)    # NDVI, SFM, EUDR, etc.
    start_date = Column(String)
    end_date = Column(String)
    cloud_cover = Column(Float, default=30.0)
    resample = Column(String, default="MS")
    status = Column(String, default=JobStatus.pending)
    result = Column(JSON)                         # stores product URLs, bounds, timestamps
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    farm = relationship("Farm", back_populates="jobs")
    user = relationship("User", back_populates="jobs")


class SensorRegistry(Base):
    """Tracks available sensors and their integration status."""
    __tablename__ = "sensor_registry"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)       # e.g. "sentinel-2"
    display_name = Column(String, nullable=False)             # e.g. "Sentinel-2 (Copernicus)"
    source = Column(String)                                   # e.g. "Element84 STAC"
    resolution_m = Column(Integer)                            # spatial resolution in meters
    revisit_days = Column(Integer)                            # revisit frequency
    indicators = Column(JSON)                                 # list of supported indicators
    is_active = Column(Boolean, default=True)
    requires_key = Column(Boolean, default=False)
    notes = Column(Text)
