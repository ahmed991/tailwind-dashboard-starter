from pystac_client import Client
import geopandas as gpd

try:
    import planetary_computer as pc
    _PC_AVAILABLE = True
except ImportError:
    _PC_AVAILABLE = False

STAC_URL      = "https://earth-search.aws.element84.com/v1"
PC_STAC_URL   = "https://planetarycomputer.microsoft.com/api/stac/v1"
DLR_STAC_URL  = "https://geoservice.dlr.de/eoc/ogc/stac/v1"
PLANET_STAC_URL = "https://www.planet.com/data/stac/catalog.json"
CDSE_STAC_URL = "https://stac.dataspace.copernicus.eu/v1"

SENSOR_COLLECTION_MAP = {
    "sentinel-2": "sentinel-2-l2a",
    "sentinel-1": "sentinel-1-grd",
    "landsat":    "landsat-c2-l2",
    "naip":       "naip",
    "cop-dem-30": "cop-dem-glo-30",
    "cop-dem-90": "cop-dem-glo-90",
}

INDICATOR_BAND_MAP = {
    "NDVI": ["nir", "red"],
    "NDWI": ["nir", "green"],
    "PVI":  ["nir", "red"],
    "LAI":  ["red", "nir", "swir16"],
    "NDMI": ["nir", "swir16"],
    "EVI":  ["nir", "red", "blue"],
    "MSI":  ["nir", "swir16"],
    "SAVI": ["nir", "red"],
    "SCL":  ["scl"],
    "SFM":  ["nir", "red"],
    "COTTON": [
        "blue", "green", "red",
        "rededge1", "rededge2", "rededge3",
        "nir", "nir08", "swir16", "swir22",
    ],
    "SAR_SM":    ["vv"],
    "SAR_FLOOD": ["vh"],
    "SAR_RVI":   ["vv", "vh"],
}

INDICATOR_ALIAS_MAP = {
    "Green Forest Change":      "SCL",
    "GREEN FOREST CHANGE":      "SCL",
    "Soil Fertility Map":       "SFM",
    "SOIL FERTILITY MAP":       "SFM",
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
            query=query,
        ).item_collection()
    return list(result)


# ── Sensor → (source, collection) for historical viewer ──────────────────────
SENSOR_COLLECTION_VIEWER = {
    "sentinel-2":  ("element84",  "sentinel-2-l2a"),
    "sentinel-1":  ("element84",  "sentinel-1-grd"),
    "landsat":     ("planetary",  "landsat-c2-l2"),
    "sentinel-3":  ("cdse_odata", None),       # uses CDSE OData search_sentinel3
    "copdem":      ("element84",  "cop-dem-glo-30"),
    "enmap":       ("dlr",        "ENMAP_HSI_L2A"),
    "planet-open": ("planet",     "open-skysat-data"),
}

SENSOR_LABEL = {
    "sentinel-2-l2a":  "Sentinel-2",
    "sentinel-1-grd":  "Sentinel-1",
    "landsat-c2-l2":   "Landsat",
    "cop-dem-glo-30":  "CopDEM",
    "ENMAP_HSI_L2A":   "EnMAP",
    "open-skysat-data": "Planet SkySat",
}

SAR_COLLECTIONS = {"sentinel-1-grd", "sentinel-1-rtc"}


def _first_asset_href(item, *keys):
    """Return the href of the first matching asset key, or None."""
    for k in keys:
        a = item.assets.get(k)
        if a and a.href and a.href.startswith("http"):
            return a.href
    return None


def _search_element84(collection, bounds, start_date, end_date, cloud_cover, limit=30):
    catalog = Client.open(STAC_URL)
    kwargs = dict(collections=[collection], bbox=list(bounds), limit=limit)
    if start_date and end_date:
        kwargs["datetime"] = f"{start_date}/{end_date}"
    if collection not in SAR_COLLECTIONS:
        kwargs["query"] = {"eo:cloud_cover": {"gte": 0, "lte": cloud_cover}}
    result = catalog.search(**kwargs)
    return list(result.get_items())


def _search_planetary(collection, bounds, start_date, end_date, cloud_cover, limit=30):
    catalog = Client.open(PC_STAC_URL)
    kwargs = dict(collections=[collection], bbox=list(bounds), limit=limit)
    if start_date and end_date:
        kwargs["datetime"] = f"{start_date}/{end_date}"
    if collection not in SAR_COLLECTIONS:
        kwargs["query"] = {"eo:cloud_cover": {"gte": 0, "lte": cloud_cover}}
    result = catalog.search(**kwargs)
    return list(result.get_items())


def _search_enmap(bounds, start_date, end_date, limit=20):
    """Search DLR STAC for EnMAP L2A products."""
    catalog = Client.open(DLR_STAC_URL)
    kwargs = dict(
        collections=["ENMAP_HSI_L2A"],
        bbox=list(bounds),
        limit=limit,
    )
    if start_date and end_date:
        kwargs["datetime"] = f"{start_date}/{end_date}"
    result = catalog.search(**kwargs)
    items = list(result.get_items())
    thumbnails = []
    for item in items:
        href = _first_asset_href(item, "thumbnail", "overview", "quicklook", "visual")
        thumbnails.append({
            "datetime":      item.datetime.isoformat() if item.datetime else None,
            "thumbnail_url": href,
            "id":            item.id,
            "bbox":          item.bbox,
            "sensor":        "EnMAP",
            "collection":    "ENMAP_HSI_L2A",
            "extra": {
                "cloud_cover": item.properties.get("eo:cloud_cover"),
                "quality":     item.properties.get("enmap:overallQuality"),
            },
        })
    return thumbnails


def _search_planet_open(bounds, start_date, end_date, collection="planet-stac-skysat", limit=15):
    """Browse Planet open-data static STAC catalog for SkySat scenes."""
    import pystac
    try:
        cat = pystac.read_file(PLANET_STAC_URL)
        # Find the matching child collection
        target = None
        for child in cat.get_children():
            if collection in child.get_self_href():
                target = child
                break
        if target is None:
            return []

        # Resolve the child to get its items
        target.resolve_links()
        items = []
        for item in target.get_items(recursive=True):
            # bbox check
            if item.bbox:
                bx = item.bbox
                if bx[2] < bounds[0] or bx[0] > bounds[2] or bx[3] < bounds[1] or bx[1] > bounds[3]:
                    continue
            # date check
            if item.datetime and start_date and end_date:
                d = item.datetime.strftime("%Y-%m-%d")
                if d < start_date or d > end_date:
                    continue
            href = _first_asset_href(item, "thumbnail", "visual", "overview", "analytic")
            items.append({
                "datetime":      item.datetime.isoformat() if item.datetime else None,
                "thumbnail_url": href,
                "id":            item.id,
                "bbox":          item.bbox or list(bounds),
                "sensor":        "Planet SkySat",
                "collection":    collection,
            })
            if len(items) >= limit:
                break
        return items
    except Exception as e:
        print(f"[PlanetOpen] Error: {e}")
        return []


def historical_viewer(params):
    bounds = get_bounds(params.geojson)
    sensors     = getattr(params, "sensors",     None) or ["sentinel-2"]
    cloud_cover = getattr(params, "cloud_cover", 30)   or 30

    thumbnails = []

    for sensor_key in sensors:
        source, collection = SENSOR_COLLECTION_VIEWER.get(sensor_key.lower(), ("element84", "sentinel-2-l2a"))
        label = SENSOR_LABEL.get(collection, sensor_key)

        try:
            if source == "element84":
                # CopDEM is a static dataset — skip date filter so tiles are always returned
                sd = None if sensor_key == "copdem" else params.start_date
                ed = None if sensor_key == "copdem" else params.end_date
                items = _search_element84(collection, bounds, sd, ed, cloud_cover)
                for item in items:
                    if not item.bbox:
                        continue
                    href = _first_asset_href(item, "thumbnail", "overview")
                    thumbnails.append({
                        "datetime":      item.datetime.isoformat() if item.datetime else None,
                        "thumbnail_url": href,
                        "id":            item.id,
                        "bbox":          item.bbox,
                        "sensor":        label,
                        "collection":    collection,
                    })

            elif source == "planetary":
                items = _search_planetary(
                    collection, bounds,
                    params.start_date, params.end_date,
                    cloud_cover,
                )
                for item in items:
                    if not item.bbox:
                        continue
                    href = _first_asset_href(item, "rendered_preview", "thumbnail", "overview")
                    thumbnails.append({
                        "datetime":      item.datetime.isoformat() if item.datetime else None,
                        "thumbnail_url": href,
                        "id":            item.id,
                        "bbox":          item.bbox,
                        "sensor":        label,
                        "collection":    collection,
                    })

            elif source == "cdse_odata":
                # Sentinel-3: use existing CDSE OData search, build quicklook proxy URLs
                from services.cdse_service import search_sentinel3
                result = search_sentinel3(
                    list(bounds),
                    params.start_date, params.end_date,
                    product_type="S3_OLCI_L2_LFR",
                    max_results=20,
                )
                for p in result.get("products", []):
                    pid = p.get("id")
                    # quicklook served via express proxy (needs CDSE creds)
                    qk_url = f"/api/ghg/quicklook/{pid}" if pid else None
                    thumbnails.append({
                        "datetime":      p.get("datetime"),
                        "thumbnail_url": qk_url,
                        "id":            pid or p.get("name", ""),
                        "bbox":          list(bounds),
                        "sensor":        "Sentinel-3",
                        "collection":    "S3_OLCI_L2_LFR",
                    })

            elif source == "dlr":
                thumbnails.extend(
                    _search_enmap(bounds, params.start_date, params.end_date)
                )

            elif source == "planet":
                thumbnails.extend(
                    _search_planet_open(bounds, params.start_date, params.end_date, collection)
                )

        except Exception as e:
            print(f"[HistoricalViewer] Error querying {sensor_key} ({source}): {e}")

    thumbnails.sort(key=lambda x: x.get("datetime") or "", reverse=True)
    return {"count": len(thumbnails), "thumbnails": thumbnails}
