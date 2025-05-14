// src/components/MapboxMap.jsx
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

mapboxgl.accessToken = "pk.eyJ1IjoiZmZiLWdpcyIsImEiOiJjbTRwZ2o0aW8wdTdiMmpyMjQxZnhoaW1kIn0.wdZgBjvbzlC5pF2yg8fCpw";

export default function MapboxMap({
  zoom,
  onMapReady,
  onDrawCreate = () => {},
  onDrawUpdate = () => {},
  onDrawDelete = () => {},
  onMapClick = () => {},
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-93.625, 42.025],
        zoom,
      });

      // Initialize draw
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          point: true,
          line_string: true,
          trash: true,
        },
      });
      map.current.addControl(draw.current, "top-left");

      // On map load
      map.current.on("load", () => {
        onMapReady(map.current);

        // add sources / layers here if needed...
      });

      // Draw events
      map.current.on("draw.create", (e) => onDrawCreate(e.features));
      map.current.on("draw.update", (e) => onDrawUpdate(e.features));
      map.current.on("draw.delete", (e) => onDrawDelete(e.features));

      // Map click event
      map.current.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        onMapClick({ lng, lat });
      });
    }
    // respond to zoom prop changes
    else if (map.current) {
      map.current.setZoom(zoom);
    }
  }, [
    zoom,
    onMapReady,
    onDrawCreate,
    onDrawUpdate,
    onDrawDelete,
    onMapClick,
  ]);

  return <div ref={mapContainer} className="absolute inset-0 z-0" />;
}
