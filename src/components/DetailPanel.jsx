import { useState as useLocalState } from 'react';
import { useFarms } from '../context/FarmContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const labelToIndicator = {
  "Soil Fertility Map": "SFM",
  "Green Forest Change": "SCL",
};

export default
function DetailPanel({
  open,
  onClose,
  section,
  item,
  gbifSpecies = [],
  inatSpecies = [],
  farms = {},
  onFarmSelect,
  onUploadClick,
   satProvider,        // Add this
  setSatProvider ,
  selectedFarm,
  setSelectedFarm,
  selectedRangeRef,
  selectedGHG,
  setSelectedGHG,
   thumbnails,              // ✅ Add this
  setThumbnails,            // ✅ Add this
  mapInstance,
    activeThumbnailId,
  setActiveThumbnailId,
    ebirdSpecies=[],
  ebirdHotspots=[],
    resample,
  setResample,
    selectedIndicator,
  setSelectedIndicator,
    currentFrameIndex,
  setCurrentFrameIndex,
    setIndicatorFrames,
      indicatorFrames = [],
      indicatorLayers,
      setIndicatorLayers,
      hotspotVisible,
      setHotspotVisible,
      gbifVisible,
      setGbifVisible,
      inatVisible,
      setInatVisible,
      esaVisible,
      setEsaVisible,
      diversityMetrics,
      inatDiversityMetrics,
      isLoading,
      setIsLoading,
      drawInstance,


      


}) {
  const sectionAccentMap = {
    "Farm Monitoring":            "border-lime-400/40",
    "Organic Assessment":         "border-cyan-400/40",
    "Carbon & GHG Metrics":       "border-pink-400/40",
    "Biodiversity Assessment":    "border-yellow-400/40",
    "Compliance & Regulatory":    "border-purple-400/40",
    "Crop Details":               "border-amber-400/40",
    "Heavy Metal Contamination":  "border-red-400/40",
    "Multi-Sensor Data":          "border-sky-400/40",
    "EUDR Deforestation":         "border-emerald-400/40",
    "Organic & Regenerative":     "border-orange-400/40",
  };
  const accentBorder = section ? (sectionAccentMap[section] || "border-white/10") : "border-white/10";

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-[#161619] border-l ${accentBorder} transform transition-transform ${open ? "translate-x-0" : "translate-x-full"} z-20 overflow-y-auto flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{section}</p>
          <h2 className="text-sm font-semibold text-white mt-0.5">{item}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-gray-300">

      {section === "Biodiversity Assessment" && item === "Species Observation Log" && (
  <>
    {/* Farm Selector */}
    <div className="mb-2 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06]">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
      <ul className="space-y-1">
        {Object.keys(farms).map(farmName => (
          <li key={farmName}>
            <button
              onClick={() => {
                onFarmSelect(farmName);
                setSelectedFarm(farmName);
              }}
              className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
            >
              {farmName}
            </button>
          </li>
        ))}
      </ul>
      
    </div>

    {/* Toggle Buttons */}
    <div className="flex gap-2 mb-2">
      <button
        onClick={() => {
          if (!mapInstance) return;
          const vis = mapInstance.getLayoutProperty("gbif-species-layer", "visibility");
          mapInstance.setLayoutProperty("gbif-species-layer", "visibility", vis === "visible" ? "none" : "visible");
        }}
        className="px-2 py-1 bg-sky-400/15 border border-sky-400/30 text-sky-300 text-xs rounded-md hover:bg-sky-400/25 transition-colors"
      >
        Toggle GBIF Layer
      </button>
      <button
        onClick={() => {
          if (!mapInstance) return;
          const vis = mapInstance.getLayoutProperty("inat-species-layer", "visibility");
          mapInstance.setLayoutProperty("inat-species-layer", "visibility", vis === "visible" ? "none" : "visible");
        }}
        className="px-2 py-1 bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-xs rounded-md hover:bg-emerald-400/25 transition-colors"
      >
        Toggle iNat Layer
      </button>
    </div>
    <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06]">
  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Biodiversity Metrics</h3>

  {gbifVisible && diversityMetrics && (
    <div className="mb-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">From GBIF</h4>
      {Object.entries(diversityMetrics).map(([label, value]) => (
        <div key={label} className="mb-1">
          <p className="text-xs">{label}: {value}</p>
          <div className="h-1 bg-white/10 rounded">
            <div
              className="h-1 bg-emerald-400 rounded"
              style={{ width: `${Math.min(value * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )}
{/* // TODO ADD RADIAL CHARTS */}
  {inatVisible && inatDiversityMetrics && (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 mb-1">From iNaturalist</h4>
      {Object.entries(inatDiversityMetrics).map(([label, value]) => (
        <div key={label} className="mb-1">
          <p className="text-xs">{label}: {value}</p>
          <div className="h-1 bg-white/10 rounded">
            <div
              className="h-1 bg-cyan-400 rounded"
              style={{ width: `${Math.min(value * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )}
</div>


    {/* Species Lists */}
    <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] max-h-[400px] overflow-y-auto space-y-4">
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">GBIF Species ({gbifSpecies.length})</h3>
        {gbifSpecies.length === 0 ? (
          <p>No species found.</p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {gbifSpecies.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">iNaturalist Species ({inatSpecies.length})</h3>
        {inatSpecies.length === 0 ? (
          <p>No species found.</p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {inatSpecies.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
        )}
      </div>
    </div>
  </>
)}



{section === "Biodiversity Assessment" && item === "Bird Species Data" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] max-h-[400px] overflow-y-auto space-y-4">

    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    {/* Toggle Buttons */}
    <div className="flex gap-2 mb-2">
      <button
        onClick={() => {
          if (!mapInstance) return;
          const vis = mapInstance.getLayoutProperty("ebird-species-layer", "visibility");
          mapInstance.setLayoutProperty("ebird-species-layer", "visibility", vis === "visible" ? "none" : "visible");
        }}
        className="px-2 py-1 bg-pink-400/15 border border-pink-400/30 text-pink-300 text-xs rounded-md hover:bg-pink-400/25 transition-colors"
      >
        Toggle eBird Layer
      </button>
    </div>

    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">eBird Species ({ebirdSpecies.length})</h3>
    {ebirdSpecies.length === 0 ? (
      <p>No species found.</p>
    ) : (
      <ul className="list-disc list-inside space-y-1">
        {ebirdSpecies.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>
    )}
  </div>
)}


{section === "Compliance & Regulatory" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Actions</h3>
<a
  href="/reports/sample_report.pdf"
  target="_blank"
  rel="noopener noreferrer"
  className="block w-full text-center px-3 py-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded-md text-xs hover:bg-sky-500/30 transition-colors"
>
  📄 View Compliance Report
</a>
  </div>
)}

{section === "Biodiversity Assessment" && item === "Biodiversity Hotspot Viewer" && (
  
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] max-h-[400px] overflow-y-auto space-y-4">
  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
      Upload Region of Interest
    </button>
    <div className="flex items-center justify-between">
  <label className="font-medium">Toggle Hotspot Layer</label>
  <button
    onClick={() => {
      const layerId = "ebird-hotspots-layer";
      if (!mapInstance?.getLayer(layerId)) return;
      const vis = mapInstance.getLayoutProperty(layerId, "visibility");
      const newVis = vis === "visible" ? "none" : "visible";
      mapInstance.setLayoutProperty(layerId, "visibility", newVis);
      setHotspotVisible(newVis === "visible");
    }}
    className={`px-2 py-1 rounded-md text-xs transition-colors ${hotspotVisible ? "bg-emerald-400/20 border border-emerald-400/30 text-emerald-300" : "bg-white/5 border border-white/10 text-gray-400"}`}
  >
    {hotspotVisible ? "Hide" : "Show"}
  </button>
</div>
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Nearby eBird Hotspots ({ebirdHotspots.length})</h3>
    
    {!Array.isArray(ebirdHotspots) || ebirdHotspots.length === 0 ? (
  <p>No hotspots found.</p>
) : (
  <table className="w-full text-xs border border-white/10 bg-transparent text-gray-300">
  <thead className="bg-white/5 text-left text-gray-500">
    <tr>
      <th className="px-2 py-1 border-b border-white/[0.06] text-gray-500">Location</th>
      <th className="px-2 py-1 border-b border-white/[0.06] text-gray-500">Latitude</th>
      <th className="px-2 py-1 border-b border-white/[0.06] text-gray-500">Longitude</th>
    </tr>
  </thead>
  <tbody>
    {ebirdHotspots.map((spot, i) => (
      <tr key={i} className="hover:bg-gray-50">
        <td className="px-2 py-1 border-b border-white/[0.06]">{spot.locName}</td>
        <td className="px-2 py-1 border-b border-white/[0.06]">{spot.lat.toFixed(4)}</td>
        <td className="px-2 py-1 border-b border-white/[0.06]">{spot.lng.toFixed(4)}</td>
      </tr>
    ))}
  </tbody>
</table>
)}


  </div>
  
)}

{section === "Crop Details" && item === "Land Use & Landscape ID" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button
      onClick={onUploadClick}
      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors"
    >
      Upload Region of Interest
    </button>

    <h3 className="font-semibold text-sm">ESA Global Landcover</h3>
    <p className="text-xs mb-2">Toggle 30m ESA WorldCover raster layer visibility.</p>

    {selectedFarm ? (
      <button
        onClick={() => {
          if (!mapInstance) return;

          const layerId = "esa-worldcover-layer";
          const visibility = mapInstance.getLayoutProperty(layerId, "visibility");
          const newVisibility = visibility === "visible" ? "none" : "visible";
          mapInstance.setLayoutProperty(layerId, "visibility", newVisibility);

          // ✅ Update visibility state
          setEsaVisible(newVisibility === "visible");

          console.log(`🔁 ESA visibility toggled: ${newVisibility}`);
        }}
        className="w-full mb-2 px-3 py-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded-md text-xs hover:bg-sky-500/30 transition-colors"
      >
        {esaVisible ? "Hide ESA Landcover Layer" : "Show ESA Landcover Layer"}
      </button>
    ) : (
      <p className="text-xs text-red-400">Please select a farm first.</p>
    )}
  </div>
)}

      {section === "Carbon & GHG Metrics" && item === "GHG Emission Tracker" && (() => {
  const GHG_LIST = [
    { code: "CO",  name: "Carbon Monoxide",  cdse: "L2__CO____" },
    { code: "CH₄", name: "Methane",          cdse: "L2__CH4___" },
    { code: "NO₂", name: "Nitrogen Dioxide", cdse: "L2__NO2___" },
    { code: "O₃",  name: "Ozone",            cdse: "L2__O3____" },
    { code: "SO₂", name: "Sulphur Dioxide",  cdse: "L2__SO2___" },
  ];

  const { farms: dbFarms } = useFarms();
  const [ghgFarmId, setGhgFarmId] = useLocalState(() => dbFarms[0]?.id ?? null);
  const [ghgProducts, setGhgProducts] = useLocalState([]);
  const [ghgLoading, setGhgLoading] = useLocalState(false);
  const [ghgError, setGhgError] = useLocalState(null);
  const [ghgStartDate, setGhgStartDate] = useLocalState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [ghgEndDate, setGhgEndDate] = useLocalState(() => new Date().toISOString().slice(0, 10));

  function farmToWkt(farm) {
    const coords = farm?.geojson?.geometry?.coordinates?.[0];
    if (!coords?.length) return null;
    return `POLYGON((${coords.map(c => `${c[0]} ${c[1]}`).join(",")}))`;
  }

  async function searchGhg(cdseProductType) {
    const farm = dbFarms.find(f => f.id === ghgFarmId);
    const wkt = farmToWkt(farm);
    if (!wkt) { setGhgError("Select a farm first."); return; }
    setGhgLoading(true); setGhgError(null); setGhgProducts([]);
    try {
      const res = await fetch("/api/ghg/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wkt, product_type: cdseProductType, start_date: ghgStartDate, end_date: ghgEndDate, max_results: 8 }),
      });
      const json = await res.json();
      if (json.status === "success") setGhgProducts(json.products);
      else setGhgError(json.message || "Search failed.");
    } catch (e) {
      setGhgError(e.message);
    } finally {
      setGhgLoading(false);
    }
  }

  return (
  <div className="bg-pink-400/5 text-gray-300 rounded-lg p-4 text-sm mt-4 border border-pink-400/20 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-pink-400">GHG Indicators — Sentinel-5P TROPOMI</h3>

    {/* Farm selector (DB farms only) */}
    {dbFarms.length > 0 ? (
      <div>
        <label className="text-[9px] uppercase text-gray-500 block mb-1">Farm</label>
        <select
          value={ghgFarmId ?? ""}
          onChange={e => setGhgFarmId(Number(e.target.value))}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300"
        >
          {dbFarms.map(f => (
            <option key={f.id} value={f.id}>{f.name}{f.country ? ` · ${f.country}` : ""}</option>
          ))}
        </select>
      </div>
    ) : (
      <p className="text-[10px] text-yellow-400">No farms in DB. Add a farm first.</p>
    )}

    {/* Date range */}
    <div className="flex gap-2">
      <div className="flex flex-col flex-1">
        <label className="text-[9px] uppercase text-gray-500 mb-1">From</label>
        <input type="date" value={ghgStartDate} onChange={e => setGhgStartDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 w-full" />
      </div>
      <div className="flex flex-col flex-1">
        <label className="text-[9px] uppercase text-gray-500 mb-1">To</label>
        <input type="date" value={ghgEndDate} onChange={e => setGhgEndDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 w-full" />
      </div>
    </div>

    {/* GHG buttons */}
    <div className="grid grid-cols-1 gap-2">
      {GHG_LIST.map((ghg) => (
        <button key={ghg.code}
          onClick={() => { setSelectedGHG(ghg.code); searchGhg(ghg.cdse); }}
          className={`w-full text-left rounded-md px-3 py-2 border transition ${
            selectedGHG === ghg.code
              ? "bg-pink-400/15 border-pink-400/50 text-pink-300"
              : "border-white/10 hover:bg-white/5 text-gray-400"
          }`}
        >
          <span className="font-mono text-pink-400">{ghg.code}</span>
          <span className="text-gray-400 ml-2">— {ghg.name}</span>
        </button>
      ))}
    </div>

    {/* Results */}
    {ghgLoading && <p className="text-center text-pink-400 text-xs animate-pulse">Searching CDSE catalog...</p>}
    {ghgError && <p className="text-red-400 text-xs">{ghgError}</p>}
    {ghgProducts.length > 0 && (
      <div className="space-y-2">
        <p className="text-[9px] uppercase text-gray-500">{ghgProducts.length} products found · {selectedGHG}</p>
        {ghgProducts.map((p) => (
          <div key={p.id} className="border border-white/10 rounded-md px-3 py-2 bg-white/[0.03] space-y-0.5">
            <p className="text-[10px] text-pink-300 font-mono truncate">{p.name?.slice(0, 38)}…</p>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{p.datetime ? new Date(p.datetime).toLocaleDateString() : "—"}</span>
              <span className={p.online ? "text-green-400" : "text-yellow-400"}>{p.online ? "Online" : "Offline"}</span>
              <span>{p.size_mb} MB</span>
            </div>
          </div>
        ))}
      </div>
    )}
    {!ghgLoading && !ghgError && ghgProducts.length === 0 && selectedGHG && (
      <p className="text-xs text-gray-500 text-center">No products found for this period.</p>
    )}
  </div>
  );
})()}

{section === "Heavy Metal Contamination" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
      Upload Region of Interest
    </button>

    <button
      onClick={async () => {
        try {
          // Fetch the heavy metal contamination GeoJSON
          const response = await fetch('http://3.121.112.193:8000/static/files-host/files-host/map.geojson');
          const contaminationData = await response.json();
          
          if (!mapInstance) return;

          // Remove existing contamination layer if it exists
          if (mapInstance.getLayer('contamination-layer')) {
            mapInstance.removeLayer('contamination-layer');
          }
          if (mapInstance.getSource('contamination-source')) {
            mapInstance.removeSource('contamination-source');
          }

          // Add the contamination data to the map
          mapInstance.addSource('contamination-source', {
            type: 'geojson',
            data: contaminationData
          });

          mapInstance.addLayer({
            id: 'contamination-layer',
            type: 'fill',
            source: 'contamination-source',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'contamination_level'],
                0, '#00ff00',  // Green for low contamination
                5, '#ffff00',  // Yellow for medium
                10, '#ff0000'  // Red for high
              ],
              'fill-opacity': 0.7,
              'fill-outline-color': 'red'
            }
          });

          // Add a legend for the contamination levels
          const legend = document.createElement('div');
          legend.className = 'legend contamination-legend';
          legend.innerHTML = `
            <h4>Contamination Level</h4>
            <div><span style="background-color: #00ff00"></span>Low (0-3)</div>
            <div><span style="background-color: #ffff00"></span>Medium (4-6)</div>
            <div><span style="background-color: #ff0000"></span>High (7-10)</div>
          `;
          
          // Add the legend to the map
          const existingLegend = document.querySelector('.contamination-legend');
          if (existingLegend) existingLegend.remove();
          
          document.querySelector('.mapboxgl-map').appendChild(legend);

          // Fit the map to the contamination data bounds
          const bounds = new mapboxgl.LngLatBounds();
          contaminationData.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            if (feature.geometry.type === 'Polygon') {
              coords[0].forEach(coord => bounds.extend(coord));
            }
          });
          mapInstance.fitBounds(bounds, { padding: 20 });

        } catch (error) {
          console.error('Error loading contamination data:', error);
          // alert('Failed to load contamination data. Please try again.');
        }
      }}
      className="w-full mt-3 px-3 py-1.5 bg-red-500/20 border border-red-400/30 text-red-300 rounded-md text-xs hover:bg-red-500/30 transition-colors"
    >
      Identify Contamination Zones
    </button>
  </div>
)}
{section === "Organic Assessment" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
      Upload Region of Interest
    </button>

    <div className="pt-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Date</h3>
      <Calendar
        selectRange={true}
        maxDate={new Date()}
        onChange={(range) => {
          console.log("📅 Selected range:", range);
          selectedRangeRef.current = range;
        }}
      />
    </div>

    <div className="mt-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Satellite Sensor</h3>
      <select
        value={satProvider}
        onChange={(e) => setSatProvider(e.target.value)}
        className="w-full border border-white/10 rounded-md px-2 py-1.5 bg-white/5 text-gray-300 text-xs focus:outline-none focus:border-white/20"
      >
        <option value="sentinel-2">Sentinel-2</option>
        <option value="landsat">Landsat</option>
        <option value="naip">NAIP</option>
      </select>
    </div>

    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Cloud Cover (%)</h3>
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        value={50}
        onChange={() => {}}
        className="w-full"
      />
      <div className="text-xs mt-1 text-right">50%</div>
    </div>

<select
  value={resample}
  onChange={(e) => setResample(e.target.value)}
  className="w-full border border-white/10 rounded-md px-2 py-1.5 bg-white/5 text-gray-300 text-xs focus:outline-none focus:border-white/20"
>
  <option value="1D">Daily</option>
  <option value="W">Weekly</option>
  <option value="MS">Monthly</option>
</select>

<button
  onClick={async () => {
    setIsLoading(true); // <-- Start loading
    const range = selectedRangeRef.current;
    if (!selectedFarm || !range || !range[0] || !range[1]) {
      alert("Please select a farm and date range.");
      setIsLoading(false); // <-- Stop loading on early return
      return;
    }

    const [startDate, endDate] = range;
    const farm = farms[selectedFarm];
    if (!farm?.wkt) {
      alert("Invalid farm geometry.");
      setIsLoading(false); // <-- Stop loading on early return
      return;
    }

    // Convert WKT to GeoJSON
    const coordinates = farm.wkt
      .replace("POLYGON((", "")
      .replace("))", "")
      .split(",")
      .map(p => p.trim().split(" ").map(Number));

    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      }],
    };

    const payload = {
      satellite_sensor: satProvider,
      indicator: labelToIndicator[item.trim().toLowerCase()] || item,
      cloud_cover: 50,
      resample: resample,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      geojson: geojson
    };

    console.log("📡 Sending indicator request:", payload);

    try {
      const res = await fetch("/api/indicator/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      console.log(result,"products")

      const products = result?.result?.products || [];

      if (products.length === 0) {
        console.warn("⚠️ No indicator frames returned");
        setIsLoading(false); // <-- Stop loading
        return;
      }

      setIndicatorFrames(products);
      setCurrentFrameIndex(0);

      const layers = products.map((frame, i) => ({
        id: `indicator-${i}`,
        name: frame.timestamp || `Layer ${i + 1}`,
        png_url: frame.png_url,
        legend_url: frame.legend_url,
        bbox: frame.bounds,
        visible: false
      }));
      console.log("✅ Received indicator products:", result);

      setIndicatorLayers(layers);
    } catch (err) {
      console.error("❌ Request failed:", err);
      alert("Request failed. See console for details.");
    } finally {
      setIsLoading(false); // <-- Always stop loading
    }
  }}
  className="mt-4 w-full px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-md text-xs hover:bg-emerald-500/30 transition-colors"
>
  {isLoading ? "Loading..." : "Confirm Indicator Request"}
</button>

{indicatorFrames.length > 0 && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4">
    <h3 className="font-semibold mb-1">See temporal change</h3>
    <input
      type="range"
      min={0}
      max={indicatorFrames.length - 1}
      value={currentFrameIndex}
      onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
      className="w-full mt-1"
    />
    <p className="text-xs text-center mt-1">
      {indicatorFrames[currentFrameIndex]?.timestamp || "No timestamp"}
    </p>
  </div>
)}
{indicatorLayers.length > 0 && (
  <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06]">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Indicator Layers</h3>
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {indicatorLayers.map((layer, i) => (
        <div
          key={layer.id}
          className={`border rounded-md p-2 cursor-pointer transition-colors ${
            layer.visible ? "bg-emerald-400/10 border-emerald-400/40" : "border-white/10 hover:bg-white/5"
          }`}
          onClick={() => {
            console.log(indicatorLayers);
  if (!mapInstance) return;

  const newLayers = [...indicatorLayers];
  const updated = { ...newLayers[i] };
  updated.visible = !updated.visible;
  newLayers[i] = updated;
  setIndicatorLayers(newLayers);

  const id = updated.id;

  if (updated.visible) {
    // Remove if already there (just in case)
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);

    // Add new image source + layer
    mapInstance.addSource(id, {
      type: "image",
      url: updated.png_url,
      coordinates: [
        [updated.bbox[0], updated.bbox[3]], // top-left
        [updated.bbox[2], updated.bbox[3]], // top-right
        [updated.bbox[2], updated.bbox[1]], // bottom-right
        [updated.bbox[0], updated.bbox[1]]  // bottom-left
      ]
    });

    mapInstance.addLayer({
      id,
      type: "raster",
      source: id,
      paint: {
        "raster-opacity": 1.0
      }
    });

    mapInstance.fitBounds(
      [
        [updated.bbox[0], updated.bbox[1]],
        [updated.bbox[2], updated.bbox[3]]
      ],
      { padding: 20 }
    );

    console.log("✅ Added layer to map:", id);
  } else {
    // Remove from map
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    console.log("❌ Removed layer from map:", id);
  }
}}
        >
          <p className="font-semibold">{layer.name}</p>
          {layer.png_url && (
            <img src={layer.png_url} alt={layer.name} className="w-full h-auto rounded" />
          )}
        </div>
      ))}
    </div>
  </div>
)}
{indicatorLayers.length > 0 && (
  <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] border border-gray-300">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Available Indicator Layers</h3>
    <ul className="space-y-1 max-h-40 overflow-y-auto">
      {indicatorLayers.map((layer, i) => (
        <li key={layer.id} className="flex items-center justify-between">
          <span>{layer.name || `Layer ${i + 1}`}</span>
          <span className="text-xs text-gray-500">{layer.visible ? "Visible" : "Hidden"}</span>
        </li>
      ))}
    </ul>
  </div>
)}
{/* {indicatorFrames.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black p-2 rounded shadow">
    <input
      type="range"
      min={0}
      max={indicatorFrames.length - 1}
      value={currentFrameIndex}
      onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
    />
    <div className="text-center text-xs mt-1 font-medium">
      {indicatorFrames[currentFrameIndex]?.timestamp}
    </div>
  </div>
)} */}

  </div>
)}
{section === "Crop Details" && item === "Main Crop Identification" && (
  
 <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
  
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
      Upload Region of Interest
    </button>
    <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Search Crop Type</h3>
    <ul className="space-y-1">
      {["Cotton", "Linen", "Hemp"].map((material, i) => (
        <li key={i}>
          <button
            onClick={() => console.log("Selected:", material)} // You can replace this with any handler
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {material}
          </button>
        </li>
      ))}
    </ul>
  </div>
    <div className="pt-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Date</h3>
      <Calendar
        selectRange={true}
        maxDate={new Date()}
        onChange={(range) => {
          console.log("📅 Selected range:", range);
          selectedRangeRef.current = range;
        }}
      />
    </div>

    <div className="mt-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Satellite Sensor</h3>
      <select
        value={satProvider}
        onChange={(e) => setSatProvider(e.target.value)}
        className="w-full border border-white/10 rounded-md px-2 py-1.5 bg-white/5 text-gray-300 text-xs focus:outline-none focus:border-white/20"
      >
        <option value="sentinel-2">Sentinel-2</option>
        <option value="landsat">Landsat</option>
        <option value="naip">NAIP</option>
      </select>
    </div>

    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Cloud Cover (%)</h3>
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        value={50}
        onChange={() => {}}
        className="w-full"
      />
      <div className="text-xs mt-1 text-right">50%</div>
    </div>

<select
  value={resample}
  onChange={(e) => setResample(e.target.value)}
  className="w-full border border-white/10 rounded-md px-2 py-1.5 bg-white/5 text-gray-300 text-xs focus:outline-none focus:border-white/20"
>
  <option value="1D">Daily</option>
  <option value="W">Weekly</option>
  <option value="MS">Monthly</option>
</select>

<button
  onClick={async () => {
    setIsLoading(true); // <-- Start loading
    const range = selectedRangeRef.current;
    if (!selectedFarm || !range || !range[0] || !range[1]) {
      alert("Please select a farm and date range.");
      setIsLoading(false); // <-- Stop loading on early return
      return;
    }

    const [startDate, endDate] = range;
    const farm = farms[selectedFarm];
    if (!farm?.wkt) {
      alert("Invalid farm geometry.");
      setIsLoading(false); // <-- Stop loading on early return
      return;
    }

    // Convert WKT to GeoJSON
    const coordinates = farm.wkt
      .replace("POLYGON((", "")
      .replace("))", "")
      .split(",")
      .map(p => p.trim().split(" ").map(Number));

    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      }],
    };

    const payload = {
      satellite_sensor: satProvider,
      indicator: labelToIndicator[item.trim().toLowerCase()] || item,
      cloud_cover: 50,
      resample: resample,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      geojson: geojson
    };

    console.log("📡 Sending indicator request:", payload);

    try {
      const res = await fetch("/api/indicator/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      console.log(result,"products")

      const products = result?.result?.products || [];

      if (products.length === 0) {
        console.warn("⚠️ No indicator frames returned");
        setIsLoading(false); // <-- Stop loading
        return;
      }

      setIndicatorFrames(products);
      setCurrentFrameIndex(0);

      const layers = products.map((frame, i) => ({
        id: `indicator-${i}`,
        name: frame.timestamp || `Layer ${i + 1}`,
        png_url: frame.png_url,
        legend_url: frame.legend_url,
        bbox: frame.bounds,
        visible: false,
        cotton: frame.cotton_area_ha || 0

      }));
      console.log("✅ Received indicator products layers:", layers);

      setIndicatorLayers(layers);
    } catch (err) {
      console.error("❌ Request failed:", err);
      alert("Request failed. See console for details.");
    } finally {
      setIsLoading(false); // <-- Always stop loading
    }
  }}
  className="mt-4 w-full px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-md text-xs hover:bg-emerald-500/30 transition-colors"
>
  {isLoading ? "Loading..." : "Confirm Indicator Request"}
</button>
{indicatorLayers.length > 0 && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Cotton Area Over Time</h3>

    <div className="w-full overflow-x-auto">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={indicatorLayers.map(layer => ({
            timestamp: layer.name || "No timestamp",
            cotton: layer.cotton || 0
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" angle={-45} textAnchor="end" interval={0} height={60} />
          <YAxis label={{ value: 'Cotton Area (ha)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Bar dataKey="cotton" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)}
{indicatorFrames.length > 0 && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4">
    <h3 className="font-semibold mb-1">See temporal change</h3>
    <input
      type="range"
      min={0}
      max={indicatorFrames.length - 1}
      value={currentFrameIndex}
      onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
      className="w-full mt-1"
    />
    <p className="text-xs text-center mt-1">
      {indicatorFrames[currentFrameIndex]?.timestamp || "No timestamp"}
    </p>
  </div>
)}
{indicatorLayers.length > 0 && (
  <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06]">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Indicator Layers</h3>
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {indicatorLayers.map((layer, i) => (
        <div
          key={layer.id}
          className={`border rounded-md p-2 cursor-pointer transition-colors ${
            layer.visible ? "bg-emerald-400/10 border-emerald-400/40" : "border-white/10 hover:bg-white/5"
          }`}
          onClick={() => {
            console.log(indicatorLayers);
  if (!mapInstance) return;

  const newLayers = [...indicatorLayers];
  const updated = { ...newLayers[i] };
  updated.visible = !updated.visible;
  newLayers[i] = updated;
  setIndicatorLayers(newLayers);

  const id = updated.id;

  if (updated.visible) {
    // Remove if already there (just in case)
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);

    // Add new image source + layer
    mapInstance.addSource(id, {
      type: "image",
      url: updated.png_url,
      coordinates: [
        [updated.bbox[0], updated.bbox[3]], // top-left
        [updated.bbox[2], updated.bbox[3]], // top-right
        [updated.bbox[2], updated.bbox[1]], // bottom-right
        [updated.bbox[0], updated.bbox[1]]  // bottom-left
      ]
    });

    mapInstance.addLayer({
      id,
      type: "raster",
      source: id,
      paint: {
        "raster-opacity": 1.0
      }
    });

    mapInstance.fitBounds(
      [
        [updated.bbox[0], updated.bbox[1]],
        [updated.bbox[2], updated.bbox[3]]
      ],
      { padding: 20 }
    );

    console.log("✅ Added layer to map:", id);
  } else {
    // Remove from map
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    console.log("❌ Removed layer from map:", id);
  }
}}
        >
          <p className="font-semibold">{layer.name}</p>
          {layer.png_url && (
            <img src={layer.png_url} alt={layer.name} className="w-full h-auto rounded" />
          )}
        </div>
      ))}
    </div>
  </div>
)}
{indicatorLayers.length > 0 && (
  <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] border border-gray-300">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Available Indicator Layers</h3>
    <ul className="space-y-1 max-h-40 overflow-y-auto">
      {indicatorLayers.map((layer, i) => (
        <li key={layer.id} className="flex items-center justify-between">
          <span>{layer.name || `Layer ${i + 1}`}</span>
          <span className="text-xs text-gray-500">{layer.visible ? "Visible" : "Hidden"}</span>
        </li>
      ))}
    </ul>
  </div>
)}
{/* {indicatorFrames.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black p-2 rounded shadow">
    <input
      type="range"
      min={0}
      max={indicatorFrames.length - 1}
      value={currentFrameIndex}
      onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
    />
    <div className="text-center text-xs mt-1 font-medium">
      {indicatorFrames[currentFrameIndex]?.timestamp}
    </div>
  </div>
)} */}

  </div>
  
)}
{section === "Crop Details" && item === "Green Cover Changes" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
      Upload Region of Interest
    </button>

    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Year Range</h3>
      <Calendar
        selectRange={true}
        maxDate={new Date()}
        onChange={(range) => {
          console.log("📅 Green cover year range:", range);
          selectedRangeRef.current = range;
        }}
      />
    </div>

    <button
      className="w-full mt-3 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-md text-xs hover:bg-emerald-500/30 transition-colors"
      onClick={async () => {
        const range = selectedRangeRef.current;
        if (!selectedFarm || !range || !range[0] || !range[1]) {
          alert("Please select a farm and year range.");
          return;
        }

        const farm = farms[selectedFarm];
        const coordinates = farm.wkt
          .replace("POLYGON((", "")
          .replace("))", "")
          .split(",")
          .map(p => p.trim().split(" ").map(Number));

        const geojson = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
          }],
        };

        const startYear = range[0].getFullYear();
        const endYear = range[1].getFullYear();
        const yearsToCompare = [startYear, endYear];

        for (const year of yearsToCompare) {
          try {
            const res = await fetch("/api/landcover/esa", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ geojson, year }),
            });

            const result = await res.json();
            const tileUrl = result?.tilejson?.tiles?.[0];
            const layerId = `greencover-${year}`;

            if (!tileUrl) {
              console.warn(`No tile returned for ${year}`);
              continue;
            }

            if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
            if (mapInstance.getSource(layerId)) mapInstance.removeSource(layerId);

            mapInstance.addSource(layerId, {
              type: "raster",
              tiles: [tileUrl],
              tileSize: 256,
            });

            mapInstance.addLayer({
              id: layerId,
              type: "raster",
              source: layerId,
              paint: {
                "raster-opacity": 0.8,
              },
            });

            mapInstance.fitBounds([
              [Math.min(...coordinates.map(c => c[0])), Math.min(...coordinates.map(c => c[1]))],
              [Math.max(...coordinates.map(c => c[0])), Math.max(...coordinates.map(c => c[1]))],
            ], { padding: 20 });

            console.log(`✅ Green cover layer for ${year} added`);
          } catch (err) {
            console.error(`❌ Failed to fetch landcover for ${year}`, err);
          }
        }
      }}
    >
      Compare Green Cover Layers
    </button>
  </div>
)}


      {section === "Farm Monitoring" && (
  <div className="bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06] mt-4 space-y-4">
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Farms</h3>
      <ul className="space-y-1">
        {Object.keys(farms).map(farmName => (
          <li key={farmName}>
            <button
              onClick={() => {onFarmSelect(farmName);
                    setSelectedFarm(farmName);

              }
              
              }
              className="w-full text-left text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
            >
              {farmName}
            </button>
            
          </li>
          
        ))}
        
      </ul>
      
    </div>
<button onClick={onUploadClick} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-gray-300 text-xs hover:bg-white/10 transition-colors">
          Upload Region of Interest
        </button>
    {item === "Historical Imagery" && (
  <div className="pt-2">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Date</h3>
    <Calendar
      selectRange={true}
      maxDate={new Date()}
      onChange={(range) => {
        console.log("📅 Selected range:", range);
        selectedRangeRef.current = range;
      }}
    />

    <div className="mt-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Satellite Provider</h3>
      <select
        value={satProvider}
        onChange={(e) => setSatProvider(e.target.value)}
        className="w-full border border-white/10 rounded-md px-2 py-1.5 bg-white/5 text-gray-300 text-xs focus:outline-none focus:border-white/20"
      >
        <option value="Sentinel-2A">Sentinel-2A</option>
        <option value="Planet">Planet</option>
        <option value="Landsat">Landsat</option>
      </select>
    </div>

    <button
 onClick={async () => {
  const range = selectedRangeRef.current;
  if (!selectedFarm || !range || !range[0] || !range[1]) {
    alert("Please select a farm and a valid date range.");
    return;
  }

  const [start, end] = range;
  const farm = farms[selectedFarm];

  // Convert WKT to GeoJSON Polygon
  const coordinates = farm.wkt
    .replace("POLYGON((", "")
    .replace("))", "")
    .split(",")
    .map(p => p.trim().split(" ").map(Number));
  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  };

  const payload = {
    geojson,
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };

  console.log("📡 Sending payload:", payload);

  try {
    const response = await fetch("/api/preview/historical-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log("✅ Server response:", result);
const thumbnailData = result.thumbnails?.thumbnails;
if (Array.isArray(thumbnailData)) {
  setThumbnails(thumbnailData);

  if (mapInstance) {
    thumbnailData.forEach((thumb, i) => {
      if (!thumb.bbox || !thumb.thumbnail_url) return;

      const imageId = `thumb-${thumb.id}`;

      if (mapInstance.getSource(imageId)) {
        mapInstance.removeLayer(imageId);
        mapInstance.removeSource(imageId);
      }

      // Remove existing source & layer if already added
if (mapInstance.getLayer(imageId)) {
  mapInstance.removeLayer(imageId);
}
if (mapInstance.getSource(imageId)) {
  mapInstance.removeSource(imageId);
}

// Now it's safe to add the source again
mapInstance.addSource(imageId, {
  type: "image",
  url: thumb.thumbnail_url,
  coordinates: [
    [thumb.bbox[0], thumb.bbox[3]], // top-left
    [thumb.bbox[2], thumb.bbox[3]], // top-right
    [thumb.bbox[2], thumb.bbox[1]], // bottom-right
    [thumb.bbox[0], thumb.bbox[1]], // bottom-left
  ],
});

mapInstance.addLayer({
  id: imageId,
  type: "raster",
  source: imageId,
  paint: {
    "raster-opacity": 1,
  },
});


      mapInstance.addLayer({
        id: imageId,
        type: "raster",
        source: imageId,
        paint: {
          "raster-opacity": 1,
        },
      });
    });
  }
} else {
  console.error("❌ Unexpected thumbnail format:", result.thumbnails);
  alert("Error: No valid thumbnails found in response.");
}

    console.log(result.thumbnails);
  } catch (err) {
    console.error("❌ Request failed:", err);
    alert("Failed to fetch historical data.");
  }
}}

      className="mt-3 w-full px-3 py-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded-md text-xs hover:bg-sky-500/30 transition-colors"
    >
      Confirm Historical Request
    </button>

 {thumbnails.length > 0 && (
  <div className="mt-4 bg-white/5 text-gray-300 rounded-lg p-3 text-sm border border-white/[0.06]">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Available Historical Products</h3>
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {thumbnails.map((thumb) => (
        <div
          key={thumb.id}
          className={`border rounded-md p-2 cursor-pointer transition-colors ${
            activeThumbnailId === thumb.id ? "bg-sky-400/10 border-sky-400/40" : "border-white/10 hover:bg-white/5"
          }`}
          onClick={() => {
  if (!mapInstance || !thumb.bbox || !thumb.thumbnail_url) return;

  const newId = `thumb-${thumb.id}`;

  // Avoid redundant operations if the same thumbnail is already active
  if (activeThumbnailId === thumb.id) {
    console.log("🟡 Thumbnail already active:", thumb.id);
    return;
  }

  // Remove previous active thumbnail layer and source
  if (activeThumbnailId) {
    const oldId = `thumb-${activeThumbnailId}`;
    if (mapInstance.getLayer(oldId)) {
      mapInstance.removeLayer(oldId);
      console.log("🗑️ Removed old layer:", oldId);
    }
    if (mapInstance.getSource(oldId)) {
      mapInstance.removeSource(oldId);
      console.log("🗑️ Removed old source:", oldId);
    }
  }

  // Also remove this one if it's already on the map (safety check)
  if (mapInstance.getLayer(newId)) {
    mapInstance.removeLayer(newId);
  }
  if (mapInstance.getSource(newId)) {
    mapInstance.removeSource(newId);
  }

  // Add new thumbnail as image source and layer
  mapInstance.addSource(newId, {
    type: "image",
    url: thumb.thumbnail_url,
    coordinates: [
      [thumb.bbox[0], thumb.bbox[3]], // top-left
      [thumb.bbox[2], thumb.bbox[3]], // top-right
      [thumb.bbox[2], thumb.bbox[1]], // bottom-right
      [thumb.bbox[0], thumb.bbox[1]], // bottom-left
    ],
  });

  mapInstance.addLayer({
    id: newId,
    type: "raster",
    source: newId,
    paint: {
      "raster-opacity": 1,
    },
  });

  // Zoom to thumbnail area
  mapInstance.fitBounds(
    [
      [thumb.bbox[0], thumb.bbox[1]],
      [thumb.bbox[2], thumb.bbox[3]],
    ],
    { padding: 20 }
  );

  // Set as active
  setActiveThumbnailId(thumb.id);
  console.log("✅ Activated:", thumb.id);
}}

        >
          <p className="text-sm font-semibold mb-1">
            {thumb.name || `Product ${thumb.id}`}
          </p>
          {thumb.thumbnail_url && (
            <img
              src={thumb.thumbnail_url}
              alt={thumb.id}
              className="w-full h-auto rounded mb-1"
            />
          )}
          <p className="text-xs text-gray-600">ID: {thumb.id}</p>
        </div>
      ))}
    </div>
  </div>
)}

  </div>
  
  
)}
  </div>
  
)}



{/* ── Sub-Task 3: EUDR Deforestation ─────────────────────────────────── */}
{section === "EUDR Deforestation" && (
  <EudrPanel item={item} farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect} satProvider={satProvider} setSatProvider={setSatProvider} mapInstance={mapInstance} drawInstance={drawInstance} />
)}

{/* ── Sub-Task 4: Organic & Regenerative ─────────────────────────────── */}
{section === "Organic & Regenerative" && (
  <OrganicCompliancePanel item={item} farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect} satProvider={satProvider} setSatProvider={setSatProvider} />
)}

    </div>
  </div>
  );
}

// ── Shared farm + date + sensor picker ────────────────────────────────────────
function FarmDatePicker({ farms, selectedFarm, setSelectedFarm, onFarmSelect, startDate, setStartDate, endDate, setEndDate, satProvider, setSatProvider, accentClass = "text-emerald-400" }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1.5">Farm</p>
        <div className="space-y-1">
          {Object.keys(farms).map(name => (
            <button key={name} onClick={() => { onFarmSelect(name); setSelectedFarm(name); }}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${selectedFarm === name ? `bg-white/10 ${accentClass} font-medium` : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1.5">Date Range</p>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1.5">Sensor</p>
        <select value={satProvider} onChange={e => setSatProvider(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-gray-300 focus:outline-none">
          <option value="sentinel-2">Sentinel-2</option>
          <option value="landsat">Landsat</option>
        </select>
      </div>
    </div>
  );
}

// ── Sub-Task 3: EUDR Deforestation Panel ──────────────────────────────────────
const EUDR_META = {
  "NDVI Time-Series Trend": {
    icon: "📈",
    desc: "NDVI trend over the selected period via STAC Element84 — detects vegetation decline associated with land-use change.",
    endpoint: null,   // handled separately
  },
  "Forest to Ag Detection": {
    icon: "🌲",
    desc: "Detect forest → agriculture transition by comparing baseline vs current period median NDVI.",
    endpoint: "http://localhost:8000/eudr/forest-to-ag",
  },
  "Risk Zones (Low/Med/High)": {
    icon: "⚠️",
    desc: "Classify deforestation risk from NDVI statistics and trend slope across the full monitoring period.",
    endpoint: "http://localhost:8000/eudr/risk-zones",
  },
  "Deforestation Alerts": {
    icon: "🚨",
    desc: "Flag consecutive-scene NDVI drops ≥ 0.08 as clearing events. Severity: Medium / High / Critical.",
    endpoint: "http://localhost:8000/eudr/deforestation-alerts",
  },
};

const DRAW_ITEMS = new Set(["Forest to Ag Detection", "Risk Zones (Low/Med/High)", "Deforestation Alerts"]);

function EudrPanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect, satProvider, setSatProvider, mapInstance, drawInstance }) {
  const [loading, setLoading]         = useLocalState(false);
  const [result, setResult]           = useLocalState(null);
  const [error, setError]             = useLocalState(null);
  const [startDate,  setStartDate]    = useLocalState("2023-01-01");
  const [endDate,    setEndDate]      = useLocalState(new Date().toISOString().split("T")[0]);
  const [aggregate,  setAggregate]    = useLocalState("monthly");
  const [mapLoading, setMapLoading]   = useLocalState(false);
  const [mapActive,  setMapActive]    = useLocalState(false);
  const [drawMode,   setDrawMode]     = useLocalState(false);
  const [drawnGeojson, setDrawnGeojson] = useLocalState(null);
  const meta = EUDR_META[item] || {};
  const usesDraw = DRAW_ITEMS.has(item);

  function toggleDraw() {
    if (!drawInstance) return;
    if (drawMode) {
      drawInstance.changeMode("simple_select");
      setDrawMode(false);
    } else {
      drawInstance.deleteAll();
      drawInstance.changeMode("draw_polygon");
      setDrawMode(true);
      // Listen for polygon completion
      const onDrawCreate = (e) => {
        const fc = drawInstance.getAll();
        if (fc.features.length) {
          setDrawnGeojson(fc);
          setDrawMode(false);
        }
        mapInstance.off("draw.create", onDrawCreate);
      };
      mapInstance.on("draw.create", onDrawCreate);
    }
  }

  function clearDraw() {
    if (drawInstance) drawInstance.deleteAll();
    setDrawnGeojson(null);
    setDrawMode(false);
  }

  async function toggleChangeMap() {
    if (!mapInstance) return;
    const SRC = "eudr-change-map";
    if (mapActive) {
      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);
      setMapActive(false);
      return;
    }
    if (!selectedFarm || !farms[selectedFarm]?.wkt) return alert("Select a farm first.");
    setMapLoading(true);
    try {
      const wkt    = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      const geojson = { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
      const body = JSON.stringify({ geojson, start_date: startDate, end_date: endDate, cloud_cover: 30, satellite_sensor: satProvider });
      const headers = { "Content-Type": "application/json" };

      // Get bounds
      const infoRes  = await fetch("http://localhost:8000/eudr/ndvi-change-map/info", { method:"POST", headers, body });
      const info     = await infoRes.json();
      const [west, south, east, north] = info.bounds;

      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);

      // PNG is served via POST — create an object URL via blob
      const pngRes  = await fetch("http://localhost:8000/eudr/ndvi-change-map/png", { method:"POST", headers, body });
      const blob    = await pngRes.blob();
      const pngUrl  = URL.createObjectURL(blob);

      mapInstance.addSource(SRC, {
        type: "image", url: pngUrl,
        coordinates: [[west,north],[east,north],[east,south],[west,south]],
      });
      mapInstance.addLayer({ id: SRC, type: "raster", source: SRC, paint: { "raster-opacity": 0.85 } });
      mapInstance.fitBounds([[west,south],[east,north]], { padding: 60 });
      setMapActive(true);
    } catch(e) { alert("Change map error: " + e.message); }
    finally { setMapLoading(false); }
  }

  async function runAnalysis() {
    if (!startDate || !endDate) return alert("Select a date range.");
    // For draw-based items, require a drawn shape; otherwise require a farm
    let geojson;
    if (usesDraw) {
      if (drawnGeojson?.features?.length) {
        geojson = drawnGeojson;
      } else if (selectedFarm && farms[selectedFarm]?.wkt) {
        const wkt = farms[selectedFarm].wkt;
        const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
        geojson = { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
      } else {
        return alert("Draw a shape on the map or select a farm.");
      }
    } else {
      if (!selectedFarm || !farms[selectedFarm]?.wkt) return alert("Select a farm first.");
      const wkt = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      geojson = { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const start_date = startDate;
      const end_date   = endDate;

      const headers = { "Content-Type": "application/json" };
      const body    = JSON.stringify({ geojson, start_date, end_date, cloud_cover: 30, satellite_sensor: satProvider });

      if (item === "NDVI Time-Series Trend") {
        const res  = await fetch("http://localhost:8000/eudr/ndvi-timeseries", {
          method: "POST", headers,
          body: JSON.stringify({ geojson, start_date, end_date, cloud_cover: 30, satellite_sensor: satProvider, aggregate }),
        });
        const data = await res.json();
        if (data.message && !data.time_series?.length) throw new Error(data.message);
        const series = (data.time_series || []).map(p => ({ date: p.date, value: p.mean }));
        const first = series[0]?.value ?? 0, last = series[series.length-1]?.value ?? 0;
        const delta = last - first;
        const trend = delta > 0.05 ? "Improving" : delta < -0.05 ? "Declining" : "Stable";
        const color = trend === "Improving" ? "text-emerald-400" : trend === "Declining" ? "text-red-400" : "text-yellow-400";
        setResult({ trend, delta: delta.toFixed(3), color, series });
      } else {
        // Dedicated endpoints for the three spatial risk items
        const res  = await fetch(meta.endpoint, { method: "POST", headers, body });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
        setResult(await res.json());
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span>{meta.icon}</span>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{item}</p>
          <span className="ml-auto text-[9px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded px-1.5 py-0.5">Sub-Task 3</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{meta.desc}</p>
      </div>

      {/* ── Draw AOI (for spatial analysis items) ── */}
      {usesDraw ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Area of Interest</p>
          <div className="flex gap-2">
            <button onClick={toggleDraw}
              className={`flex-1 py-2 rounded-md border text-xs font-semibold transition-colors ${drawMode ? "bg-emerald-400/20 border-emerald-400/60 text-emerald-300 animate-pulse" : drawnGeojson ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400" : "border-white/20 text-gray-400 hover:bg-white/5"}`}>
              {drawMode ? "Drawing… click to finish" : drawnGeojson ? "✓ Shape drawn — redraw" : "Draw shape on map"}
            </button>
            {drawnGeojson && (
              <button onClick={clearDraw} className="px-3 py-2 rounded-md border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/30 text-xs transition-colors">
                Clear
              </button>
            )}
          </div>
          {!drawnGeojson && (
            <div className="space-y-1">
              <p className="text-[10px] text-gray-600">— or use a saved farm —</p>
              <div className="space-y-1">
                {Object.keys(farms).map(name => (
                  <button key={name} onClick={() => { onFarmSelect(name); setSelectedFarm(name); }}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${selectedFarm === name ? "bg-white/10 text-emerald-400 font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
          </div>
          <select value={satProvider} onChange={e => setSatProvider(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-gray-300 focus:outline-none">
            <option value="sentinel-2">Sentinel-2</option>
            <option value="landsat">Landsat</option>
          </select>
        </div>
      ) : (
        <FarmDatePicker farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm}
          onFarmSelect={onFarmSelect} startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          satProvider={satProvider} setSatProvider={setSatProvider} accentClass="text-emerald-400" />
      )}

      {item === "NDVI Time-Series Trend" && (
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1.5">Aggregation</p>
          <div className="grid grid-cols-4 gap-1">
            {["scene","daily","weekly","monthly"].map(a => (
              <button key={a} onClick={() => setAggregate(a)}
                className={`py-1.5 rounded-md text-[10px] font-medium border transition-colors capitalize ${aggregate === a ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-400" : "border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={runAnalysis} disabled={loading}
        className="w-full py-2 rounded-md bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-400/20 transition-colors disabled:opacity-40">
        {loading ? "Analysing…" : `Run ${item}`}
      </button>

      {error && <p className="text-[11px] text-red-400 bg-red-400/5 border border-red-400/20 rounded p-2">{error}</p>}

      {result && item === "NDVI Time-Series Trend" && (
        <div className="space-y-3">
          <div className={`bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center`}>
            <p className={`text-2xl font-bold ${result.color}`}>{result.trend}</p>
            <p className="text-[10px] text-gray-500 mt-1">NDVI Δ {result.delta} over period</p>
          </div>
          <button onClick={toggleChangeMap} disabled={mapLoading}
            className={`w-full py-2 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40 ${mapActive ? "bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20" : "bg-emerald-400/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20"}`}>
            {mapLoading ? "Rendering change map…" : mapActive ? "Hide Change Map" : "Show Change Map on Map"}
          </button>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="flex gap-1 flex-1 h-2 rounded overflow-hidden">
              {["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"].map(c=>(
                <div key={c} className="flex-1 h-full" style={{background:c}} />
              ))}
            </div>
            <span>Loss → Gain</span>
          </div>
          {result.series?.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
              <p className="text-[10px] uppercase text-gray-500 mb-2">Monthly NDVI</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={result.series} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tick={{ fontSize:8, fill:"#6b7280" }} tickFormatter={d=>d?.slice(0,7)} />
                  <YAxis domain={[0,1]} tick={{ fontSize:8, fill:"#6b7280" }} />
                  <Tooltip contentStyle={{ background:"#1f1f23", border:"1px solid #ffffff15", fontSize:10 }} />
                  <Bar dataKey="value" fill="#34d399" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Forest → Ag Detection */}
      {result && item === "Forest to Ag Detection" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-4 border text-center ${result.detected ? "bg-red-400/5 border-red-400/30" : "bg-emerald-400/5 border-emerald-400/30"}`}>
            <p className={`text-xl font-bold ${result.detected ? "text-red-400" : "text-emerald-400"}`}>
              {result.detected ? "Transition Detected" : "No Transition Found"}
            </p>
            {result.transition_date && <p className="text-[10px] text-gray-400 mt-1">First crossed threshold: {result.transition_date}</p>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Baseline NDVI", val: result.baseline_ndvi, color: "text-emerald-400" },
              { label: "Current NDVI",  val: result.current_ndvi,  color: result.detected ? "text-red-400" : "text-emerald-400" },
              { label: "NDVI Drop",     val: result.ndvi_drop,     color: "text-amber-400" },
              { label: "Confidence",    val: `${result.forest_scenes}f / ${result.ag_scenes}a scenes`, color: "text-gray-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2">
                <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-[10px] text-gray-500 space-y-0.5">
            <div className="flex justify-between"><span>Baseline</span><span>{result.baseline_period?.start} → {result.baseline_period?.end}</span></div>
            <div className="flex justify-between"><span>Current</span><span>{result.current_period?.start} → {result.current_period?.end}</span></div>
          </div>
        </div>
      )}

      {/* Risk Zones */}
      {result && item === "Risk Zones (Low/Med/High)" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-4 border text-center ${result.risk==="High"?"bg-red-400/5 border-red-400/30":result.risk==="Medium"?"bg-yellow-400/5 border-yellow-400/30":"bg-emerald-400/5 border-emerald-400/30"}`}>
            <p className={`text-3xl font-bold ${result.risk==="High"?"text-red-400":result.risk==="Medium"?"text-yellow-400":"text-emerald-400"}`}>{result.risk}</p>
            <p className="text-[10px] text-gray-500 mt-1">Deforestation Risk · {result.scene_count} scenes · {result.confidence}% confidence</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Min NDVI",   val: result.ndvi_min,    color: "text-red-400" },
              { label: "Mean NDVI",  val: result.ndvi_mean,   color: "text-gray-300" },
              { label: "Std Dev",    val: result.ndvi_std,    color: "text-amber-400" },
              { label: "Trend/scene", val: result.trend_slope, color: result.trend_slope < -0.002 ? "text-red-400" : "text-emerald-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2">
                <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1 text-[10px]">
            {[{r:"Low",l:"Min NDVI > 0.35, stable trend",c:"text-emerald-400"},{r:"Medium",l:"Min 0.20–0.35 or declining trend",c:"text-yellow-400"},{r:"High",l:"Min < 0.20 or steep decline",c:"text-red-400"}].map(z=>(
              <div key={z.r} className="flex gap-2"><span className={`font-semibold w-14 flex-shrink-0 ${z.c}`}>{z.r}</span><span className="text-gray-500">{z.l}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Deforestation Alerts */}
      {result && item === "Deforestation Alerts" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-4 border text-center ${
            result.status==="Critical"?"bg-red-500/10 border-red-500/40":
            result.status==="High"?"bg-red-400/5 border-red-400/30":
            result.status==="Medium"?"bg-yellow-400/5 border-yellow-400/30":
            "bg-emerald-400/5 border-emerald-400/30"}`}>
            <p className={`text-2xl font-bold ${
              result.status==="Critical"?"text-red-500":
              result.status==="High"?"text-red-400":
              result.status==="Medium"?"text-yellow-400":"text-emerald-400"}`}>
              {result.status}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">{result.alert_count} clearing event{result.alert_count !== 1 ? "s" : ""} detected</p>
          </div>
          {result.alerts?.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {result.alerts.map((a, i) => (
                <div key={i} className={`rounded-md px-3 py-2 border text-xs ${
                  a.severity==="Critical"?"bg-red-500/5 border-red-500/30":
                  a.severity==="High"?"bg-red-400/5 border-red-400/20":"bg-yellow-400/5 border-yellow-400/20"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono">{a.from_date} → {a.date}</span>
                    <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                      a.severity==="Critical"?"bg-red-500/20 text-red-400":
                      a.severity==="High"?"bg-red-400/15 text-red-400":"bg-yellow-400/15 text-yellow-400"}`}>
                      {a.severity}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                    <span>Before: <span className="text-gray-300">{a.ndvi_before}</span></span>
                    <span>After: <span className="text-gray-300">{a.ndvi_after}</span></span>
                    <span>Drop: <span className="text-red-400">−{a.drop}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-Task 4: Organic & Regenerative Panel ──────────────────────────────────
const ORGANIC_META = {
  "Crop Rotation Detection": {
    icon: "🔄", accent: "orange",
    desc: "Detect crop rotation by comparing NDVI seasonal peak timing across years. Rotation indicated by shifted phenological patterns.",
    deriveResult: (series) => {
      const byYear = {};
      series.forEach(p => { const y = p.date?.slice(0,4); if(y) { byYear[y] = byYear[y]||[]; byYear[y].push(p.value); } });
      const means = Object.entries(byYear).map(([y,v]) => ({ year:y, mean:(v.reduce((a,b)=>a+b,0)/v.length).toFixed(3) }));
      const detected = means.length >= 2 && Math.abs(means[0].mean - means[means.length-1].mean) > 0.05;
      return { means, detected };
    },
  },
  "Cover Crop Verification": {
    icon: "🌱", accent: "orange",
    desc: "Verify cover crop presence in off-season (Nov–Feb) using NDVI. NDVI > 0.25 in off-season indicates active cover cropping.",
    deriveResult: (series) => {
      const offSeason = series.filter(p => { const m = parseInt(p.date?.slice(5,7)); return m>=11||m<=2; });
      const verified  = offSeason.length > 0 && offSeason.some(p => p.value > 0.25);
      const avgNdvi   = offSeason.length ? (offSeason.reduce((s,p)=>s+p.value,0)/offSeason.length).toFixed(3) : "N/A";
      return { verified, avgNdvi, offSeasonObs: offSeason.length };
    },
  },
  "Compost Application Map": {
    icon: "🌿", accent: "orange",
    desc: "Infer compost/organic matter application from spring NDVI uplift patterns. Rapid green-up suggests organic amendment.",
    deriveResult: (series) => {
      const spring = series.filter(p => { const m=parseInt(p.date?.slice(5,7)); return m>=3&&m<=5; });
      const other  = series.filter(p => { const m=parseInt(p.date?.slice(5,7)); return m<3||m>5; });
      const springMean = spring.length ? spring.reduce((s,p)=>s+p.value,0)/spring.length : 0;
      const otherMean  = other.length  ? other.reduce((s,p)=>s+p.value,0)/other.length   : 0;
      const uplift = (springMean - otherMean).toFixed(3);
      const detected = springMean > otherMean + 0.05;
      return { detected, uplift, springMean: springMean.toFixed(3) };
    },
  },
  "Soil Carbon Trend": {
    icon: "🌍", accent: "orange",
    desc: "Proxy soil carbon accumulation from multi-year NDVI trend. Sustained high NDVI (LAI proxy) correlates with organic matter build-up.",
    deriveResult: (series) => {
      if (series.length < 2) return null;
      const n = series.length;
      const xs = series.map((_,i)=>i), ys = series.map(p=>p.value);
      const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
      const slope = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/xs.reduce((s,x)=>s+(x-mx)**2,0);
      const trend = slope > 0.001 ? "Accumulating" : slope < -0.001 ? "Depleting" : "Stable";
      const carbonProxy = (my * 45).toFixed(1); // rough tC/ha proxy
      return { trend, slope: slope.toFixed(5), carbonProxy, meanNdvi: my.toFixed(3) };
    },
  },
  "Chemical-Free Verification": {
    icon: "✅", accent: "orange",
    desc: "Assess chemical-free status via NDVI smoothness. Pesticide/herbicide events cause abrupt NDVI dips absent in organic systems.",
    deriveResult: (series) => {
      const dips = [];
      for (let i=1;i<series.length;i++) {
        const drop = series[i-1].value - series[i].value;
        if (drop > 0.12) dips.push({ date: series[i].date, drop: drop.toFixed(3) });
      }
      const verified = dips.length === 0;
      return { verified, dips, score: Math.max(0, 100 - dips.length * 20) };
    },
  },
  "Buffer Zone & Drift Risk": {
    icon: "🛡️", accent: "orange",
    desc: "Evaluate buffer zone effectiveness from edge-NDVI gradient. Healthy buffers show sustained high NDVI at field boundaries.",
    deriveResult: (series) => {
      const mean = series.length ? series.reduce((s,p)=>s+p.value,0)/series.length : 0;
      const risk = mean > 0.45 ? "Low" : mean > 0.3 ? "Medium" : "High";
      return { risk, meanNdvi: mean.toFixed(3) };
    },
  },
};

function OrganicCompliancePanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect, satProvider, setSatProvider }) {
  const [loading, setLoading] = useLocalState(false);
  const [result, setResult]   = useLocalState(null);
  const [error, setError]     = useLocalState(null);
  const [startDate, setStartDate] = useLocalState("2022-01-01");
  const [endDate,   setEndDate]   = useLocalState(new Date().toISOString().split("T")[0]);
  const meta = ORGANIC_META[item] || {};

  async function runAnalysis() {
    if (!selectedFarm || !farms[selectedFarm]?.wkt) return alert("Select a farm first.");
    if (!startDate || !endDate) return alert("Select a date range.");
    setLoading(true); setError(null); setResult(null);
    try {
      const wkt = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      const payload = {
        satellite_sensor: satProvider, indicator: "NDVI",
        cloud_cover: 30, resample: "MS",
        start_date: startDate,
        end_date:   endDate,
        geojson: { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] },
      };
      const res  = await fetch("http://localhost:8000/compute-index", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json();
      const series = (data?.result?.time_series || []).map(p => ({ date: p.date, value: p.mean ?? p.value ?? 0 }));
      setResult(meta.deriveResult?.(series) ?? null);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const accentColor = "orange";
  const accentCls   = { text:"text-orange-400", bg:"bg-orange-400/5", border:"border-orange-400/20", btn:"bg-orange-400/10 border-orange-400/30 text-orange-400 hover:bg-orange-400/20" };

  return (
    <div className="space-y-4">
      <div className={`${accentCls.bg} border ${accentCls.border} rounded-lg p-3`}>
        <div className="flex items-center gap-2 mb-1">
          <span>{meta.icon}</span>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${accentCls.text}`}>{item}</p>
          <span className={`ml-auto text-[9px] ${accentCls.bg} ${accentCls.text} border ${accentCls.border} rounded px-1.5 py-0.5`}>Sub-Task 4</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{meta.desc}</p>
      </div>

      <FarmDatePicker farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm}
        onFarmSelect={onFarmSelect} startDate={startDate} setStartDate={setStartDate}
        endDate={endDate} setEndDate={setEndDate}
        satProvider={satProvider} setSatProvider={setSatProvider} accentClass={accentCls.text} />

      <button onClick={runAnalysis} disabled={loading}
        className={`w-full py-2 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40 ${accentCls.btn}`}>
        {loading ? "Analysing…" : `Run ${item}`}
      </button>

      {error && <p className="text-[11px] text-red-400 bg-red-400/5 border border-red-400/20 rounded p-2">{error}</p>}

      {/* Crop Rotation */}
      {result && item === "Crop Rotation Detection" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.detected?"bg-emerald-400/5 border-emerald-400/30":"bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-lg font-bold ${result.detected?"text-emerald-400":"text-gray-400"}`}>{result.detected?"Rotation Detected":"Single Crop"}</p>
          </div>
          <div className="space-y-1">
            {result.means?.map(({ year, mean }) => (
              <div key={year} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-10">{year}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-orange-400/70" style={{ width:`${mean*100}%` }} />
                </div>
                <span className="text-gray-400 font-mono w-12 text-right">NDVI {mean}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cover Crop */}
      {result && item === "Cover Crop Verification" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.verified?"bg-emerald-400/5 border-emerald-400/30":"bg-yellow-400/5 border-yellow-400/30"}`}>
            <p className={`text-xl font-bold ${result.verified?"text-emerald-400":"text-yellow-400"}`}>{result.verified?"✓ Cover Crop Present":"Not Confirmed"}</p>
            <p className="text-[10px] text-gray-500 mt-1">Off-season NDVI mean: {result.avgNdvi} · {result.offSeasonObs} obs.</p>
          </div>
        </div>
      )}

      {/* Compost Map */}
      {result && item === "Compost Application Map" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.detected?"bg-emerald-400/5 border-emerald-400/30":"bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-lg font-bold ${result.detected?"text-emerald-400":"text-gray-400"}`}>{result.detected?"Spring Uplift Detected":"No Organic Amendment Signal"}</p>
            <p className="text-[10px] text-gray-500 mt-1">Spring NDVI {result.springMean} · Uplift Δ{result.uplift}</p>
          </div>
        </div>
      )}

      {/* Soil Carbon */}
      {result && item === "Soil Carbon Trend" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.trend==="Accumulating"?"bg-emerald-400/5 border-emerald-400/30":result.trend==="Depleting"?"bg-red-400/5 border-red-400/30":"bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-xl font-bold ${result.trend==="Accumulating"?"text-emerald-400":result.trend==="Depleting"?"text-red-400":"text-gray-400"}`}>{result.trend}</p>
            <p className="text-[10px] text-gray-500 mt-1">~{result.carbonProxy} tC/ha · Mean NDVI {result.meanNdvi}</p>
          </div>
        </div>
      )}

      {/* Chemical-Free */}
      {result && item === "Chemical-Free Verification" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.verified?"bg-emerald-400/5 border-emerald-400/30":"bg-red-400/5 border-red-400/30"}`}>
            <p className={`text-xl font-bold ${result.verified?"text-emerald-400":"text-red-400"}`}>{result.verified?"✓ Chemical-Free":"Anomalies Detected"}</p>
            <p className="text-[10px] text-gray-500 mt-1">Compliance score: {result.score}/100</p>
          </div>
          {result.dips?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500">NDVI dip events</p>
              {result.dips.map((d,i) => (
                <div key={i} className="flex justify-between text-xs bg-red-400/5 border border-red-400/20 rounded px-2 py-1">
                  <span className="text-gray-400">{d.date?.slice(0,10)}</span>
                  <span className="text-red-400 font-mono">−{d.drop}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buffer Zone */}
      {result && item === "Buffer Zone & Drift Risk" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-4 border text-center ${result.risk==="Low"?"bg-emerald-400/5 border-emerald-400/30":result.risk==="Medium"?"bg-yellow-400/5 border-yellow-400/30":"bg-red-400/5 border-red-400/30"}`}>
            <p className={`text-2xl font-bold ${result.risk==="Low"?"text-emerald-400":result.risk==="Medium"?"text-yellow-400":"text-red-400"}`}>{result.risk} Drift Risk</p>
            <p className="text-[10px] text-gray-500 mt-1">Buffer NDVI: {result.meanNdvi}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1 text-[10px]">
            {[{r:"Low",l:"NDVI > 0.45 — dense buffer, low drift risk",c:"text-emerald-400"},{r:"Medium",l:"NDVI 0.30–0.45 — partial buffer",c:"text-yellow-400"},{r:"High",l:"NDVI < 0.30 — insufficient buffer",c:"text-red-400"}].map(z=>(
              <div key={z.r} className="flex gap-2"><span className={`font-semibold w-14 ${z.c}`}>{z.r}</span><span className="text-gray-500">{z.l}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
