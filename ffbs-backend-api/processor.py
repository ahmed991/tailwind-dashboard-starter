import stackstac

from services import stac_service, vegetation_service, soil_fertility_service, forest_service, crop_service, raster_service, sar_service

VEGETATION_INDICATORS = {"NDVI", "NDWI", "PVI", "NDMI", "EVI", "MSI", "SAVI", "LAI", "NDRE"}
SAR_INDICATORS = {"SAR_SM", "SAR_FLOOD", "SAR_RVI"}


def process_indicator(params):
    indicator = stac_service.resolve_indicator(params.indicator)

    bands_required = stac_service.INDICATOR_BAND_MAP.get(indicator)
    if not bands_required:
        return {"error": f"Indicator {indicator} is not supported."}

    # SAR indicators always use sentinel-1-grd regardless of selected sensor
    if indicator in SAR_INDICATORS:
        collection = stac_service.SENSOR_COLLECTION_MAP["sentinel-1"]
    else:
        collection = stac_service.SENSOR_COLLECTION_MAP.get(params.satellite_sensor)

    bounds = stac_service.get_bounds(params.geojson)

    # SAR data has no cloud cover concept — search without that filter
    cloud_cover = 100 if indicator in SAR_INDICATORS else params.cloud_cover
    items = stac_service.search_stac(collection, bounds, params.start_date, params.end_date, cloud_cover)
    if not items:
        return {"message": "No imagery found for the given parameters."}

    # SAR: 20m native resolution; optical: 10m
    resolution = 20 if indicator in SAR_INDICATORS else 10
    stack = stackstac.stack(
        items=items,
        epsg=3857,
        assets=bands_required,
        bounds_latlon=bounds,
        resolution=resolution
    ).resample(time=params.resample).median("time", keep_attrs=True).compute()

    if indicator in VEGETATION_INDICATORS:
        index = vegetation_service.compute(indicator, stack)
    elif indicator in SAR_INDICATORS:
        index = sar_service.compute(indicator, stack)
    elif indicator == "SFM":
        index = soil_fertility_service.compute(stack)
    elif indicator == "SCL":
        index = forest_service.compute(stack)
    elif indicator == "COTTON":
        index = crop_service.compute(stack)
    else:
        return {"error": f"Indicator logic for {indicator} not implemented."}

    saved_files = raster_service.save_index_outputs(index, stack.time.values, bounds, indicator)

    return {
        "message": f"{indicator} index computed.",
        "products": saved_files
    }
