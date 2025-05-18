// src/App.jsx
import { useState, useRef } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import MapboxMap from "./components/MapboxMap";
import { useEffect } from "react";
import mapboxgl from 'mapbox-gl';

// Define 3 farm WKT geometries




function Sidebar({ onSelect }) {
  const sections = [
    {
      id: 1,
      title: "Farm Monitoring",
      accent: "accent1",
      items: [
        "View Farm Overview",
        {
          title: "Crop Details",
          children: ["Live Satellite View", "Historical Data"]
        }
      ]
    },
    {
      id: 2, 
      title: "Organic Assessment", 
      accent: "accent2",
      items: [{title: "Soil Health Map", children:['Soil Nutrients and Chemicals']}, 
      {title:"Crop Health Analysis", children: ['Water stress levels',"NDVI","SAVI","PVI"]},
      {title:"Forest cover change",children:["SCL"]},
       {title:"Water Resource Mapping",children:["NDWI","NDMI","MSI","Evapotranspiration"]},
        {title:"Chemical compositions",children:["Fertilizer Application Map","Compost Heatmap","Pesticide Drift Risk Map","Organic Zone Boundaries"]},
        "Pollinator Activity Zones",
         "Buffer Zone Assessment", 
          "Carbon Sequestration",
              ]
    },
    {
  id: 3,
  title: "Crop Details",
  accent: "accent7",
  items: [
    "Land Use & Landscape ID",
    "Main Crop Identification",
    "Adjacent Land Use",
    "Mixed Crop & Crop Cycle",
    "Rotation Crop Identification",
    "Crop Yield Estimation",
    "Cover Cropping Implementation",
     "Crop Rotation Planner",
    {
      title: "Agroforestry Integration",
      children: ["Tracks Tree Planting & Maintenance", "Green Cover Changes",
            "Deforestation Monitoring",]
    },
    "No-Till Farming Zones",
    {
      title: "Soil Info",
      children: ["Soil Erosion Risk Zones", "Soil Carbon Content Tracking", "Nutrient Balance Maps"]
    }
  ]
},
    {
      id: 4, title: "Carbon & GHG Metrics", accent: "accent3",
      items: ["CO₂ Capture Data", "GHG Emission Tracker", "Carbon Credit Mgmt.", "Emission Comparison"],
    },
    {
      id: 5, title: "Biodiversity Assessment", accent: "accent4",
         
      items: [
        { 
          title: "Terrestrial Biodiversity", 
          children: [
            "Bird Species Data", 
            "Species Observation Log", 
            "Wildlife Corridor Mapping", 
            "Invasive Species Data", 
            "Endangered Species Data", 
            "Tree Species Data", 
            "Pollinator Data"
          ] 
        },
        { 
          title: "Aquatic Biodiversity", 
          children: [
            "Aquatic Biodiversity Data"
          ] 
        },
        { 
          title: "Biodiversity Health & Indices", 
          children: [
            "Biodiversity Index Score", 
            "Soil Microbes & Biodiv."
          ] 
        },
        { 
          title: "Biodiversity Visualization Tools", 
          children: [
            "Biodiv. Hotspot Viewer", 
            "Impact Heatmap"
          ] 
        },
        "Wildlife Data"
      ]
      },
    {
      id: 6, title: "Compliance & Regulatory", accent: "accent5",
      items: ["Compliance Dashboard", "Generate Compl. Reports", "Submit Data to Regulators"]
    },
    { id: 7, title: "SDGs", accent: "accent6", items: [] },
  ];

  const accentColors = {
    accent1: "bg-lime-300 text-black",
    accent2: "bg-cyan-300 text-black",
    accent3: "bg-pink-300 text-black",
    accent4: "bg-yellow-300 text-black",
    accent5: "bg-purple-300 text-black",
    accent6: "bg-blue-300 text-black",
    accent7: "bg-orange-300 text-black",
  };

  const [openId, setOpenId] = useState(null);

  return (
    <nav className="w-64 bg-sidebar text-white p-4 font-body flex flex-col h-full">
      <div className="flex-grow">
        <h1 className="text-lg mb-4 font-semibold">Organic Agriculture Assessments</h1>
        {sections.map((sec) => (
          <div key={sec.id} className="mb-3">
            <button
              className={`w-full text-left px-3 py-2 border rounded-lg flex justify-between items-center font-semibold transition ${openId === sec.id ? "border-white bg-white bg-opacity-10" : "border-gray-600"}`}
              onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            >
              <span>{sec.title}</span>
              <span className="transform transition">{openId === sec.id ? "˅" : "›"}</span>
            </button>
            {openId === sec.id && sec.items.length > 0 && (
              <ul className={`mt-1 ml-2 rounded px-2 py-2 text-sm ${accentColors[sec.accent]}`}>
                {sec.items.map((item, i) =>
                  typeof item === "string" ? (
                    <li key={i} className="cursor-pointer hover:underline" onClick={() => onSelect(sec.title, item)}>
                      » {item}
                    </li>
                  ) : (
                    <li key={i}>
                      <div className="font-semibold mt-2">{item.title}</div>
                      <ul className="ml-4 list-disc">
                        {item.children.map((subItem, j) => (
                          <li key={j} className="cursor-pointer hover:underline" onClick={() => onSelect(sec.title, subItem)}>
                            {subItem}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4 flex justify-end">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
          <img src="/ffbs-logo.png" alt="Logo" className="w-12 h-12 object-contain" />
        </div>
      </div>
    </nav>
  );
}

function Topbar({ zoom, onZoom, onUploadClick }) {
  return (
    <header className="absolute top-0 left-0 right-0 flex justify-between items-center bg-black bg-opacity-60 text-white p-2 text-sm z-10">
      <div className="flex items-center gap-2">
        {/* <button onClick={() => onZoom(z => z - 0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">–</button> */}
        {/* <span>{Math.round(zoom * 100)}%</span> */}
        {/* <button onClick={() => onZoom(z => z + 0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">+</button> */}
      </div>
      <div className="flex items-center gap-2">
        
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">My Profile</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">Login ››</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">☰</button>
      </div>
    </header>
  );
}

function Panel({ title, options, style, onClick }) {
  return (
    <div className="absolute top-16 bg-panelBg rounded-lg p-4 shadow-lg z-10" style={style}>
      <h2 className="text-lg mb-2">{title}</h2>
      <ul className="space-y-1">
        {options.map((opt, i) => (
          <li key={i} className="text-sm">
            <button onClick={() => onClick(opt)} className="w-full text-left hover:underline">
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      


}) {
  const sectionBgMap = {
    "Farm Monitoring": "bg-lime-300",
    "Organic Assessment": "bg-cyan-300",
    "Carbon & GHG Metrics": "bg-pink-300",
    "Biodiversity Assessment": "bg-yellow-300",
    "Compliance & Regulatory": "bg-purple-300",
    "SDGs": "bg-blue-300",
    "Crop Details": "bg-orange-300",
  };
  const panelClass = section ? sectionBgMap[section] : "bg-gray-300";

  return (
    <div className={`fixed top-0 right-0 h-full w-80 ${panelClass} p-4 transform transition-transform ${open ? "translate-x-0" : "translate-x-full"} z-20`}>
      <button onClick={onClose} className="absolute left-0 top-1/2 -translate-x-full bg-panelBg p-2 rounded-l">‹‹</button>
      <h2 className="text-xl mb-2 font-bold">{section}</h2>
      <p className="text-sm mb-4">You selected: <strong>{item}</strong></p>

      {section === "Biodiversity Assessment" && item === "Species Observation Log" && (
  <>
    {/* Farm Selector */}
    <div className="mb-2 bg-white text-black rounded p-2 text-sm">
      <h3 className="font-semibold mb-2">My Farms</h3>
      <ul className="space-y-1">
        {Object.keys(farms).map(farmName => (
          <li key={farmName}>
            <button
              onClick={() => {
                onFarmSelect(farmName);
                setSelectedFarm(farmName);
              }}
              className="w-full text-left hover:underline"
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
        className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
      >
        Toggle GBIF Layer
      </button>
      <button
        onClick={() => {
          if (!mapInstance) return;
          const vis = mapInstance.getLayoutProperty("inat-species-layer", "visibility");
          mapInstance.setLayoutProperty("inat-species-layer", "visibility", vis === "visible" ? "none" : "visible");
        }}
        className="px-2 py-1 bg-green-500 text-white text-xs rounded"
      >
        Toggle iNat Layer
      </button>
    </div>

    {/* Species Lists */}
    <div className="bg-white text-black rounded p-2 text-sm max-h-[400px] overflow-y-auto space-y-4">
      <div>
        <h3 className="font-semibold mb-2">GBIF Species ({gbifSpecies.length})</h3>
        {gbifSpecies.length === 0 ? (
          <p>No species found.</p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {gbifSpecies.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-2">iNaturalist Species ({inatSpecies.length})</h3>
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
  <div className="bg-white text-black rounded p-2 text-sm max-h-[400px] overflow-y-auto space-y-4">

    <h3 className="font-semibold mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left hover:underline"
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
        className="px-2 py-1 bg-pink-600 text-white text-xs rounded"
      >
        Toggle eBird Layer
      </button>
    </div>

    <h3 className="font-semibold mb-2">eBird Species ({ebirdSpecies.length})</h3>
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
  <div className="bg-white text-black rounded p-2 text-sm mt-4 space-y-4">
    <h3 className="font-semibold mb-2">Actions</h3>
<a
  href="/reports/sample_report.pdf"
  target="_blank"
  rel="noopener noreferrer"
  className="block w-full text-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
>
  📄 View Compliance Report
</a>
  </div>
)}

{section === "Biodiversity Assessment" && item === "Biodiv. Hotspot Viewer" && (
  
  <div className="bg-white text-black rounded p-2 text-sm max-h-[400px] overflow-y-auto space-y-4">
  <h3 className="font-semibold mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left hover:underline"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
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
    className={`px-2 py-1 rounded ${hotspotVisible ? "bg-green-500" : "bg-gray-400"} text-white text-sm`}
  >
    {hotspotVisible ? "Hide" : "Show"}
  </button>
</div>
    <h3 className="font-semibold mb-2">Nearby eBird Hotspots ({ebirdHotspots.length})</h3>
    
    {!Array.isArray(ebirdHotspots) || ebirdHotspots.length === 0 ? (
  <p>No hotspots found.</p>
) : (
  <table className="w-full text-xs border border-gray-300 bg-white text-black">
  <thead className="bg-gray-100 text-left">
    <tr>
      <th className="px-2 py-1 border-b">Location</th>
      <th className="px-2 py-1 border-b">Latitude</th>
      <th className="px-2 py-1 border-b">Longitude</th>
    </tr>
  </thead>
  <tbody>
    {ebirdHotspots.map((spot, i) => (
      <tr key={i} className="hover:bg-gray-50">
        <td className="px-2 py-1 border-b">{spot.locName}</td>
        <td className="px-2 py-1 border-b">{spot.lat.toFixed(4)}</td>
        <td className="px-2 py-1 border-b">{spot.lng.toFixed(4)}</td>
      </tr>
    ))}
  </tbody>
</table>
)}


  </div>
  
)}

{section === "Crop Details" && item === "Land Use & Landscape ID" && (
  <div className="bg-white text-black rounded p-2 text-sm mt-4 space-y-4">
    <h3 className="font-semibold mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left hover:underline"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button
      onClick={onUploadClick}
      className="px-3 py-1 bg-white bg-opacity-20 rounded"
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
        className="w-full mb-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {esaVisible ? "Hide ESA Landcover Layer" : "Show ESA Landcover Layer"}
      </button>
    ) : (
      <p className="text-xs text-red-600">Please select a farm first.</p>
    )}
  </div>
)}


      {section === "Carbon & GHG Metrics" && item === "GHG Emission Tracker" && (
  <div className="bg-white text-black rounded p-2 text-sm mt-4">
    <h3 className="font-semibold mb-2">GHG Indicators</h3>
    <ul className="list-disc list-inside space-y-1">
      {[
        { code: "CO", name: "Carbon monoxide" },
        { code: "CH₄", name: "Methane" },
        { code: "HCHO", name: "Formaldehyde" },
        { code: "NO₂", name: "Nitrogen dioxide" },
        { code: "O₃", name: "Ozone" },
        { code: "SO₂", name: "Sulfur dioxide" }
      ].map((ghg, i) => (
        <li key={i}>
          <button
            onClick={() => setSelectedGHG(ghg.code)}
            className={`w-full text-left rounded px-2 py-1 ${
              selectedGHG === ghg.code ? "bg-blue-200 font-semibold" : "hover:bg-gray-100"
            }`}
          >
            {ghg.code} — {ghg.name}
          </button>
        </li>
      ))}
    </ul>

    {selectedGHG && (
      <div className="mt-3 text-sm font-medium text-blue-700">
        Selected: <span className="font-bold">{selectedGHG}</span>
      </div>
    )}
  </div>
)}
{section === "Organic Assessment" && (
  <div className="bg-white text-black rounded p-2 text-sm mt-4 space-y-4">
    <h3 className="font-semibold mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left hover:underline"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
      Upload Region of Interest
    </button>

    <div className="pt-2">
      <h3 className="font-semibold mb-2">Select Date</h3>
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
      <h3 className="font-semibold mb-2">Satellite Sensor</h3>
      <select
        value={satProvider}
        onChange={(e) => setSatProvider(e.target.value)}
        className="w-full border rounded px-2 py-1 bg-white text-black"
      >
        <option value="sentinel-2">Sentinel-2</option>
        <option value="landsat">Landsat</option>
        <option value="naip">NAIP</option>
      </select>
    </div>

    <div>
      <h3 className="font-semibold mb-2">Cloud Cover (%)</h3>
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
  className="w-full border px-2 py-1 rounded"
>
  <option value="1D">Daily</option>
  <option value="W">Weekly</option>
  <option value="MS">Monthly</option>
</select>

   <button
  onClick={async () => {
    const range = selectedRangeRef.current;
    if (!selectedFarm || !range || !range[0] || !range[1]) {
      alert("Please select a farm and date range.");
      return;
    }

    const [startDate, endDate] = range;
    const farm = farms[selectedFarm];
    if (!farm?.wkt) {
      alert("Invalid farm geometry.");
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
      indicator: item,
      cloud_cover: 8, // use static value for now, or hook up to your slider
      resample: resample,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      geojson: geojson
    };

    console.log("📡 Sending indicator request:", payload);

    try {
      const res = await fetch("http://localhost:3001/api/indicator/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      console.log(result,"products")
      const layers = (result.result.products || []).map((frame, i) => ({
  id: `indicator-${i}`,
  name: frame.timestamp || `Layer ${i + 1}`,
  png_url: frame.png_url,
  bbox: frame.bounds,
  visible: false
}
));

setIndicatorLayers(layers);
      setIndicatorFrames(result.products || []);
      setCurrentFrameIndex(0); // Reset to first frame
      console.log("✅ Server response:", result);
      alert(result.message || result.error || "Request completed.");
    } catch (err) {
      console.error("❌ Request failed:", err);
      alert("Request failed. See console for details.");
    }
  }}
  className="mt-4 px-3 py-1 bg-green-600 text-white rounded"
>
  Confirm Indicator Request
</button>
{indicatorLayers.length > 0 && (
  <div className="mt-4 bg-white text-black rounded p-2 text-sm">
    <h3 className="font-semibold mb-2">Indicator Layers</h3>
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {indicatorLayers.map((layer, i) => (
        <div
          key={layer.id}
          className={`border p-2 rounded shadow-sm cursor-pointer ${
            layer.visible ? "bg-green-100 border-green-400" : "hover:bg-gray-100"
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
  <div className="mt-4 bg-white text-black rounded p-2 text-sm border border-gray-300">
    <h3 className="font-semibold mb-2">Available Indicator Layers</h3>
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
{indicatorFrames.length > 0 && (
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
)}

  </div>
)}
{section === "Crop Details" && item === "Main Crop Identification" && (
  <div className="bg-white text-black rounded p-2 text-sm mt-4">
    <h3 className="font-semibold mb-2">Search Crop Type</h3>
    <ul className="space-y-1">
      {["Cotton", "Linen", "Hemp"].map((material, i) => (
        <li key={i}>
          <button
            onClick={() => console.log("Selected:", material)} // You can replace this with any handler
            className="w-full text-left hover:underline"
          >
            {material}
          </button>
        </li>
      ))}
    </ul>
  </div>
)}
{section === "Crop Details" && item === "Green Cover Changes" && (
  <div className="bg-white text-black rounded p-2 text-sm mt-4 space-y-4">
    <h3 className="font-semibold mb-2">My Farms</h3>
    <ul className="space-y-1">
      {Object.keys(farms).map(farmName => (
        <li key={farmName}>
          <button
            onClick={() => {
              onFarmSelect(farmName);
              setSelectedFarm(farmName);
            }}
            className="w-full text-left hover:underline"
          >
            {farmName}
          </button>
        </li>
      ))}
    </ul>

    <button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
      Upload Region of Interest
    </button>

    <div>
      <h3 className="font-semibold mb-2">Select Year Range</h3>
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
      className="w-full mt-3 px-3 py-1 bg-green-600 text-white rounded"
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
            const res = await fetch("http://localhost:3001/api/landcover/esa", {
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
  <div className="bg-white text-black rounded p-2 text-sm mt-4 space-y-4">
    <div>
      <h3 className="font-semibold mb-2">My Farms</h3>
      <ul className="space-y-1">
        {Object.keys(farms).map(farmName => (
          <li key={farmName}>
            <button
              onClick={() => {onFarmSelect(farmName);
                    setSelectedFarm(farmName);

              }
              
              }
              className="w-full text-left hover:underline"
            >
              {farmName}
            </button>
            
          </li>
          
        ))}
        
      </ul>
      
    </div>
<button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
          Upload Region of Interest
        </button>
    {item === "Historical Data" && (
  <div className="pt-2">
    <h3 className="font-semibold mb-2">Select Date</h3>
    <Calendar
      selectRange={true}
      maxDate={new Date()}
      onChange={(range) => {
        console.log("📅 Selected range:", range);
        selectedRangeRef.current = range;
      }}
    />

    <div className="mt-3">
      <h3 className="font-semibold mb-2">Select Satellite Provider</h3>
      <select
        value={satProvider}
        onChange={(e) => setSatProvider(e.target.value)}
        className="w-full border rounded px-2 py-1 bg-white text-black"
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
    const response = await fetch("http://localhost:3001/api/preview/historical-preview", {
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

      className="mt-3 px-3 py-1 bg-blue-500 text-white rounded"
    >
      Confirm Historical Request
    </button>

 {thumbnails.length > 0 && (
  <div className="mt-4 bg-white text-black rounded p-2 text-sm">
    <h3 className="font-semibold mb-2">Available Historical Products</h3>
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {thumbnails.map((thumb) => (
        <div
          key={thumb.id}
          className={`border p-2 rounded shadow-sm cursor-pointer ${
            activeThumbnailId === thumb.id ? "bg-blue-100 border-blue-400" : "hover:bg-gray-100"
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


    </div>
  );
}

export default function App() {

  const [ebirdSpecies, setEbirdSpeciesList] = useState([]);
  const [hotspotVisible, setHotspotVisible] = useState(true);
const [ebirdHotspots, setEbirdHotspots] = useState([]);
  const selectedRangeRef = useRef(null);

  const [mapInstance, setMapInstance] = useState(null);
  const [drawInstance, setDrawInstance] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [activeSection, setActiveSection] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [gbifSpeciesList, setGbifSpeciesList] = useState([]);
  const [inatSpeciesList, setInatSpeciesList] = useState([]);
  const [satProvider, setSatProvider] = useState("sentinel-2");
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [selectedGHG, setSelectedGHG] = useState(null);
const [thumbnails, setThumbnails] = useState([]);
const [activeThumbnailId, setActiveThumbnailId] = useState(null);
const [selectedIndicator, setSelectedIndicator] = useState("NDVI");
const [resample, setResample] = useState("W"); // default weekly
const [indicatorFrames, setIndicatorFrames] = useState([]);
const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
const [indicatorLayers, setIndicatorLayers] = useState([]);
const [gbifVisible, setGbifVisible] = useState(true);
const [inatVisible, setInatVisible] = useState(true);
  const [esaVisible, setEsaVisible] = useState(false);




useEffect(() => {
  if (!mapInstance || indicatorFrames.length === 0) return;

  const frame = indicatorFrames[currentFrameIndex];
  if (!frame) return;

  const layerId = `indicator-${frame.timestamp}`;

  // Remove previous indicator layers
  indicatorFrames.forEach(f => {
    const id = `indicator-${f.timestamp}`;
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);
  });

  const [minX, minY, maxX, maxY] = frame.bbox;

  // Add PNG as image source
  mapInstance.addSource(layerId, {
    type: "image",
    url: frame.png_url,
    coordinates: [
      [minX, maxY],
      [maxX, maxY],
      [maxX, minY],
      [minX, minY]
    ]
  });

  // Add layer
  mapInstance.addLayer({
    id: layerId,
    type: "raster",
    source: layerId,
    paint: {
      "raster-opacity": 0.7
    }
  });

  // Fit view
  mapInstance.fitBounds([[minX, minY], [maxX, maxY]], { padding: 20 });
}, [mapInstance, indicatorFrames, currentFrameIndex]);


const [farmGeometries, setFarmGeometries] = useState({
  "Farm A": {
    wkt: `POLYGON((
      -93.6500 42.0000,
      -93.6000 42.0000,
      -93.6000 42.0500,
      -93.6500 42.0500,
      -93.6500 42.0000
    ))`,
    center: [-93.625, 42.025]
  },
  "Farm B": {
    wkt: `POLYGON((
      -97.7500 30.2500,
      -97.7000 30.2500,
      -97.7000 30.3000,
      -97.7500 30.3000,
      -97.7500 30.2500
    ))`,
    center: [-97.725, 30.275]
  },
  "Farm C": {
    wkt: `POLYGON((
      -121.8500 37.2500,
      -121.8000 37.2500,
      -121.8000 37.3000,
      -121.8500 37.3000,
      -121.8500 37.2500
    ))`,
    center: [-121.825, 37.275]
  },
});
  // Ref to hidden file input
  const fileInputRef = useRef(null);

  const handleMapReady = (map, draw) => {
    setMapInstance(map);
    setDrawInstance(draw);

    // initialize empty source for uploaded geojson
    if (!map.getSource("uploaded-geojson")) {
      map.addSource("uploaded-geojson", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: "uploaded-geojson-layer",
        type: "fill",
        source: "uploaded-geojson",
        paint: { "fill-color": "#888", "fill-opacity": 0.4 }
      });
    }
     if (!map.getSource("farm-polygons")) {
    map.addSource("farm-polygons", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
    map.addLayer({
      id: "farm-polygons-layer",
      type: "fill",
      source: "farm-polygons",
      paint: {
        "fill-color": "#00ff00",
        "fill-opacity": 0.3,
        "fill-outline-color": "#006600"
      }
    });
    map.addSource('esa-worldcover', {
  type: 'raster',
  tileSize: 256,
  url: 'https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=esa-worldcover&item=ESA_WorldCover_10m_2021_v200_N36W123&assets=map&colormap_name=esa-worldcover&format=png'
});

map.addLayer({
  id: 'esa-worldcover-layer',
  type: 'raster',
  source: 'esa-worldcover',
  paint: {
    'raster-opacity': 0.5
  },
  layout: {
    visibility: "none" // ✅ initially hidden
  }
});


// Optional: Zoom to that area
// map.fitBounds([
//   [33.0, 0.0],
//   [34.0, 1.0]
// ]);

  }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !mapInstance) return;

    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("http://localhost:3001/api/upload-geojson", {
        method: "POST",
        body: form
      });
      const { geojson } = await res.json();

      // set data & fly to bounds
      mapInstance.getSource("uploaded-geojson").setData(geojson);

      let coords = [];
      geojson.features.forEach(f => {
        const g = f.geometry;
        if (g.type === "Polygon") {
          g.coordinates.flat(1).forEach(c => coords.push(c));
        } else if (g.type === "MultiPolygon") {
          g.coordinates.flat(2).forEach(c => coords.push(c));
        } else if (g.type === "LineString") {
          g.coordinates.forEach(c => coords.push(c));
        } else if (g.type === "Point") {
          coords.push(g.coordinates);
        }
      });
      const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      mapInstance.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)]
        ],
        { padding: 20 }
      );
      // STEP 1: Compute the center of the polygon
const center = [
  (Math.min(...lons) + Math.max(...lons)) / 2,
  (Math.min(...lats) + Math.max(...lats)) / 2
];

// STEP 2: Turn the uploaded polygon into a WKT string
const newWKT = `POLYGON((${coords.map(c => `${c[0]} ${c[1]}`).join(",")}))`;

// STEP 3: Create a name for the new farm
const newFarmName = `Uploaded Farm ${Object.keys(farmGeometries).length + 1}`;

// STEP 4: Add it to the farm list
setFarmGeometries(prev => ({
  ...prev,
  [newFarmName]: {
    wkt: newWKT,
    center
  }
}));
    } catch (err) {
      console.error("Upload failed", err);
    }
    e.target.value = "";
  };

  const fetchSpeciesFromGBIF = async (geometry) => {
    try {
      const res = await fetch("http://localhost:3001/api/gbif/species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry }),
      });
  
      const data = await res.json();
      console.log("🔎 GBIF Response:", data);
  
      // Set species list
      const species = data?.species || [];
      setGbifSpeciesList(Array.from(new Set(species)));
  
      if (!mapInstance || !data.geojson) return;
  
      const sourceId = "gbif-species-layer";
      const layerId = sourceId;
  
      // Remove previous layer/source if present
      if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
  
      // Load the icons (only once per map lifecycle)
      if (!mapInstance.hasImage("flora-icon")) {
        mapInstance.loadImage("/flower.png", (error, image) => {
          if (error) {
            console.error("❌ Failed to load flora icon", error);
            return;
          }
          if (!mapInstance.hasImage("flora-icon")) {
            mapInstance.addImage("flora-icon", image, { pixelRatio: 2 });
          }
        });
      }
  
      if (!mapInstance.hasImage("fauna-icon")) {
        mapInstance.loadImage("/fauna.png", (error, image) => {
          if (error) {
            console.error("❌ Failed to load fauna icon", error);
            return;
          }
          if (!mapInstance.hasImage("fauna-icon")) {
            mapInstance.addImage("fauna-icon", image, { pixelRatio: 2 });
          }
        });
      }
  
      // Add GeoJSON source
      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: data.geojson
      });
  
      // Add symbol layer using different icons for flora/fauna
      mapInstance.addLayer({
        id: layerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "icon-image": [
            "match",
            ["get", "kingdom"],
            "Plantae", "flora-icon",
            "Animalia", "fauna-icon",
            "flora-icon" // default fallback
          ],
          "icon-size": 0.10,
          "icon-allow-overlap": true,
          "icon-anchor": "center"
        }
      });
  
      mapInstance.on("click", layerId, (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${props.name}</strong><br/>Kingdom: ${props.kingdom || "Unknown"}`)
          .addTo(mapInstance);
      });
  
      console.log("✅ GBIF species added to map");
  
    } catch (err) {
      console.error("❌ Failed to fetch or render GBIF species:", err);
      setGbifSpeciesList([]);
    }
  };
  
  
  const fetchSpeciesFromEBird = async (lat, lng) => {
    try {
      const res = await fetch("http://localhost:3001/api/ebird/species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
  
      const resJson = await res.json();
      const geojson = resJson.geojson;
      const speciesList = resJson.speciesList || [];

      // ✅ Set species list in sidebar
      setEbirdSpeciesList(speciesList);
      console.log("🦜 eBird Response:", geojson);
  
      if (!mapInstance) return;
  
      const sourceId = "ebird-species-layer";
  
      // Remove existing layer/source if present
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
  
      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });
  
      mapInstance.addLayer({
        id: sourceId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 5,
          "circle-color": "#ff0080",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });
  
      mapInstance.on("click", sourceId, (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${props.comName}</strong><br/>Count: ${props.howMany}<br/>${props.locName || ""}<br/>Date: ${props.obsDt}`
          )
          .addTo(mapInstance);
      });
  
      console.log("✅ eBird species added to map");
    } catch (err) {
      console.error("❌ Failed to fetch or render eBird species:", err);
    }
  };
  
  

const fetchHotspotsFromEBird = async (lat, lng) => {
  try {
    const res = await fetch("http://localhost:3001/api/ebird/hotspots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });

    const { geojson } = await res.json();
    console.log("🟢 Hotspot GeoJSON:", geojson);

    // Optional: save if you still want to render in DetailPanel list
    setEbirdHotspots(geojson.features.map(f => ({
      locName: f.properties.name,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    })));

    // 🔵 Add to map as source + layer
    if (mapInstance) {
      // Remove existing hotspot source/layer if exists
      if (mapInstance.getLayer("ebird-hotspots-layer")) {
        mapInstance.removeLayer("ebird-hotspots-layer");
      }
      if (mapInstance.getSource("ebird-hotspots")) {
        mapInstance.removeSource("ebird-hotspots");
      }

      // Add new hotspot data
      mapInstance.addSource("ebird-hotspots", {
        type: "geojson",
        data: geojson,
      });
      const bounds = geojson.features.reduce((b, f) => {
        const [lng, lat] = f.geometry.coordinates;
        return b.extend([lng, lat]);
      }, new mapboxgl.LngLatBounds());
      
      mapInstance.fitBounds(bounds, { padding: 30 });

      mapInstance.addLayer({
        id: "ebird-hotspots-layer",
        type: "heatmap",
        source: "ebird-hotspots",
        paint: {
          "circle-radius": 6,
          "circle-color": "#ff6600",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#333"
        }
      });
    }
  } catch (err) {
    console.error("❌ Failed to fetch or add eBird hotspots to map:", err);
  }
};





const fetchSpeciesFromINat = async (geometry) => {
  try {
    const res = await fetch("http://localhost:3001/api/inaturalist/species", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geometry }),
    });

    const data = await res.json();
    setInatSpeciesList(data.species || []);

    const geojson = data.geojson;
    if (!mapInstance || !geojson) return;

    const sourceId = "inat-species-layer";

    // Remove existing layer/source if present
    if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

    mapInstance.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    mapInstance.addLayer({
      id: sourceId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": 6,
        "circle-color": "#1d4ed8", // blue
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff",
      },
    });

    mapInstance.on("click", sourceId, (e) => {
      const props = e.features[0].properties;
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${props.name}</strong><br/>Observer: ${props.observer}<br/>Date: ${props.date}`
        )
        .addTo(mapInstance);
    });

    console.log("✅ iNaturalist species added to map");

  } catch (err) {
    console.error("❌ Failed to fetch or render iNaturalist species:", err);
    setInatSpeciesList([]);
  }
};


  const fetchSpeciesForFarm = async (geometry) => {
    console
    await Promise.all([
      fetchSpeciesFromGBIF(geometry),
      fetchSpeciesFromINat(geometry),
    ]);
  };

  const handleFarmClick = async (farmKey) => {
    const farm = farmGeometries[farmKey];
    if (!mapInstance || !farm) return;

    mapInstance.flyTo({ center: farm.center, zoom: 10 });
    const coords = farm.wkt
      .replace("POLYGON((", "")
      .replace("))", "")
      .split(",")
      .map(p => p.trim().split(" ").map(Number));

    mapInstance.getSource("farm-polygons")?.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: { name: farmKey }
      }]
    });

    // await fetchSpeciesForFarm(farm.wkt);
  };

  const handleSelect = async (section, item) => {
    setActiveSection(section);
    setActiveItem(item);
    setDetailOpen(false);
    setTimeout(() => setDetailOpen(true), 50);

    if (section === "Biodiversity Assessment") {
  const farm = farmGeometries[selectedFarm];
  if (!farm) return;

  const coords = farm.center;
  const wkt = farm.wkt;

  if (item === "Species Observation Log") {
    await fetchSpeciesForFarm(wkt);
  } else if (item === "Bird Species Data") {
    await fetchSpeciesFromEBird(coords[1], coords[0]); // lat, lng
  } else if (item === "Biodiv. Hotspot Viewer") {
    await fetchHotspotsFromEBird(coords[1], coords[0]); // lat, lng
  }
}
  };
const handleDrawCreate = (e) => {
  // alert('running event handler');
  console.log(e.features);
  if (!e || !e.features || e.features.length === 0) return;

  const feature = e.features[0];

  if (!feature || feature.geometry.type !== "Polygon") return;

  const coords = feature.geometry.coordinates?.[0];
  if (!coords) return;

  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);

  const center = [
    (Math.min(...lons) + Math.max(...lons)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];

  const wkt = `POLYGON((${coords.map(c => `${c[0]} ${c[1]}`).join(",")}))`;
  const newFarmName = `Drawn Farm ${Object.keys(farmGeometries).length + 1}`;
  console.log(newFarmName);
  setFarmGeometries(prev => ({
    ...prev,
    [newFarmName]: { wkt, center },
  }));
};


  return (
    <div className="flex h-full overflow-hidden font-body">
      <Sidebar onSelect={handleSelect} />
      <div className="relative flex-1 bg-black overflow-hidden">
        <Topbar zoom={zoom} onZoom={setZoom} onUploadClick={handleUploadClick} />

        {/* hidden file input */}
        <input
          type="file"
          accept=".geojson,application/geo+json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <MapboxMap
          zoom={zoom}
          onMapReady={handleMapReady}
          onDrawCreate={handleDrawCreate}
          onDrawUpdate={() => {}}
          onDrawDelete={() => {}}
          onMapClick={() => {}}
          
        />
{esaVisible && (
  <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded shadow text-xs z-50">
    <h4 className="font-semibold mb-2">ESA Landcover Legend</h4>
    <table className="table-auto text-left">
      <tbody>
        {[
          { label: "Tree cover", color: "rgb(0, 100, 0)" },
          { label: "Shrubland", color: "rgb(255, 187, 34)" },
          { label: "Grassland", color: "rgb(255, 255, 76)" },
          { label: "Cropland", color: "rgb(240, 150, 255)" },
          { label: "Built-up", color: "rgb(250, 0, 0)" },
          { label: "Bare / sparse vegetation", color: "rgb(180, 180, 180)" },
          { label: "Snow and ice", color: "rgb(240, 240, 240)" },
          { label: "Permanent water bodies", color: "rgb(0, 100, 200)" },
          { label: "Herbaceous wetland", color: "rgb(0, 150, 160)" },
          { label: "Mangroves", color: "rgb(0, 207, 117)" },
          { label: "Moss and lichen", color: "rgb(250, 230, 160)" },
        ].map((item, idx) => (
          <tr key={idx}>
            <td>
              <div
                className="w-4 h-4 mr-2 rounded"
                style={{ backgroundColor: item.color }}
              ></div>
            </td>
            <td className="pl-2">{item.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
        

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
  selectedRangeRef={selectedRangeRef} // ✅ Add this
  selectedGHG={selectedGHG}
  setSelectedGHG={setSelectedGHG}
   thumbnails={thumbnails}               // ✅ Add this
  setThumbnails={setThumbnails}         // ✅ Add this
    mapInstance={mapInstance} // ✅ add this
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
      indicatorLayers ={indicatorLayers}
      setIndicatorLayers ={setIndicatorLayers}
      hotspotVisible={hotspotVisible}
      setHotspotVisible={setHotspotVisible}
      gbifVisible={gbifVisible}
      setGbifVisible={setGbifVisible}
      inatVisible={inatVisible}
      setInatVisible={setInatVisible}
      esaVisible={esaVisible}
      setEsaVisible={setEsaVisible}

/>
      </div>
    </div>
  );
}