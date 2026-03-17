from pystac_client import Client
import geopandas as gpd

try:
    import planetary_computer as pc
    _PC_AVAILABLE = True
except ImportError:
    _PC_AVAILABLE = False

STAC_URL = "https://earth-search.aws.element84.com/v1"
PC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

SENSOR_COLLECTION_MAP = {
    "sentinel-2": "sentinel-2-l2a",
    "sentinel-1": "sentinel-1-grd",
    "landsat": "landsat-c2-l2",
    "naip": "naip",
    "cop-dem-30": "cop-dem-glo-30",
    "cop-dem-90": "cop-dem-glo-90"
}

INDICATOR_BAND_MAP = {
    "NDVI": ["nir", "red"],
    "NDWI": ["nir", "green"],
    "PVI": ["nir", "red"],
    "LAI": ["red", "nir", "swir16"],
    "NDMI": ["nir", "swir16"],
    "EVI": ["nir", "red", "blue"],
    "MSI": ["nir", "swir16"],
    "SAVI": ["nir", "red"],
    "SCL": ["scl"],
    "SFM": ["nir", "red"],
    "COTTON": [
        "blue", "green", "red",
        "rededge1", "rededge2", "rededge3",
        "nir", "nir08", "swir16", "swir22"
    ],
    # Sentinel-1 SAR indicators (Element84 STAC — sentinel-1-grd)
    "SAR_SM":    ["vv"],
    "SAR_FLOOD": ["vh"],
    "SAR_RVI":   ["vv", "vh"],
}

INDICATOR_ALIAS_MAP = {
    "Green Forest Change": "SCL",
    "GREEN FOREST CHANGE": "SCL",
    "Soil Fertility Map": "SFM",
    "SOIL FERTILITY MAP": "SFM",
    "Main Crop Identification": "COTTON",
    "MAIN CROP IDENTIFICATION": "COTTON",
}


def resolve_indicator(indicator: str) -> str:
    return INDICATOR_ALIAS_MAP.get(indicator, indicator.upper())


def get_bounds(geojson: dict):
    geometry = gpd.GeoDataFrame.from_features(geojson["features"])
    return geometry.total_bounds


def search_stac(collection: str, bounds, start_date: str, end_date: str, cloud_cover: float):
    catalog = Client.open(STAC_URL)
    # Sentinel-1 GRD has no eo:cloud_cover property — skip the filter for SAR collections
    sar_collections = {"sentinel-1-grd", "sentinel-1-rtc"}
    if collection in sar_collections:
        result = catalog.search(
            collections=[collection],
            bbox=list(bounds),
            datetime=f"{start_date}/{end_date}",
        ).item_collection()
    else:
        query = {"eo:cloud_cover": {"gte": 0, "lte": cloud_cover}}
        result = catalog.search(
            collections=[collection],
            bbox=list(bounds),
            datetime=f"{start_date}/{end_date}",
            query=query
        ).item_collection()
    return list(result)


SENSOR_COLLECTION_VIEWER = {
    "sentinel-2": ("element84", "sentinel-2-l2a"),
    "sentinel-1": ("element84", "sentinel-1-grd"),
    "landsat":    ("planetary", "landsat-c2-l2"),
}

SENSOR_LABEL = {
    "sentinel-2-l2a": "Sentinel-2",
    "sentinel-1-grd": "Sentinel-1",
    "landsat-c2-l2":  "Landsat",
}

SAR_COLLECTIONS = {"sentinel-1-grd", "sentinel-1-rtc"}


def historical_viewer(params):
    bounds = get_bounds(params.geojson)
    e84_catalog = Client.open(STAC_URL)
    pc_catalog  = Client.open(PC_STAC_URL)

    sensors = getattr(params, "sensors", None) or ["sentinel-2"]
    cloud_cover = getattr(params, "cloud_cover", 30) or 30

    thumbnails = []
    for sensor_key in sensors:
        source, collection = SENSOR_COLLECTION_VIEWER.get(sensor_key.lower(), ("element84", "sentinel-2-l2a"))
        label = SENSOR_LABEL.get(collection, sensor_key)
        catalog = pc_catalog if source == "planetary" else e84_catalog
        try:
            if collection in SAR_COLLECTIONS:
                result = catalog.search(
                    collections=[collection],
                    bbox=list(bounds),
                    datetime=f"{params.start_date}/{params.end_date}",
                    limit=30,
                )
            else:
                query = {"eo:cloud_cover": {"gte": 0, "lte": cloud_cover}}
                result = catalog.search(
                    collections=[collection],
                    bbox=list(bounds),
                    datetime=f"{params.start_date}/{params.end_date}",
                    query=query,
                    limit=30,
                )

            items = list(result.get_items())
            for item in items:
                if not item.bbox:
                    continue

                # Planetary Computer: rendered_preview is a public RGB PNG, no signing needed
                if source == "planetary":
                    asset = (item.assets.get("rendered_preview") or
                             item.assets.get("thumbnail") or
                             item.assets.get("overview"))
                else:
                    asset = item.assets.get("thumbnail") or item.assets.get("overview")

                href = None
                if asset:
                    raw = asset.href
                    href = raw if raw.startswith("http") else None

                thumbnails.append({
                    "datetime": item.datetime.isoformat() if item.datetime else None,
                    "thumbnail_url": href,
                    "id": item.id,
                    "bbox": item.bbox,
                    "sensor": label,
                    "collection": collection,
                })
        except Exception as e:
            print(f"[HistoricalViewer] Error querying {collection} ({source}): {e}")

    # Sort combined results by date descending
    thumbnails.sort(key=lambda x: x["datetime"] or "", reverse=True)

    return {
        "count": len(thumbnails),
        "thumbnails": thumbnails,
    }
