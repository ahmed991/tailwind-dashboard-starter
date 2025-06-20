// src/components/MapboxMap.jsx
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

mapboxgl.accessToken = MAPBOX_TOKEN;
function loadMapboxSearchScript() {
  return new Promise((resolve, reject) => {
    if (window.MapboxSearchBox) return resolve();

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mapbox Search JS failed to load"));
    document.head.appendChild(script);
  });
}

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
  const searchBoxContainer = useRef(null);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [78.0734, 20.9405],
        zoom:13,
      });

      loadMapboxSearchScript()
        .then(() => {
          if (!map.current || !window.MapboxSearchBox) return;

          const searchBox = new window.MapboxSearchBox();
          searchBox.accessToken = mapboxgl.accessToken;
          searchBox.options = {
            types: "address,poi",
            proximity: map.current.getCenter().toArray(), // or static coords
          };
          searchBox.marker = true;
          searchBox.mapboxgl = mapboxgl;

          // Add search box to custom container
          if (searchBoxContainer.current) {
            searchBoxContainer.current.appendChild(searchBox.onAdd(map.current));
          }
        })
        .catch((err) => {
          console.error("❌ Failed to load or add MapboxSearchBox:", err);
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
  }, [onMapReady, onDrawCreate, onDrawUpdate, onDrawDelete, onMapClick]);

  return (
    <div ref={mapContainer} className="absolute inset-0 z-0">
      <div
        ref={searchBoxContainer}
        className="absolute bottom-4 right-4 z-10 bg-white p-2 shadow-md rounded"
      />
    </div>
  );
}
