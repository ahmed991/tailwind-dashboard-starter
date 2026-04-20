import numpy as np
import xarray as xr


def compute(indicator: str, stack) -> xr.DataArray:
    if indicator == "NDVI":
        nir = stack.sel(band="nir")
        red = stack.sel(band="red")
        return (nir - red) / (nir + red + 1e-6)

    elif indicator == "NDWI":
        # McFeeters (1996): positive values = open water; negative = vegetation/soil
        nir = stack.sel(band="nir")
        green = stack.sel(band="green")
        return (green - nir) / (green + nir + 1e-6)

    elif indicator == "PVI":
        nir = stack.sel(band="nir")
        red = stack.sel(band="red")
        return 1.5 * ((nir - 0.5 * red) / np.sqrt(1.25))

    elif indicator == "NDMI":
        nir = stack.sel(band="nir")
        swir = stack.sel(band="swir16")
        return (nir - swir) / (nir + swir + 1e-6)

    elif indicator == "EVI":
        nir = stack.sel(band="nir")
        red = stack.sel(band="red")
        blue = stack.sel(band="blue")
        return 2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 1)

    elif indicator == "MSI":
        return stack.sel(band="swir16") / stack.sel(band="nir")

    elif indicator == "SAVI":
        nir = stack.sel(band="nir")
        red = stack.sel(band="red")
        L = 0.5
        return ((nir - red) / (nir + red + L)) * (1 + L)

    elif indicator == "NDRE":
        # Normalized Difference Red Edge — Sentinel-2 B8A (nir08) and B5 (rededge1)
        # High NDRE → high chlorophyll/nitrogen; low NDRE → nitrogen stress
        nir08     = stack.sel(band="nir08")
        rededge1  = stack.sel(band="rededge1")
        return (nir08 - rededge1) / (nir08 + rededge1 + 1e-6)

    elif indicator == "LAI":
        # Leaf Area Index via SAVI-based empirical formula (Baret & Guyot 1991)
        nir = stack.sel(band="nir")
        red = stack.sel(band="red")
        L = 0.5
        savi = ((nir - red) / (nir + red + L)) * (1 + L)
        # LAI = -ln((0.69 - SAVI) / 0.59) / 0.91  — clamped to [0, 8]
        savi_clamped = savi.clip(min=-0.68, max=0.68)
        lai = -np.log((0.69 - savi_clamped) / 0.59 + 1e-6) / 0.91
        return lai.clip(min=0, max=8)

    else:
        raise ValueError(f"Indicator {indicator} is not handled by vegetation_service.")
