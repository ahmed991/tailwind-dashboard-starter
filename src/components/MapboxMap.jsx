import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = "pk.eyJ1IjoiZmZiLWdpcyIsImEiOiJjbTRwZ2o0aW8wdTdiMmpyMjQxZnhoaW1kIn0.wdZgBjvbzlC5pF2yg8fCpw";

export default function MapboxMap({ zoom, onMapReady }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-93.625, 42.025],
        zoom,
      });

      map.current.on("load", () => {
        // Notify App once map is ready
        onMapReady(map.current);

        // Add empty GeoJSON source for species
        map.current.addSource("species-points", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        // Add a layer to display species as circles
        map.current.addLayer({
          id: "species-points-layer",
          type: "circle",
          source: "species-points",
          paint: {
            "circle-radius": 5,
            "circle-color": "#FF8800",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000000"
          }
        });

        // Add farm polygon source/layer if needed
        map.current.addSource("farm-polygons", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.current.addLayer({
          id: "farm-polygons-layer",
          type: "fill",
          source: "farm-polygons",
          paint: {
            "fill-color": "#00FF88",
            "fill-opacity": 0.3
          }
        });
      });
    } else if (map.current) {
      map.current.setZoom(zoom);
    }
  }, [zoom]);

  return <div ref={mapContainer} className="absolute inset-0 z-0" />;
}
