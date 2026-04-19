"""
export_khargone_images.py
--------------------------
Exports colormapped PNG images from the Khargone GeoTIFF rasters and copies
pre-existing analysis PNGs into public/khargone-study/ for frontend display.

Run from the project root:
    python scripts/export_khargone_images.py
"""

import os, shutil
import numpy as np
import rasterio
from matplotlib import pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, BoundaryNorm
from PIL import Image

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA    = os.path.join(ROOT, "ffbs-backend-api/case_study_data")
PILOT   = os.path.join(ROOT, "ffbs-backend-api/case_study_data/pilot_project")
OUT_DIR = os.path.join(ROOT, "public/khargone-study")
os.makedirs(OUT_DIR, exist_ok=True)

DPI = 150

# ── helpers ──────────────────────────────────────────────────────────────────
def read_band(path, clip_pct=(2, 98)):
    """Read band 1, mask nodata, clip to percentiles."""
    with rasterio.open(path) as src:
        band = src.read(1, masked=True)
        nodata = src.nodata
    arr = band.filled(np.nan)
    if nodata is not None:
        arr[arr == nodata] = np.nan
    lo, hi = np.nanpercentile(arr, clip_pct)
    arr = np.clip(arr, lo, hi)
    return arr


def save_colormap_png(arr, cmap, vmin, vmax, out_path, title, unit="",
                      figsize=(8, 6), tight=True):
    arr_disp = np.ma.masked_invalid(arr)
    fig, ax = plt.subplots(figsize=figsize, facecolor="#0f0f0f")
    ax.set_facecolor("#0f0f0f")
    im = ax.imshow(arr_disp, cmap=cmap, vmin=vmin, vmax=vmax, interpolation="nearest")
    cb = fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
    cb.ax.yaxis.set_tick_params(color="white", labelsize=8)
    cb.outline.set_edgecolor("#444")
    plt.setp(cb.ax.yaxis.get_ticklabels(), color="#ccc")
    ax.set_title(title, color="white", fontsize=10, pad=6)
    ax.axis("off")
    if unit:
        cb.set_label(unit, color="#aaa", fontsize=8)
    if tight:
        plt.tight_layout(pad=0.5)
    fig.savefig(out_path, dpi=DPI, bbox_inches="tight",
                facecolor="#0f0f0f", edgecolor="none")
    plt.close(fig)
    print(f"  OK  {os.path.basename(out_path)}")


# ── custom colormaps ──────────────────────────────────────────────────────────
NDVI_CMAP = LinearSegmentedColormap.from_list("ndvi", [
    "#d73027", "#f46d43", "#fdae61", "#fee08b",
    "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850",
])

RED_EDGE_CMAP = LinearSegmentedColormap.from_list("re", [
    "#fff7f3", "#fde0dd", "#fcc5c0", "#f768a1", "#ae017e", "#49006a",
])

GREEN_CMAP = LinearSegmentedColormap.from_list("green", [
    "#f7fcf5", "#ccebc5", "#a8ddb5", "#74c476", "#31a354", "#006d2c", "#00441b",
])

NIR_CMAP = LinearSegmentedColormap.from_list("nir", [
    "#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#8c2d04",
])

CHM_COLORS = ["#fde68a", "#bef264", "#34d399", "#0284c7", "#7c3aed"]
CHM_BOUNDS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
CHM_LABELS = ["0–0.3m\nbare", "0.3–1m\nlow", "1–2.6m\nmed", "2.6–5.5m\ntall", "5.5–8.3m\ntrees"]


# ── 1. NDVI ───────────────────────────────────────────────────────────────────
ndvi_path = os.path.join(DATA, "indices/ndvi/ndvi.tif")
arr = read_band(ndvi_path)
save_colormap_png(arr, NDVI_CMAP, -0.1, 0.9,
                  os.path.join(OUT_DIR, "ndvi.png"),
                  "NDVI — Khargone Farm (2024 Season)", unit="NDVI")

# ── 2. Green band ─────────────────────────────────────────────────────────────
green_path = os.path.join(DATA, "indices/green/green.tif")
arr = read_band(green_path)
save_colormap_png(arr, GREEN_CMAP, float(np.nanmin(arr)), float(np.nanmax(arr)),
                  os.path.join(OUT_DIR, "green.png"),
                  "Green Band Reflectance — Khargone Farm", unit="Reflectance")

# ── 3. NIR ────────────────────────────────────────────────────────────────────
nir_path = os.path.join(DATA, "indices/nir/nir.tif")
arr = read_band(nir_path)
save_colormap_png(arr, NIR_CMAP, float(np.nanmin(arr)), float(np.nanmax(arr)),
                  os.path.join(OUT_DIR, "nir.png"),
                  "NIR Reflectance (Biomass Proxy) — Khargone Farm", unit="Reflectance")

# ── 4. Red Edge ───────────────────────────────────────────────────────────────
re_path = os.path.join(DATA, "indices/red_edge/red_edge.tif")
arr = read_band(re_path)
save_colormap_png(arr, RED_EDGE_CMAP, float(np.nanmin(arr)), float(np.nanmax(arr)),
                  os.path.join(OUT_DIR, "red_edge.png"),
                  "Red-Edge Reflectance (Chlorophyll / Stress) — Khargone Farm", unit="Reflectance")

# ── 5. CHM reclassified ───────────────────────────────────────────────────────
chm_path = os.path.join(DATA, "chm/DATA_CHM_reclassify.tif")
with rasterio.open(chm_path) as src:
    chm_arr = src.read(1).astype(float)
    nodata  = src.nodata
if nodata is not None:
    chm_arr[chm_arr == nodata] = np.nan

chm_cmap = LinearSegmentedColormap.from_list("chm5", CHM_COLORS, N=5)
norm = BoundaryNorm(CHM_BOUNDS, chm_cmap.N)

fig, ax = plt.subplots(figsize=(8, 6), facecolor="#0f0f0f")
ax.set_facecolor("#0f0f0f")
im = ax.imshow(np.ma.masked_invalid(chm_arr), cmap=chm_cmap, norm=norm, interpolation="nearest")
cb = fig.colorbar(im, ax=ax, ticks=[1, 2, 3, 4, 5], fraction=0.035, pad=0.02)
cb.ax.set_yticklabels(CHM_LABELS, fontsize=7, color="#ccc")
cb.outline.set_edgecolor("#444")
cb.set_label("Height class", color="#aaa", fontsize=8)
ax.set_title("Canopy Height Model (Classified) — Khargone Farm", color="white", fontsize=10, pad=6)
ax.axis("off")
plt.tight_layout(pad=0.5)
fig.savefig(os.path.join(OUT_DIR, "chm_classified.png"), dpi=DPI,
            bbox_inches="tight", facecolor="#0f0f0f", edgecolor="none")
plt.close(fig)
print(f"  OK  chm_classified.png")

# ── 6. Copy pre-existing analysis PNGs ───────────────────────────────────────
copies = [
    (os.path.join(PILOT, "cotton yeild estimation/cotton_classification_phenology_analysis.png"),
     "phenology_analysis.png"),
    (os.path.join(PILOT, "dataset/cotton_ndvi_correlation_analysis.png"),
     "ndvi_correlation.png"),
]
for src_path, dest_name in copies:
    if os.path.exists(src_path):
        shutil.copy2(src_path, os.path.join(OUT_DIR, dest_name))
        print(f"  OK  {dest_name} (copied)")
    else:
        print(f"  SKIP {dest_name} (not found: {src_path})")

print(f"\nAll images written to {OUT_DIR}")
