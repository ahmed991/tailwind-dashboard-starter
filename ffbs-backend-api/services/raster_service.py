import matplotlib
matplotlib.use('Agg')

import os
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.colorbar import ColorbarBase
from matplotlib.colors import Normalize
from rasterio.transform import from_bounds
from urllib.parse import quote

SERVER_URL = os.getenv("FASTAPI_PUBLIC_URL", "http://localhost:8000")
RESULTS_DIR = "results"

INDICATOR_VALUE_RANGES = {
    "NDVI": (-1, 1),
    "NDWI": (-1, 1),
    "NDMI": (-1, 1),
    "EVI": (0, 3),
    "PVI": (0, 2),
    "LAI": (0, 6),
    "COTTON": (0, 1),
    "SAR_SM":    (0, 1),
    "SAR_FLOOD": (0, 1),
    "SAR_RVI":   (0, 1),
}

SAR_COLORMAPS = {
    "SAR_SM":    "Blues",     # dry → wet
    "SAR_FLOOD": "RdBu",      # dry → flooded
    "SAR_RVI":   "YlGn",      # sparse → dense vegetation
}


def save_geotiff(arr: np.ndarray, bounds, tif_path: str):
    transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], arr.shape[1], arr.shape[0])
    profile = {
        "driver": "GTiff",
        "height": arr.shape[0],
        "width": arr.shape[1],
        "count": 1,
        "dtype": "float32",
        "crs": "EPSG:3857",
        "transform": transform
    }
    with rasterio.open(tif_path, "w", **profile) as dst:
        dst.write(arr, 1)


def plot_tif_as_png(tif_path: str, png_path: str, indicator: str) -> str:
    with rasterio.open(tif_path) as src:
        data = src.read(1)

    fig, ax = plt.subplots(figsize=(8, 8), dpi=300)
    ax.axis('off')
    colormap_used = None

    if indicator == "SFM":
        cmap = ListedColormap(["#a50026", "#f46d43", "#fdae61", "#a6d96a", "#1a9850"])
        colormap_used = "SFM_CUSTOM"
        ax.imshow(data, cmap=cmap, vmin=1, vmax=5)
    elif indicator == "SCL":
        mask = np.where(data == 4, 1, np.nan)
        cmap = ListedColormap(["green"])
        colormap_used = "SCL_GREEN"
        ax.imshow(mask, cmap=cmap)
    elif indicator in SAR_COLORMAPS:
        cmap = SAR_COLORMAPS[indicator]
        vmin, vmax = INDICATOR_VALUE_RANGES.get(indicator, (0, 1))
        colormap_used = cmap
        ax.imshow(data, cmap=cmap, vmin=vmin, vmax=vmax)
    else:
        vmin, vmax = INDICATOR_VALUE_RANGES.get(indicator, (np.nanmin(data), np.nanmax(data)))
        cmap = "RdYlGn"
        colormap_used = cmap
        ax.imshow(data, cmap=cmap, vmin=vmin, vmax=vmax)

    plt.tight_layout()
    plt.savefig(png_path, dpi=300, bbox_inches='tight', pad_inches=0.05,
                format='png', facecolor='white', transparent=False)
    plt.close()
    return colormap_used


def save_legend_image(output_path: str, indicator: str, colormap_used: str, value_range=None):
    plt.rcParams.update({"text.color": "white", "axes.labelcolor": "white",
                         "xtick.color": "white", "ytick.color": "white"})
    fig, ax = plt.subplots(figsize=(4, 0.6))
    fig.patch.set_facecolor("#1e1e2e")
    ax.set_title(indicator, fontsize=8, color="white")

    if indicator == "SFM":
        cmap = ListedColormap(["#a50026", "#f46d43", "#fdae61", "#a6d96a", "#1a9850"])
        norm = Normalize(vmin=1, vmax=5)
        cb = ColorbarBase(ax, cmap=cmap, norm=norm, boundaries=[1, 2, 3, 4, 5, 6],
                          orientation="horizontal", ticks=[1, 2, 3, 4, 5])
        cb.ax.set_xticklabels(["1", "2", "3", "4", "5"])
    elif indicator == "SCL":
        cmap = ListedColormap(["green"])
        norm = Normalize(vmin=0, vmax=1)
        cb = ColorbarBase(ax, cmap=cmap, norm=norm, orientation="horizontal", ticks=[0, 1])
        cb.ax.set_xticklabels(["0", "Green"])
    elif indicator in SAR_COLORMAPS:
        cmap = plt.get_cmap(SAR_COLORMAPS[indicator])
        vmin, vmax = INDICATOR_VALUE_RANGES.get(indicator, (0, 1))
        norm = Normalize(vmin=vmin, vmax=vmax)
        cb = ColorbarBase(ax, cmap=cmap, norm=norm, orientation="horizontal")
        cb.set_label(f"{indicator} ({vmin} to {vmax})", fontsize=7)
    else:
        cmap = plt.get_cmap(colormap_used)
        vmin, vmax = value_range if value_range else (0, 1)
        norm = Normalize(vmin=vmin, vmax=vmax)
        cb = ColorbarBase(ax, cmap=cmap, norm=norm, orientation="horizontal")
        cb.set_label(f"{indicator} ({vmin} to {vmax})", fontsize=7)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#1e1e2e', transparent=False)
    plt.close()


def build_file_entry(indicator: str, tif_filename: str, legend_path: str, bounds, colormap_used: str, arr: np.ndarray = None, timestamp: str = ""):
    entry = {
        "timestamp": timestamp,
        "tif_url": f"{SERVER_URL}/raster/{quote(tif_filename.replace('.tif', ''))}/tif",
        "png_url": f"{SERVER_URL}/raster/{quote(tif_filename.replace('.tif', ''))}",
        "legend_url": f"{SERVER_URL}/raster/{quote(legend_path.split('/')[-1].replace('.png', ''))}",
        "bounds": list(bounds),
        "colormap_used": colormap_used,
    }

    if indicator == "COTTON" and arr is not None:
        cotton_pixels = (arr == 1).sum()
        area_m2 = cotton_pixels * 100
        area_ha = area_m2 / 10000
        entry["cotton_area_ha"] = round(float(area_ha), 2)

    return entry


def get_raster_bounds(filename: str):
    tif_path = f"{RESULTS_DIR}/{filename}.tif"
    if not os.path.exists(tif_path):
        return None
    with rasterio.open(tif_path) as src:
        b = src.bounds
    return {
        "coordinates": [
            [b.left, b.top],
            [b.right, b.top],
            [b.right, b.bottom],
            [b.left, b.bottom]
        ]
    }


def get_png_path(filename: str):
    path = f"{RESULTS_DIR}/{filename}.png"
    return path if os.path.exists(path) else None


def get_tif_path(filename: str):
    path = f"{RESULTS_DIR}/{filename}.tif"
    return path if os.path.exists(path) else None


def save_index_outputs(index, stack_time_values, bounds_wgs84, indicator: str):
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # Clear stale files from a previous run of this indicator before writing new ones
    prefix = f"{indicator}_"
    for fname in os.listdir(RESULTS_DIR):
        if fname.startswith(prefix) and fname.endswith((".tif", ".png")):
            try:
                os.remove(os.path.join(RESULTS_DIR, fname))
            except OSError:
                pass

    # Derive the true EPSG:3857 bounds from the stack's spatial metadata so
    # the GeoTIFF transform is in metres (not WGS84 degrees).
    x_coords = index.coords.get("x")
    y_coords = index.coords.get("y")
    if x_coords is not None and y_coords is not None:
        res_x = float(x_coords[1] - x_coords[0]) if len(x_coords) > 1 else 10
        res_y = float(y_coords[1] - y_coords[0]) if len(y_coords) > 1 else -10
        half_x = abs(res_x) / 2
        half_y = abs(res_y) / 2
        bounds_3857 = (
            float(x_coords.min()) - half_x,
            float(y_coords.min()) - half_y,
            float(x_coords.max()) + half_x,
            float(y_coords.max()) + half_y,
        )
    else:
        # Fallback: reproject WGS84 bbox corners to EPSG:3857
        import pyproj
        transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        x_min, y_min = transformer.transform(bounds_wgs84[0], bounds_wgs84[1])
        x_max, y_max = transformer.transform(bounds_wgs84[2], bounds_wgs84[3])
        bounds_3857 = (x_min, y_min, x_max, y_max)

    saved_files = []

    for time_val in stack_time_values:
        arr = index.sel(time=time_val).values.astype("float32")
        timestamp = np.datetime_as_string(time_val, unit='s').replace(":", "-")

        tif_filename = f"{indicator}_{timestamp}.tif"
        tif_path = f"{RESULTS_DIR}/{tif_filename}"
        png_path = tif_path.replace(".tif", ".png")
        legend_path = tif_path.replace(".tif", "_legend.png")

        save_geotiff(arr, bounds_3857, tif_path)
        colormap_used = plot_tif_as_png(tif_path, png_path, indicator)

        value_range = INDICATOR_VALUE_RANGES.get(indicator)
        save_legend_image(legend_path, indicator, colormap_used, value_range)

        # Return WGS84 bounds to the frontend for Mapbox overlay positioning
        entry = build_file_entry(indicator, tif_filename, legend_path, bounds_wgs84, colormap_used, arr, timestamp)
        saved_files.append(entry)

    return saved_files
