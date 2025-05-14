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

    map.current.on("load", () => {
      onMapReady(map.current, draw.current);
      const ctrlContainer = mapContainer.current.querySelector(".mapboxgl-ctrl-top-left");
  if (ctrlContainer) {
    ctrlContainer.style.top = "60px"; // or match your topbar height
  }
    });

    map.current.on("draw.create", (e) => onDrawCreate(e));
    map.current.on("draw.update", (e) => onDrawUpdate(e.features));
    map.current.on("draw.delete", (e) => onDrawDelete(e.features));

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      onMapClick({ lng, lat });
    });
  }

  // ✅ Do NOT control zoom externally unless absolutely needed
}, [
  onMapReady,
  onDrawCreate,
  onDrawUpdate,
  onDrawDelete,
  onMapClick,
]);

  return <div ref={mapContainer} className="absolute inset-0 z-0" />;
}
