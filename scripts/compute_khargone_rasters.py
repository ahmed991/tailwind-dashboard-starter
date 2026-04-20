"""
compute_khargone_rasters.py
----------------------------
Reads the Khargone GeoTIFF raster layers (NDVI, Green, NIR, Red-Edge, CHM)
and extracts zonal statistics:  mean, min, max, std, percentiles, nodata %.

Also loads the existing CSV-derived organic assessment JSON and merges the
raster stats into it, producing one canonical file:

    src/data/khargone_organic_assessment.json

Run from the project root:
    python scripts/compute_khargone_rasters.py
"""

import json, math, os
import numpy as np
import rasterio

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA   = os.path.join(ROOT, "ffbs-backend-api/case_study_data")
OUT    = os.path.join(ROOT, "src/data/khargone_organic_assessment.json")

RASTERS = {
    "ndvi":     os.path.join(DATA, "indices/ndvi/ndvi.tif"),
    "green":    os.path.join(DATA, "indices/green/green.tif"),
    "nir":      os.path.join(DATA, "indices/nir/nir.tif"),
    "red_edge": os.path.join(DATA, "indices/red_edge/red_edge.tif"),
    "chm":      os.path.join(DATA, "chm/CHM.tif"),
    "chm_class":os.path.join(DATA, "chm/DATA_CHM_reclassify.tif"),
}

# ── helpers ──────────────────────────────────────────────────────────────────
def raster_stats(path):
    """Return a stats dict for band 1 of a GeoTIFF, ignoring nodata."""
    with rasterio.open(path) as src:
        meta = {
            "crs":    str(src.crs),
            "width":  src.width,
            "height": src.height,
            "res_m":  round(src.res[0], 4),
            "bounds": {
                "west":  round(src.bounds.left,   6),
                "south": round(src.bounds.bottom, 6),
                "east":  round(src.bounds.right,  6),
                "north": round(src.bounds.top,    6),
            },
        }
        band = src.read(1, masked=True)  # masked array honours nodata
        flat = band.compressed()         # only valid pixels

    if flat.size == 0:
        return {"error": "all nodata", **meta}

    nodata_pct = round(100 * (1 - flat.size / band.size), 2)

    stats = {
        "count":      int(flat.size),
        "nodata_pct": nodata_pct,
        "mean":       round(float(np.mean(flat)), 4),
        "std":        round(float(np.std(flat)),  4),
        "min":        round(float(np.min(flat)),  4),
        "max":        round(float(np.max(flat)),  4),
        "p05":        round(float(np.percentile(flat, 5)),  4),
        "p25":        round(float(np.percentile(flat, 25)), 4),
        "p50":        round(float(np.percentile(flat, 50)), 4),
        "p75":        round(float(np.percentile(flat, 75)), 4),
        "p95":        round(float(np.percentile(flat, 95)), 4),
    }
    return {**meta, **stats}


def chm_class_stats(path):
    """For the reclassified CHM, return pixel counts per class."""
    with rasterio.open(path) as src:
        band = src.read(1, masked=True)
        flat = band.compressed().astype(int)

    counts = {}
    for v in np.unique(flat):
        counts[int(v)] = int(np.sum(flat == v))

    total = sum(counts.values())
    labels = {
        1: "0–0.29 m (bare/ground)",
        2: "0.29–1.04 m (low crop)",
        3: "1.04–2.64 m (medium canopy)",
        4: "2.64–5.48 m (tall canopy)",
        5: "5.48–8.31 m (mature trees)",
    }
    distribution = [
        {
            "class":    k,
            "label":    labels.get(k, f"class_{k}"),
            "pixels":   v,
            "pct":      round(100 * v / total, 2),
        }
        for k, v in sorted(counts.items())
    ]
    return {"total_valid_pixels": total, "distribution": distribution}


# ── extract stats from all rasters ──────────────────────────────────────────
print("Reading rasters...")
raster_results = {}
for key, path in RASTERS.items():
    if not os.path.exists(path):
        raster_results[key] = {"error": "file not found", "path": path}
        print(f"  MISSING  {key}: {path}")
        continue
    try:
        if key == "chm_class":
            raster_results[key] = chm_class_stats(path)
        else:
            raster_results[key] = raster_stats(path)
        print(f"  OK  {key}")
    except Exception as e:
        raster_results[key] = {"error": str(e)}
        print(f"  ERROR {key}: {e}")

# ── derive high-level raster-based organic indicators ───────────────────────
# These supplement the CSV-based indicators with single-scene spatial stats.
ndvi_s  = raster_results.get("ndvi", {})
chm_s   = raster_results.get("chm", {})

raster_indicators = {}

if "mean" in ndvi_s:
    mean_ndvi  = ndvi_s["mean"]
    raster_indicators["ndvi_spatial"] = {
        "mean":          mean_ndvi,
        "std":           ndvi_s["std"],
        "p50_median":    ndvi_s["p50"],
        "p05_bare_pct":  ndvi_s["p05"],
        "p95_dense_pct": ndvi_s["p95"],
        "carbon_proxy_t_ha": round(mean_ndvi * 45, 2),   # Baccini
        "note": (
            "Single-scene (2024 season) spatial NDVI statistics across the farm boundary. "
            "Carbon proxy = NDVI_mean x 45 tC/ha (Baccini method)."
        ),
    }

chm_cls = raster_results.get("chm_class", {})
if "distribution" in chm_cls:
    dist = chm_cls["distribution"]
    total_px = chm_cls["total_valid_pixels"]
    # weighted mean height using class midpoints (m)
    midpoints = {1: 0.145, 2: 0.665, 3: 1.840, 4: 4.060, 5: 6.895}
    w_mean = sum(d["pct"] / 100 * midpoints.get(d["class"], 0) for d in dist)
    raster_indicators["chm_spatial"] = {
        "source":       "DATA_CHM_reclassify.tif",
        "total_pixels": total_px,
        "weighted_mean_m": round(w_mean, 3),
        "distribution": dist,
        "note": (
            "Reclassified CHM (5 height classes) from drone LiDAR survey. "
            "Raw CHM.tif normalised to ground-level — use class distribution for height estimates."
        ),
    }

if "mean" in raster_results.get("red_edge", {}):
    re = raster_results["red_edge"]
    raster_indicators["red_edge_spatial"] = {
        "mean": re["mean"],
        "std":  re["std"],
        "note": "Red-edge reflectance: proxy for chlorophyll content and crop stress level.",
    }

# ── load existing CSV-derived JSON and merge ─────────────────────────────────
if os.path.exists(OUT):
    with open(OUT) as f:
        existing = json.load(f)
else:
    existing = {}

existing["raster_layers"] = raster_results
existing["raster_indicators"] = raster_indicators
existing["_meta"]["raster_source"] = (
    "ffbs-backend-api/case_study_data/{indices,chm}/*.tif — "
    "drone/satellite GeoTIFFs for Khategoan farm boundary"
)

with open(OUT, "w") as f:
    json.dump(existing, f, indent=2)

print(f"\nOK  Merged into {OUT}")
if "mean" in ndvi_s:
    print(f"    NDVI spatial mean = {ndvi_s['mean']}  std = {ndvi_s['std']}")
if "mean" in chm_s:
    print(f"    CHM  spatial mean = {chm_s['mean']} m  max = {chm_s['max']} m")
