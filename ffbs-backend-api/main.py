from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mangum import Mangum
from concurrent.futures import ThreadPoolExecutor
import asyncio

from schemas import RequestParams, ViewerParams
from processor import process_indicator
from services.stac_service import historical_viewer
from services.raster_service import get_png_path, get_tif_path, get_raster_bounds
from database.connection import init_db

# Routers
from routers.auth_router import router as auth_router
from routers.farms import router as farms_router
from routers.sensors import router as sensors_router
from routers.case_study import router as case_study_router

app = FastAPI(
    title="FFBS EO Dashboard API",
    description="Multi-sensor Earth Observation backend for organic & biodiversity assessment",
    version="2.0.0",
)
handler = Mangum(app)
_executor = ThreadPoolExecutor()

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static files ---
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Routers ---
app.include_router(auth_router)
app.include_router(farms_router)
app.include_router(sensors_router)
app.include_router(case_study_router)


# --- Startup: init DB ---
@app.on_event("startup")
def on_startup():
    try:
        init_db()
        print("[DB] Tables created / verified OK")
    except Exception as e:
        print(f"[DB] Warning: could not init DB: {e}")


# --- Legacy endpoints (keep for backward compat with existing frontend) ---

@app.post("/compute-index")
async def compute_index(params: RequestParams):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, process_indicator, params)
    return {"status": "success", "result": result}


@app.post("/historical-viewer")
async def get_thumbnails(params: ViewerParams):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, historical_viewer, params)
    return {"status": "success", "result": result}


@app.get("/raster/{filename}")
def serve_raster_png(filename: str):
    path = get_png_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="PNG file not found.")
    return FileResponse(path, media_type="image/png")


@app.get("/raster/{filename}/tif")
def serve_raster_tif(filename: str):
    path = get_tif_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="TIF file not found.")
    return FileResponse(path, media_type="image/tiff")


@app.get("/raster/{filename}/bounds")
def serve_raster_bounds(filename: str):
    bounds = get_raster_bounds(filename)
    if not bounds:
        raise HTTPException(status_code=404, detail="TIF file not found.")
    return bounds


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
