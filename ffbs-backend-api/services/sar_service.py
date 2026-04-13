"""
Sentinel-1 SAR Service
Computes SAR-based indicators from Sentinel-1 GRD data via Element84 STAC.

Indicators:
  SAR_SM    — Soil Moisture (VV backscatter proxy, dB-normalised)
  SAR_FLOOD — Flood Detection (VH threshold binary mask)
  SAR_RVI   — Radar Vegetation Index = 4*VH / (VV + VH)
"""

import numpy as np
import xarray as xr


# Sentinel-1 GRD bands on Element84 STAC
SAR_BAND_MAP = {
    "SAR_SM":    ["vv"],
    "SAR_FLOOD": ["vh"],
    "SAR_RVI":   ["vv", "vh"],
}


def compute(indicator: str, stack: xr.DataArray) -> xr.DataArray:
    """
    Compute a SAR indicator from a stacked DataArray.

    Args:
        indicator: One of SAR_SM, SAR_FLOOD, SAR_RVI
        stack: xr.DataArray with a 'band' dimension containing 'vv' and/or 'vh'

    Returns:
        xr.DataArray with the computed indicator values
    """
    if indicator == "SAR_SM":
        # VV backscatter in linear DN; convert to approximate dB then normalise to [0,1]
        vv = stack.sel(band="vv").clip(min=1e-6)
        vv_db = 10 * np.log10(vv)          # typical range: -25 dB (wet) to -5 dB (dry)
        # Normalise: soil moisture proxy increases as backscatter increases
        sm = (vv_db - (-25.0)) / ((-5.0) - (-25.0))
        return sm.clip(min=0, max=1)

    elif indicator == "SAR_FLOOD":
        # VH cross-pol: flooded areas show very low backscatter (specular reflection)
        # Threshold at -20 dB → binary mask (1 = likely flooded, 0 = dry)
        vh = stack.sel(band="vh").clip(min=1e-6)
        vh_db = 10 * np.log10(vh)
        flood_mask = xr.where(vh_db < -20.0, 1.0, 0.0)
        return flood_mask

    elif indicator == "SAR_RVI":
        # Radar Vegetation Index: sensitive to canopy structure and biomass
        # RVI = 4*VH / (VV + VH)  — range [0, 1], higher = denser vegetation
        vv = stack.sel(band="vv").clip(min=1e-6)
        vh = stack.sel(band="vh").clip(min=1e-6)
        rvi = (4.0 * vh) / (vv + vh)
        return rvi.clip(min=0, max=1)

    else:
        raise ValueError(f"SAR indicator '{indicator}' is not handled by sar_service.")
