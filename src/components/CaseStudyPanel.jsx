import { useState, useEffect, useCallback } from "react";

const PILOT_META = {
  title: "Organic Cotton Compliance & Digital Twin Validation",
  location: "Khargone, Madhya Pradesh, India",
  period: "2024 – 2025",
  lead: "Dr. Prakash Kumar Jha (CTO)",
  certification: ["EU Organic Regulation 2018/848", "ISO/IEC 17065", "EUDR Traceability"],
  dataSources: ["Sentinel-2 (ESA)", "Drone Orthomosaic (sub-5cm)", "EnMAP / PRISMA Reference", "LiDAR / CHM"],
};

const LAYER_CONFIG = [
  {
    id: "farm-boundary",
    label: "Farm Boundary",
    endpoint: "/api/case-study/farm-boundary",
    color: "#a3e635",       // lime
    fillOpacity: 0,
    lineWidth: 2,
    type: "line",
  },
  {
    id: "lulc",
    label: "Land Use / Land Cover",
    endpoint: "/api/case-study/lulc",
    color: "#38bdf8",       // sky
    fillOpacity: 0.35,
    type: "fill",
  },
  {
    id: "chm-vector",
    label: "Canopy Height Model",
    endpoint: "/api/case-study/chm-vector",
    color: "#4ade80",       // green
    fillOpacity: 0.45,
    type: "fill",
  },
];

const INDICES = [
  { label: "NDVI", desc: "Normalized Difference Vegetation Index — crop health" },
  { label: "Green", desc: "Green band reflectance — canopy density" },
  { label: "NIR", desc: "Near-infrared — vegetation biomass" },
  { label: "Red Edge", desc: "Crop stress & chlorophyll content" },
];

export default function CaseStudyPanel({ open, onClose, item, mapInstance }) {
  const [activeLayers, setActiveLayers] = useState({});
  const [loadingLayer, setLoadingLayer] = useState(null);
  const [layerError, setLayerError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  // Clean up all case-study layers when panel closes
  useEffect(() => {
    if (!open && mapInstance) {
      LAYER_CONFIG.forEach(({ id }) => {
        if (mapInstance.getLayer(`cs-${id}`)) mapInstance.removeLayer(`cs-${id}`);
        if (mapInstance.getSource(`cs-${id}`)) mapInstance.removeSource(`cs-${id}`);
      });
      setActiveLayers({});
    }
  }, [open, mapInstance]);

  const toggleLayer = useCallback(async (layer) => {
    if (!mapInstance) return;
    const sourceId = `cs-${layer.id}`;

    if (activeLayers[layer.id]) {
      // Remove
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      setActiveLayers((p) => ({ ...p, [layer.id]: false }));
      return;
    }

    // Load
    setLoadingLayer(layer.id);
    setLayerError(null);
    try {
      const res = await fetch(layer.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      if (geojson.error) throw new Error(geojson.error);

      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

      mapInstance.addSource(sourceId, { type: "geojson", data: geojson });

      if (layer.type === "fill") {
        mapInstance.addLayer({
          id: sourceId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": layer.color,
            "fill-opacity": layer.fillOpacity,
            "fill-outline-color": layer.color,
          },
        });
      } else {
        mapInstance.addLayer({
          id: sourceId,
          type: "line",
          source: sourceId,
          paint: { "line-color": layer.color, "line-width": layer.lineWidth || 2 },
        });
      }

      // Fly to data extent
      const coords = [];
      geojson.features.forEach((f) => {
        const geom = f.geometry;
        if (!geom) return;
        const flat = geom.type === "Polygon" ? geom.coordinates.flat()
          : geom.type === "MultiPolygon" ? geom.coordinates.flat(2)
          : geom.type === "LineString" ? geom.coordinates
          : [];
        flat.forEach((c) => coords.push(c));
      });
      if (coords.length) {
        const lons = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        mapInstance.fitBounds(
          [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          { padding: 40 }
        );
      }

      setActiveLayers((p) => ({ ...p, [layer.id]: true }));
    } catch (err) {
      setLayerError(`${layer.label}: ${err.message}`);
    } finally {
      setLoadingLayer(null);
    }
  }, [mapInstance, activeLayers]);

  if (!open) return null;

  const renderContent = () => {
    if (item === "Pilot Overview") return <PilotOverview />;
    if (item === "Digital Twin (LULC)") return (
      <LayerSection
        layers={LAYER_CONFIG.filter(l => ["farm-boundary", "lulc"].includes(l.id))}
        activeLayers={activeLayers}
        loadingLayer={loadingLayer}
        layerError={layerError}
        onToggle={toggleLayer}
        title="Digital Twin Layers"
        description="Farm boundary + LULC classification derived from drone survey. Segmented land parcels with crop/non-crop classification."
      />
    );
    if (item === "Canopy Height Model") return (
      <LayerSection
        layers={LAYER_CONFIG.filter(l => l.id === "chm-vector")}
        activeLayers={activeLayers}
        loadingLayer={loadingLayer}
        layerError={layerError}
        onToggle={toggleLayer}
        title="Canopy Height Model"
        description="LiDAR-derived CHM showing vegetation height above ground. Reclassified into height classes for compliance reporting."
        extra={<ChmStats />}
      />
    );
    if (item === "Vegetation Indices") return (
      <IndicesSection activeIndex={activeIndex} setActiveIndex={setActiveIndex} />
    );
    return null;
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-[#161619] border-l border-violet-400/40 transform transition-transform ${open ? "translate-x-0" : "translate-x-full"} z-20 overflow-y-auto flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Case Study · Pilot</p>
          <p className="text-white text-sm font-semibold leading-tight mt-0.5">{item}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
      </div>

      {/* Location badge */}
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
        <span className="text-[10px] bg-violet-400/10 text-violet-400 border border-violet-400/20 rounded px-2 py-0.5">Khargone, MP · India</span>
        <span className="text-[10px] text-gray-500">Cotton · 2024–25</span>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 text-sm text-gray-300">
        {renderContent()}
      </div>
    </div>
  );
}

function PilotOverview() {
  return (
    <div className="space-y-4">
      <div className="bg-violet-400/5 border border-violet-400/20 rounded-lg p-3 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Objective</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Validate a space-enabled organic cotton compliance system through creation of a Digital Twin, toxic chemical detection, and cross-validation of declared organic practices.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sub-Tasks</h3>
        {[
          { n: "1", label: "Baseline & Pre-Treatment Verification", status: "done" },
          { n: "2", label: "Digital Twin Creation", status: "done" },
          { n: "3", label: "Toxic Chemical & Risk Screening", status: "partial" },
          { n: "4", label: "Drone Audit", status: "done" },
          { n: "5", label: "Cultivation & Post-Harvest Audit", status: "pending" },
        ].map(({ n, label, status }) => (
          <div key={n} className="flex items-center gap-2.5 rounded-md bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <span className="text-[10px] font-mono text-violet-400 flex-shrink-0">{n}</span>
            <span className="text-xs text-gray-300 flex-1">{label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              status === "done" ? "bg-green-400/10 text-green-400" :
              status === "partial" ? "bg-yellow-400/10 text-yellow-400" :
              "bg-white/5 text-gray-500"}`}>
              {status === "done" ? "✓ Done" : status === "partial" ? "Partial" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Data Sources</h3>
        {PILOT_META.dataSources.map((s) => (
          <div key={s} className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
            {s}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Certification Targets</h3>
        {PILOT_META.certification.map((c) => (
          <div key={c} className="text-[10px] text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1">{c}</div>
        ))}
      </div>
    </div>
  );
}

function LayerSection({ layers, activeLayers, loadingLayer, layerError, onToggle, title, description, extra }) {
  return (
    <div className="space-y-4">
      <div className="bg-violet-400/5 border border-violet-400/20 rounded-lg p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">{title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase text-gray-500">Map Layers</p>
        {layers.map((layer) => (
          <button key={layer.id}
            onClick={() => onToggle(layer)}
            disabled={loadingLayer === layer.id}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md border transition text-xs ${
              activeLayers[layer.id]
                ? "bg-violet-400/10 border-violet-400/40 text-violet-300"
                : "border-white/10 hover:bg-white/5 text-gray-400"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: layer.color }} />
              <span>{layer.label}</span>
            </div>
            {loadingLayer === layer.id
              ? <span className="text-[10px] text-violet-400 animate-pulse">Loading…</span>
              : <span className="text-[10px]">{activeLayers[layer.id] ? "Hide" : "Show"}</span>
            }
          </button>
        ))}
        {layerError && <p className="text-[10px] text-red-400">{layerError}</p>}
      </div>

      {extra}
    </div>
  );
}

function ChmStats() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
      <p className="text-[10px] uppercase text-gray-500">CHM Classes</p>
      {[
        { label: "0–2 m", desc: "Ground / low crop", color: "#fbbf24" },
        { label: "2–5 m", desc: "Shrub / young trees", color: "#a3e635" },
        { label: "5–10 m", desc: "Medium canopy", color: "#4ade80" },
        { label: "> 10 m", desc: "Mature trees / hedgerows", color: "#166534" },
      ].map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
          <span className="text-gray-300 w-14">{c.label}</span>
          <span className="text-gray-500">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}

function IndicesSection({ activeIndex, setActiveIndex }) {
  return (
    <div className="space-y-4">
      <div className="bg-violet-400/5 border border-violet-400/20 rounded-lg p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">Drone Spectral Indices</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          High-resolution indices computed from multispectral drone imagery at sub-5cm resolution. Used for crop health validation and toxic input detection.
        </p>
      </div>

      <div className="space-y-2">
        {INDICES.map((idx) => (
          <button key={idx.label}
            onClick={() => setActiveIndex(activeIndex === idx.label ? null : idx.label)}
            className={`w-full text-left rounded-md px-3 py-2 border transition ${
              activeIndex === idx.label
                ? "bg-violet-400/10 border-violet-400/40 text-violet-300"
                : "border-white/10 hover:bg-white/5 text-gray-400"
            }`}
          >
            <span className="font-mono text-violet-400 text-xs">{idx.label}</span>
            <p className="text-[10px] text-gray-500 mt-0.5">{idx.desc}</p>
          </button>
        ))}
      </div>

      {activeIndex && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase text-gray-500">Raster Overlay</p>
          <p className="text-xs text-gray-400">
            Local GeoTIFF raster rendering coming soon. Data path:
          </p>
          <p className="text-[10px] font-mono text-violet-400 break-all">
            Kharogone/Indices/{activeIndex.toLowerCase()}/
          </p>
          <p className="text-[10px] text-gray-500">
            Raster tile serving requires GDAL processing. Use FastAPI raster endpoint to render.
          </p>
        </div>
      )}
    </div>
  );
}
