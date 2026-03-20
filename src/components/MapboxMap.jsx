// src/components/MapboxMap.jsx
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ID;
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

const BASEMAPS = [
  { id: "satellite", label: "SAT", style: "mapbox://styles/mapbox/satellite-streets-v12" },
  { id: "light",     label: "MAP", style: "mapbox://styles/mapbox/light-v11" },
  { id: "dark",      label: "DRK", style: "mapbox://styles/mapbox/dark-v11" },
];

export default function MapboxMap({
  zoom,
  onMapReady,
  onStyleReload = () => {},
  onDrawCreate = () => {},
  onDrawUpdate = () => {},
  onDrawDelete = () => {},
  onMapClick = () => {},
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const searchBoxContainer = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState("satellite");

  function switchBasemap(basemap) {
    if (!map.current) return;
    setActiveBasemap(basemap.id);
    map.current.setStyle(basemap.style);
    // Re-add custom layers once the new style finishes loading
    map.current.once("style.load", () => {
      onStyleReload(map.current, draw.current);
    });
  }

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
        className="absolute top-12 right-3 z-10"
      />
      {/* Basemap switcher */}
      <div className="absolute bottom-10 left-3 z-10 flex flex-col gap-1">
        {BASEMAPS.map(bm => (
          <button
            key={bm.id}
            onClick={() => switchBasemap(bm)}
            title={bm.style.split("/").pop()}
            className={`w-9 h-7 rounded text-[9px] font-bold tracking-wider transition-all shadow-md ${
              activeBasemap === bm.id
                ? "bg-white text-gray-900 ring-1 ring-white/60"
                : "bg-black/50 text-white/70 hover:bg-black/70 hover:text-white backdrop-blur-sm"
            }`}
          >
            {bm.label}
          </button>
        ))}
      </div>
    </div>
  );
}
