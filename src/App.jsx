// src/App.jsx
import { useState, useRef } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import MapboxMap from "./components/MapboxMap";

// Define 3 farm WKT geometries
const farmGeometries = {
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
};

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
      id: 2, title: "Organic Assessment", accent: "accent2",
      items: ["Soil Health Map", "Crop Health Analysis", "Pest and Disease Alerts", "Crop Rotation Planner", "Water Resource Mapping", "Fertilizer Application Map", "Compost Heatmap", "Biodiv. Hotspot Viewer", "Pollinator Activity Zones", "Buffer Zone Assessment", "Wildlife Corridor Mapping", "Carbon Sequestration", "Green Cover Changes", "Deforestation Monitoring", "Organic Zone Boundaries", "Adjacent Land Use", "Pesticide Drift Risk Map", "Extra Tools", "Add IoT Ground Truth Data", "Add Hyperspectral"]
    },
    {
      id: 3, title: "Carbon & GHG Metrics", accent: "accent3",
      items: ["CO₂ Capture Data", "GHG Emission Tracker", "Carbon Credit Mgmt.", "Emission Comparison"],
    },
    {
      id: 4, title: "Biodiversity Assessment", accent: "accent4",
      items: ["Biodiversity Index Score", "Soil Microbes & Biodiv.", "Wildlife Data", "Bird Species Data", "Pollinator Data", "Tree Species Data", "Invasive Species Data", "Endangered Species Data", "Aquatic Biodiversity Data", "Species Observation Log", "Impact Heatmap"]
    },
    {
      id: 5, title: "Compliance & Regulatory", accent: "accent5",
      items: ["Compliance Dashboard", "Generate Compl. Reports", "Submit Data to Regulators"]
    },
    { id: 6, title: "SDGs", accent: "accent6", items: [] },
  ];

  const accentColors = {
    accent1: "bg-lime-300 text-black",
    accent2: "bg-cyan-300 text-black",
    accent3: "bg-pink-300 text-black",
    accent4: "bg-yellow-300 text-black",
    accent5: "bg-purple-300 text-black",
    accent6: "bg-blue-300 text-black",
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
        <button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
          Upload GeoJSON
        </button>
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
  onFarmSelect
}) {
  const sectionBgMap = {
    "Farm Monitoring": "bg-lime-300",
    "Organic Assessment": "bg-cyan-300",
    "Carbon & GHG Metrics": "bg-pink-300",
    "Biodiversity Assessment": "bg-yellow-300",
    "Compliance & Regulatory": "bg-purple-300",
    "SDGs": "bg-blue-300",
  };
  const panelClass = section ? sectionBgMap[section] : "bg-gray-300";

  return (
    <div className={`fixed top-0 right-0 h-full w-80 ${panelClass} p-4 transform transition-transform ${open ? "translate-x-0" : "translate-x-full"} z-20`}>
      <button onClick={onClose} className="absolute left-0 top-1/2 -translate-x-full bg-panelBg p-2 rounded-l">‹‹</button>
      <h2 className="text-xl mb-2 font-bold">{section}</h2>
      <p className="text-sm mb-4">You selected: <strong>{item}</strong></p>

      {section === "Biodiversity Assessment" && item === "Species Observation Log" && (
        <div className="bg-white text-black rounded p-2 text-sm max-h-[400px] overflow-y-auto space-y-4">
          <div>
            <h3 className="font-semibold mb-2">GBIF Species ({gbifSpecies.length})</h3>
            {gbifSpecies.length === 0 ? <p>No species found.</p> : (
              <ul className="list-disc list-inside space-y-1">
                {gbifSpecies.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">iNaturalist Species ({inatSpecies.length})</h3>
            {inatSpecies.length === 0 ? <p>No species found.</p> : (
              <ul className="list-disc list-inside space-y-1">
                {inatSpecies.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            )}
          </div>
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
              onClick={() => onFarmSelect(farmName)}
              className="w-full text-left hover:underline"
            >
              {farmName}
            </button>
          </li>
        ))}
      </ul>
    </div>

    {item === "Historical Data" && (
      <div className="pt-2">
        <h3 className="font-semibold mb-2">Select Date</h3>
        <Calendar
          onChange={(date) => console.log("📅 Selected date:", date)}
          maxDate={new Date()}
        />
      </div>
    )}
  </div>
)}

    </div>
  );
}

export default function App() {
  const [mapInstance, setMapInstance] = useState(null);
  const [drawInstance, setDrawInstance] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [activeSection, setActiveSection] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [gbifSpeciesList, setGbifSpeciesList] = useState([]);
  const [inatSpeciesList, setInatSpeciesList] = useState([]);

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
      const species = data?.results?.length
        ? data.results.map(d => d.species).filter(Boolean)
        : data.species || [];
      setGbifSpeciesList(Array.from(new Set(species)));
    } catch {
      setGbifSpeciesList([]);
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
    } catch {
      setInatSpeciesList([]);
    }
  };

  const fetchSpeciesForFarm = async (geometry) => {
    await Promise.all([
      fetchSpeciesFromGBIF(geometry),
      fetchSpeciesFromINat(geometry),
    ]);
  };

  const handleFarmClick = async (farmKey) => {
    const farm = farmGeometries[farmKey];
    if (!mapInstance || !farm) return;
  mapInstance.stop();

    mapInstance.flyTo({ center: farm.center, zoom: 13 });
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

    await fetchSpeciesForFarm(farm.wkt);
  };

  const handleSelect = async (section, item) => {
    setActiveSection(section);
    setActiveItem(item);
    setDetailOpen(false);
    setTimeout(() => setDetailOpen(true), 50);

    if (section === "Biodiversity Assessment" && item === "Species Observation Log") {
      await fetchSpeciesForFarm(farmGeometries["Farm A"].wkt);
    }
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
          onDrawCreate={() => {}}
          onDrawUpdate={() => {}}
          onDrawDelete={() => {}}
          onMapClick={() => {}}
        />

        <Panel
          title="Search Material Type"
          options={["Cotton", "Linen", "Hemp"]}
          style={{ left: "20rem" }}
          onClick={() => {}}
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
        />
      </div>
    </div>
  );
}
