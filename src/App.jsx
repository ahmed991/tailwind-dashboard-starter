import { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import MapboxMap from "./components/MapboxMap";
import { useAuth } from "./context/AuthContext";
import { useFarms } from "./context/FarmContext";
import LoginPage from "./components/LoginPage";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DetailPanel from "./components/DetailPanel";
import CaseStudyPanel from "./components/CaseStudyPanel";
import { countSpeciesFromGeoJSON, calculateDiversity } from "./utils/biodiversity";
import { DEFAULT_FARMS } from "./data/farms";

// All /api/* calls go through the Vite proxy → express BFF (localhost:3001)
const LEGACY = "/api";

export default function App() {
  const { isAuthenticated } = useAuth();
  const { farms } = useFarms();

  // Map
  const [mapInstance, setMapInstance] = useState(null);
  const [drawInstance, setDrawInstance] = useState(null);
  const [zoom] = useState(1.5);

  // Panel
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  // Farms
  const [farmGeometries, setFarmGeometries] = useState(DEFAULT_FARMS);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const fileInputRef = useRef(null);

  // Biodiversity
  const [gbifSpeciesList, setGbifSpeciesList] = useState([]);
  const [inatSpeciesList, setInatSpeciesList] = useState([]);
  const [ebirdSpecies, setEbirdSpeciesList] = useState([]);
  const [ebirdHotspots, setEbirdHotspots] = useState([]);
  const [diversityMetrics, setDiversityMetrics] = useState(null);
  const [inatDiversityMetrics, setInatDiversityMetrics] = useState(null);
  const [hotspotVisible, setHotspotVisible] = useState(true);
  const [gbifVisible, setGbifVisible] = useState(true);
  const [inatVisible, setInatVisible] = useState(true);

  // Indicators / Satellite
  const [satProvider, setSatProvider] = useState("sentinel-2");
  const [resample, setResample] = useState("W");
  const [selectedIndicator, setSelectedIndicator] = useState("NDVI");
  const [indicatorFrames, setIndicatorFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [indicatorLayers, setIndicatorLayers] = useState([]);
  const selectedRangeRef = useRef(null);

  // Historical
  const [thumbnails, setThumbnails] = useState([]);
  const [activeThumbnailId, setActiveThumbnailId] = useState(null);

  // GHG
  const [selectedGHG, setSelectedGHG] = useState(null);

  // Case Study
  const [caseStudyOpen, setCaseStudyOpen] = useState(false);
  const [caseStudyItem, setCaseStudyItem] = useState(null);

  // ESA
  const [esaVisible, setEsaVisible] = useState(false);

  // Loading
  const [isLoading, setIsLoading] = useState(false);

  // --- Effects ---

  // Merge DB farms on top of defaults when PostGIS data arrives
  useEffect(() => {
    if (!farms || farms.length === 0) return;
    const geo = {};
    farms.forEach((farm) => {
      const geom = farm.geojson?.geometry;
      if (!geom) return;
      const coords = geom.type === "Polygon" ? geom.coordinates[0] : [];
      const lng = coords.reduce((s, c) => s + c[0], 0) / (coords.length || 1);
      const lat = coords.reduce((s, c) => s + c[1], 0) / (coords.length || 1);
      const wkt = coords.length
        ? `POLYGON((${coords.map((c) => `${c[0]} ${c[1]}`).join(", ")}))`
        : null;
      geo[farm.name] = { wkt, center: [lng, lat], farmId: farm.id };
    });
    setFarmGeometries({ ...DEFAULT_FARMS, ...geo });
  }, [farms]);

  // Sync indicator frame to map
  useEffect(() => {
    if (!mapInstance || indicatorFrames.length === 0) return;
    const frame = indicatorFrames[currentFrameIndex];
    if (!frame) return;
    const layerId = `indicator-${frame.timestamp}`;
    indicatorFrames.forEach((f) => {
      const id = `indicator-${f.timestamp}`;
      if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
      if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    });
    const [minX, minY, maxX, maxY] = frame.bounds;
    mapInstance.addSource(layerId, {
      type: "image",
      url: frame.png_url,
      coordinates: [[minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY]],
    });
    mapInstance.addLayer({ id: layerId, type: "raster", source: layerId, paint: { "raster-opacity": 0.7 } });
    mapInstance.fitBounds([[minX, minY], [maxX, maxY]], { padding: 20 });
  }, [mapInstance, indicatorFrames, currentFrameIndex]);

  // --- Map setup ---

  const handleMapReady = (map, draw) => {
    setMapInstance(map);
    setDrawInstance(draw);

    if (!map.getSource("uploaded-geojson")) {
      map.addSource("uploaded-geojson", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "uploaded-geojson-layer", type: "fill", source: "uploaded-geojson", paint: { "fill-color": "#888", "fill-opacity": 0.4 } });
    }
    if (!map.getSource("farm-polygons")) {
      map.addSource("farm-polygons", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "farm-polygons-layer", type: "fill", source: "farm-polygons", paint: { "fill-color": "#00ff00", "fill-opacity": 0.3, "fill-outline-color": "#006600" } });

      map.addSource("esa-worldcover", {
        type: "raster",
        tileSize: 256,
        url: "https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=esa-worldcover&item=ESA_WorldCover_10m_2021_v200_N36W123&assets=map&colormap_name=esa-worldcover&format=png",
      });
      map.addLayer({ id: "esa-worldcover-layer", type: "raster", source: "esa-worldcover", paint: { "raster-opacity": 0.5 }, layout: { visibility: "none" } });
    }
  };

  // --- File upload ---

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !mapInstance) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${LEGACY}/upload-geojson`, { method: "POST", body: form });
      const { geojson } = await res.json();
      mapInstance.getSource("uploaded-geojson").setData(geojson);

      let coords = [];
      geojson.features.forEach((f) => {
        const g = f.geometry;
        if (g.type === "Polygon") g.coordinates.flat(1).forEach((c) => coords.push(c));
        else if (g.type === "MultiPolygon") g.coordinates.flat(2).forEach((c) => coords.push(c));
        else if (g.type === "LineString") g.coordinates.forEach((c) => coords.push(c));
        else if (g.type === "Point") coords.push(g.coordinates);
      });
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      mapInstance.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 20 });

      const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
      const newWKT = `POLYGON((${coords.map((c) => `${c[0]} ${c[1]}`).join(",")}))`;
      const newFarmName = `Uploaded Farm ${Object.keys(farmGeometries).length + 1}`;
      setFarmGeometries((prev) => ({ ...prev, [newFarmName]: { wkt: newWKT, center } }));
    } catch (err) {
      console.error("Upload failed", err);
    }
    e.target.value = "";
  };

  // --- Species fetch ---

  const fetchSpeciesFromGBIF = async (geometry) => {
    try {
      const res = await fetch(`${LEGACY}/gbif/species`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry }),
      });
      const data = await res.json();
      const species = data?.species || [];
      setGbifSpeciesList(Array.from(new Set(species)));

      const speciesCounts = countSpeciesFromGeoJSON(data.geojson);
      setDiversityMetrics(Object.keys(speciesCounts).length > 0 ? calculateDiversity(speciesCounts) : null);

      if (!mapInstance || !data.geojson) return;
      const sourceId = "gbif-species-layer";
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

      const loadIcon = (name, path) => {
        if (!mapInstance.hasImage(name)) {
          mapInstance.loadImage(path, (err, img) => {
            if (!err && !mapInstance.hasImage(name)) mapInstance.addImage(name, img, { pixelRatio: 2 });
          });
        }
      };
      loadIcon("flora-icon", "/flower.png");
      loadIcon("fauna-icon", "/fauna.png");

      mapInstance.addSource(sourceId, { type: "geojson", data: data.geojson });
      mapInstance.addLayer({
        id: sourceId, type: "symbol", source: sourceId,
        layout: {
          "icon-image": ["match", ["get", "kingdom"], "Plantae", "flora-icon", "Animalia", "fauna-icon", "flora-icon"],
          "icon-size": 0.10, "icon-allow-overlap": true, "icon-anchor": "center",
        },
      });
      mapInstance.on("click", sourceId, (e) => {
        const p = e.features[0].properties;
        new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${p.name}</strong><br/>Kingdom: ${p.kingdom || "Unknown"}`).addTo(mapInstance);
      });
    } catch (err) {
      console.error("GBIF fetch failed:", err);
      setGbifSpeciesList([]);
    }
  };

  const fetchSpeciesFromINat = async (geometry) => {
    try {
      const res = await fetch(`${LEGACY}/inaturalist/species`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry }),
      });
      const data = await res.json();
      setInatSpeciesList(data.species || []);
      const geojson = data.geojson;
      if (!mapInstance || !geojson) return;

      const counts = countSpeciesFromGeoJSON(geojson);
      setInatDiversityMetrics(Object.keys(counts).length > 0 ? calculateDiversity(counts) : null);

      const sourceId = "inat-species-layer";
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      mapInstance.addSource(sourceId, { type: "geojson", data: geojson });
      mapInstance.addLayer({ id: sourceId, type: "circle", source: sourceId, paint: { "circle-radius": 6, "circle-color": "#1d4ed8", "circle-stroke-width": 1, "circle-stroke-color": "#fff" } });
      mapInstance.on("click", sourceId, (e) => {
        const p = e.features[0].properties;
        new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${p.name}</strong><br/>Observer: ${p.observer}<br/>Date: ${p.date}`).addTo(mapInstance);
      });
    } catch (err) {
      console.error("iNat fetch failed:", err);
      setInatSpeciesList([]);
      setInatDiversityMetrics(null);
    }
  };

  const fetchSpeciesFromEBird = async (lat, lng) => {
    try {
      const res = await fetch(`${LEGACY}/ebird/species`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const { geojson, speciesList = [] } = await res.json();
      setEbirdSpeciesList(speciesList);
      if (!mapInstance) return;
      const sourceId = "ebird-species-layer";
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      mapInstance.addSource(sourceId, { type: "geojson", data: geojson });
      mapInstance.addLayer({ id: sourceId, type: "circle", source: sourceId, paint: { "circle-radius": 5, "circle-color": "#ff0080", "circle-stroke-width": 1, "circle-stroke-color": "#fff" } });
      mapInstance.on("click", sourceId, (e) => {
        const p = e.features[0].properties;
        new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${p.comName}</strong><br/>Count: ${p.howMany}<br/>${p.locName || ""}<br/>Date: ${p.obsDt}`).addTo(mapInstance);
      });
    } catch (err) {
      console.error("eBird fetch failed:", err);
    }
  };

  const fetchHotspotsFromEBird = async (lat, lng) => {
    try {
      const res = await fetch(`${LEGACY}/ebird/hotspots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const { geojson } = await res.json();
      setEbirdHotspots(geojson.features.map((f) => ({ locName: f.properties.name, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })));
      if (!mapInstance) return;
      if (mapInstance.getLayer("ebird-hotspots-layer")) mapInstance.removeLayer("ebird-hotspots-layer");
      if (mapInstance.getSource("ebird-hotspots")) mapInstance.removeSource("ebird-hotspots");
      mapInstance.addSource("ebird-hotspots", { type: "geojson", data: geojson });
      const bounds = geojson.features.reduce((b, f) => b.extend(f.geometry.coordinates), new mapboxgl.LngLatBounds());
      mapInstance.fitBounds(bounds, { padding: 30 });
      mapInstance.addLayer({ id: "ebird-hotspots-layer", type: "heatmap", source: "ebird-hotspots" });
    } catch (err) {
      console.error("eBird hotspots fetch failed:", err);
    }
  };

  const fetchSpeciesForFarm = async (geometry) => {
    await Promise.all([fetchSpeciesFromGBIF(geometry), fetchSpeciesFromINat(geometry)]);
  };

  // --- Farm / draw handlers ---

  const handleFarmClick = async (farmKey) => {
    const farm = farmGeometries[farmKey];
    if (!mapInstance || !farm) return;
    mapInstance.flyTo({ center: farm.center, zoom: 16 });
    const coords = farm.wkt.replace("POLYGON((", "").replace("))", "").split(",").map((p) => p.trim().split(" ").map(Number));
    mapInstance.getSource("farm-polygons")?.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: { name: farmKey } }],
    });
  };

  const handleSelect = async (section, item) => {
    if (section === "Case Study") {
      setCaseStudyItem(item);
      setCaseStudyOpen(true);
      setDetailOpen(false);
      return;
    }
    setCaseStudyOpen(false);
    setActiveSection(section);
    setActiveItem(item);
    setDetailOpen(false);
    setTimeout(() => setDetailOpen(true), 50);

    if (section === "Biodiversity Assessment") {
      const farm = farmGeometries[selectedFarm];
      if (!farm) return;
      if (item === "Species Observation Log") await fetchSpeciesForFarm(farm.wkt);
      else if (item === "Bird Species Data") await fetchSpeciesFromEBird(farm.center[1], farm.center[0]);
      else if (item === "Biodiversity Hotspot Viewer") await fetchHotspotsFromEBird(farm.center[1], farm.center[0]);
    }
  };

  const handleDrawCreate = (e) => {
    if (!e?.features?.length) return;
    const feature = e.features[0];
    if (feature.geometry.type !== "Polygon") return;
    const coords = feature.geometry.coordinates?.[0];
    if (!coords) return;
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
    let name = window.prompt("Enter a name for your new farm:", `Drawn Farm ${Object.keys(farmGeometries).length + 1}`);
    if (!name) name = `Drawn Farm ${Object.keys(farmGeometries).length + 1}`;
    const wkt = `POLYGON((${coords.map((c) => `${c[0]} ${c[1]}`).join(",")}))`;
    setFarmGeometries((prev) => ({ ...prev, [name]: { wkt, center } }));
  };

  // --- Auth guard ---
  if (!isAuthenticated) return <LoginPage />;

  // --- Render ---
  return (
    <div className="flex h-full overflow-hidden font-body">
      <Sidebar onSelect={handleSelect} activeItem={activeItem} />

      <div className="relative flex-1 bg-black overflow-hidden">
        <Topbar onUploadClick={handleUploadClick} />

        <input type="file" accept=".geojson,application/geo+json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

        <MapboxMap zoom={zoom} onMapReady={handleMapReady} onDrawCreate={handleDrawCreate} onDrawUpdate={() => {}} onDrawDelete={() => {}} onMapClick={() => {}} />

        {/* ESA Landcover legend */}
        {esaVisible && (
          <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded shadow text-xs z-50">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">ESA Landcover Legend</h4>
            <table className="table-auto text-left">
              <tbody>
                {[
                  { label: "Tree cover", color: "rgb(0,100,0)" },
                  { label: "Shrubland", color: "rgb(255,187,34)" },
                  { label: "Grassland", color: "rgb(255,255,76)" },
                  { label: "Cropland", color: "rgb(240,150,255)" },
                  { label: "Built-up", color: "rgb(250,0,0)" },
                  { label: "Bare / sparse vegetation", color: "rgb(180,180,180)" },
                  { label: "Snow and ice", color: "rgb(240,240,240)" },
                  { label: "Permanent water bodies", color: "rgb(0,100,200)" },
                  { label: "Herbaceous wetland", color: "rgb(0,150,160)" },
                  { label: "Mangroves", color: "rgb(0,207,117)" },
                  { label: "Moss and lichen", color: "rgb(250,230,160)" },
                ].map((item, idx) => (
                  <tr key={idx}>
                    <td><div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: item.color }} /></td>
                    <td className="pl-2">{item.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Indicator legend */}
        {indicatorLayers.some((l) => l.visible) && indicatorFrames[currentFrameIndex]?.legend_url && (
          <div className="absolute bottom-24 left-4 bg-white bg-opacity-90 p-3 rounded shadow text-xs z-50">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Indicator Legend</h4>
            <img src={indicatorFrames[currentFrameIndex].legend_url} alt="Legend" className="max-w-[180px] max-h-[50px] object-contain" />
          </div>
        )}

        <CaseStudyPanel
          open={caseStudyOpen}
          onClose={() => setCaseStudyOpen(false)}
          item={caseStudyItem}
          mapInstance={mapInstance}
        />

        <DetailPanel
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          section={activeSection}
          item={activeItem}
          gbifSpecies={gbifSpeciesList}
          inatSpecies={inatSpeciesList}
          farms={farmGeometries}
          onFarmSelect={handleFarmClick}
          onUploadClick={handleUploadClick}
          satProvider={satProvider}
          setSatProvider={setSatProvider}
          selectedFarm={selectedFarm}
          setSelectedFarm={setSelectedFarm}
          selectedRangeRef={selectedRangeRef}
          selectedGHG={selectedGHG}
          setSelectedGHG={setSelectedGHG}
          thumbnails={thumbnails}
          setThumbnails={setThumbnails}
          mapInstance={mapInstance}
          activeThumbnailId={activeThumbnailId}
          setActiveThumbnailId={setActiveThumbnailId}
          ebirdSpecies={ebirdSpecies}
          ebirdHotspots={ebirdHotspots}
          resample={resample}
          setResample={setResample}
          selectedIndicator={selectedIndicator}
          setSelectedIndicator={setSelectedIndicator}
          currentFrameIndex={currentFrameIndex}
          setCurrentFrameIndex={setCurrentFrameIndex}
          indicatorFrames={indicatorFrames}
          setIndicatorFrames={setIndicatorFrames}
          indicatorLayers={indicatorLayers}
          setIndicatorLayers={setIndicatorLayers}
          hotspotVisible={hotspotVisible}
          setHotspotVisible={setHotspotVisible}
          gbifVisible={gbifVisible}
          setGbifVisible={setGbifVisible}
          inatVisible={inatVisible}
          setInatVisible={setInatVisible}
          esaVisible={esaVisible}
          setEsaVisible={setEsaVisible}
          diversityMetrics={diversityMetrics}
          inatDiversityMetrics={inatDiversityMetrics}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          drawInstance={drawInstance}
        />

        {isLoading && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="h-24 w-24 rounded-full animate-spin border-8 border-white border-t-emerald-400 border-b-sky-400" />
          </div>
        )}
      </div>
    </div>
  );
}
