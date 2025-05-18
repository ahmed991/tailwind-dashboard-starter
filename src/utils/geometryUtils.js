export function wktToCoordinates(wkt) {
    return wkt
      .replace("POLYGON((", "")
      .replace("))", "")
      .split(",")
      .map(p => p.trim().split(" ").map(Number));
  }
  
  export function getPolygonCenter(coords) {
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
  
    return [
      (Math.min(...lons) + Math.max(...lons)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2
    ];
  }
  
  export function buildGeoJSON(coords) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }
      ]
    };
  }
  