"""
Copernicus Data Space Ecosystem (CDSE) Service
Handles Sentinel-3 and other datasets not available on Element84 STAC.

Free registration: https://dataspace.copernicus.eu/
API docs: https://documentation.dataspace.copernicus.eu/
"""

import os
import requests
from datetime import datetime
from typing import Optional

CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_CATALOG_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1"
CDSE_STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac/v1"

CDSE_USER = os.getenv("CDSE_USER", "")
CDSE_PASSWORD = os.getenv("CDSE_PASSWORD", "")

# Sentinel-3 product types supported
SENTINEL3_PRODUCTS = {
    "S3_OLCI_L2_LFR": {
        "display": "Sentinel-3 OLCI Land (Vegetation, OGVI, OTCI)",
        "description": "Chlorophyll, vegetation fraction, terrestrial chlorophyll index",
        "use_case": "Crop health, vegetation monitoring",
    },
    "S3_SLSTR_L2_LST": {
        "display": "Sentinel-3 SLSTR Land Surface Temperature",
        "description": "Land surface temperature at 1km resolution",
        "use_case": "Drought stress, thermal anomaly detection",
    },
    "S3_OLCI_L2_WFR": {
        "display": "Sentinel-3 OLCI Water (Chlorophyll, TSM, CDM)",
        "description": "Ocean/water colour: chlorophyll-a, total suspended matter",
        "use_case": "Water quality monitoring (Sentinel-3 sub-task)",
    },
    "S3_SRA_A": {
        "display": "Sentinel-3 SRAL Altimetry (Water Level)",
        "description": "Inland water level and surface elevation",
        "use_case": "Flood risk, irrigation water resource mapping",
    }
}


def _get_cdse_token() -> Optional[str]:
    """Get OAuth2 access token from CDSE."""
    if not CDSE_USER or not CDSE_PASSWORD:
        return None
    try:
        response = requests.post(
            CDSE_TOKEN_URL,
            data={
                "client_id": "cdse-public",
                "username": CDSE_USER,
                "password": CDSE_PASSWORD,
                "grant_type": "password",
            },
            timeout=15,
        )
        response.raise_for_status()
        return response.json().get("access_token")
    except Exception as e:
        print(f"[CDSE] Token error: {e}")
        return None


def search_sentinel3(
    bounds: list,
    start_date: str,
    end_date: str,
    product_type: str = "S3_OLCI_L2_LFR",
    max_results: int = 20,
) -> dict:
    """
    Search CDSE catalog for Sentinel-3 products.

    Args:
        bounds: [min_lon, min_lat, max_lon, max_lat]
        start_date: ISO date string (YYYY-MM-DD)
        end_date: ISO date string (YYYY-MM-DD)
        product_type: One of SENTINEL3_PRODUCTS keys
        max_results: Maximum number of results

    Returns:
        dict with products list and metadata
    """
    if not CDSE_USER or not CDSE_PASSWORD:
        return {
            "status": "no_credentials",
            "message": "CDSE credentials not configured. Register free at dataspace.copernicus.eu and set CDSE_USER + CDSE_PASSWORD env vars.",
            "products": [],
            "product_info": SENTINEL3_PRODUCTS.get(product_type, {}),
        }

    token = _get_cdse_token()
    if not token:
        return {"status": "auth_failed", "message": "Could not authenticate with CDSE", "products": []}

    min_lon, min_lat, max_lon, max_lat = bounds
    bbox_wkt = f"POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))"

    # Map our product type key to CDSE collection name
    collection_map = {
        "S3_OLCI_L2_LFR": "SENTINEL-3",
        "S3_SLSTR_L2_LST": "SENTINEL-3",
        "S3_OLCI_L2_WFR": "SENTINEL-3",
        "S3_SRA_A": "SENTINEL-3",
    }
    collection = collection_map.get(product_type, "SENTINEL-3")

    try:
        params = {
            "$filter": (
                f"Collection/Name eq '{collection}' "
                f"and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq '{product_type}') "
                f"and OData.CSC.Intersects(area=geography'SRID=4326;{bbox_wkt}') "
                f"and ContentDate/Start gt {start_date}T00:00:00.000Z "
                f"and ContentDate/Start lt {end_date}T23:59:59.999Z"
            ),
            "$orderby": "ContentDate/Start desc",
            "$top": max_results,
            "$expand": "Assets",
        }

        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{CDSE_CATALOG_URL}/Products",
            params=params,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        products = []
        for item in data.get("value", []):
            products.append({
                "id": item.get("Id"),
                "name": item.get("Name"),
                "datetime": item.get("ContentDate", {}).get("Start"),
                "size_mb": round(item.get("ContentLength", 0) / 1e6, 1),
                "online": item.get("Online", False),
                "footprint": item.get("Footprint"),
            })

        return {
            "status": "success",
            "product_type": product_type,
            "product_info": SENTINEL3_PRODUCTS.get(product_type, {}),
            "count": len(products),
            "products": products,
        }

    except Exception as e:
        return {"status": "error", "message": str(e), "products": []}


def get_sentinel3_product_types() -> dict:
    """Return available Sentinel-3 product types."""
    return {
        "sentinel-3": {
            "display_name": "Sentinel-3 (Copernicus / CDSE)",
            "resolution": "300m",
            "revisit": "~2 days",
            "products": SENTINEL3_PRODUCTS,
            "requires_credentials": True,
            "credential_source": "https://dataspace.copernicus.eu/",
        }
    }


# ---------------------------------------------------------------------------
# Sentinel-5P / TROPOMI — Greenhouse Gas & Air Quality
# ---------------------------------------------------------------------------

SENTINEL5P_PRODUCTS = {
    "L2__CO____": {
        "display": "Carbon Monoxide (CO)",
        "description": "Total column CO mixing ratio",
        "unit": "mol/m²",
        "ghg_module": "CO",
    },
    "L2__CH4___": {
        "display": "Methane (CH4)",
        "description": "Dry-air column-averaged mixing ratio of CH4 (XCH4)",
        "unit": "ppb",
        "ghg_module": "CH4",
    },
    "L2__NO2___": {
        "display": "Nitrogen Dioxide (NO2)",
        "description": "Tropospheric + stratospheric NO2 vertical column",
        "unit": "mol/m²",
        "ghg_module": "NO2",
    },
    "L2__O3____": {
        "display": "Ozone (O3)",
        "description": "Total ozone column",
        "unit": "DU",
        "ghg_module": "O3",
    },
    "L2__SO2___": {
        "display": "Sulphur Dioxide (SO2)",
        "description": "Total SO2 vertical column density",
        "unit": "mol/m²",
        "ghg_module": "SO2",
    },
}


def search_sentinel5p(
    bounds: list,
    start_date: str,
    end_date: str,
    product_type: str = "L2__CO____",
    max_results: int = 20,
) -> dict:
    """
    Search CDSE catalog for Sentinel-5P TROPOMI products.

    Args:
        bounds: [min_lon, min_lat, max_lon, max_lat]
        start_date: ISO date string (YYYY-MM-DD)
        end_date: ISO date string (YYYY-MM-DD)
        product_type: One of SENTINEL5P_PRODUCTS keys
        max_results: Maximum number of results

    Returns:
        dict with products list and metadata
    """
    if product_type not in SENTINEL5P_PRODUCTS:
        return {
            "status": "error",
            "message": f"Unknown product type '{product_type}'. Valid: {list(SENTINEL5P_PRODUCTS.keys())}",
            "products": [],
        }

    if not CDSE_USER or not CDSE_PASSWORD:
        return {
            "status": "no_credentials",
            "message": "CDSE credentials not configured. Register free at dataspace.copernicus.eu and set CDSE_USER + CDSE_PASSWORD env vars.",
            "products": [],
            "product_info": SENTINEL5P_PRODUCTS.get(product_type, {}),
        }

    token = _get_cdse_token()
    if not token:
        return {"status": "auth_failed", "message": "Could not authenticate with CDSE", "products": []}

    min_lon, min_lat, max_lon, max_lat = bounds
    bbox_wkt = (
        f"POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},"
        f"{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))"
    )

    try:
        params = {
            "$filter": (
                f"Collection/Name eq 'SENTINEL-5P' "
                f"and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' "
                f"and att/OData.CSC.StringAttribute/Value eq '{product_type}') "
                f"and OData.CSC.Intersects(area=geography'SRID=4326;{bbox_wkt}') "
                f"and ContentDate/Start gt {start_date}T00:00:00.000Z "
                f"and ContentDate/Start lt {end_date}T23:59:59.999Z"
            ),
            "$orderby": "ContentDate/Start desc",
            "$top": max_results,
            "$expand": "Assets",
        }

        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{CDSE_CATALOG_URL}/Products",
            params=params,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        products = []
        for item in data.get("value", []):
            products.append({
                "id": item.get("Id"),
                "name": item.get("Name"),
                "datetime": item.get("ContentDate", {}).get("Start"),
                "size_mb": round(item.get("ContentLength", 0) / 1e6, 1),
                "online": item.get("Online", False),
                "footprint": item.get("Footprint"),
                "ghg_variable": SENTINEL5P_PRODUCTS[product_type]["ghg_module"],
                "unit": SENTINEL5P_PRODUCTS[product_type]["unit"],
            })

        return {
            "status": "success",
            "product_type": product_type,
            "product_info": SENTINEL5P_PRODUCTS[product_type],
            "count": len(products),
            "products": products,
        }

    except Exception as e:
        return {"status": "error", "message": str(e), "products": []}


def get_sentinel5p_product_types() -> dict:
    """Return available Sentinel-5P product types."""
    return {
        "sentinel-5p": {
            "display_name": "Sentinel-5P TROPOMI (Copernicus / CDSE)",
            "resolution": "5.5 × 3.5 km",
            "revisit": "~1 day",
            "products": SENTINEL5P_PRODUCTS,
            "requires_credentials": True,
            "credential_source": "https://dataspace.copernicus.eu/",
        }
    }
