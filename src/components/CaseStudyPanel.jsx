import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import mapboxgl from "mapbox-gl";
import { API_BASE } from "../api/client";
import khData from "../data/khargone_organic_assessment.json";

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
    endpoint: `${API_BASE}/api/case-study/farm-boundary`,
    color: "#a3e635",       // lime
    fillOpacity: 0,
    lineWidth: 2,
    type: "line",
  },
  {
    id: "lulc",
    label: "Land Use / Land Cover",
    endpoint: `${API_BASE}/api/case-study/lulc`,
    color: "#94a3b8",       // outline fallback
    fillOpacity: 0.55,
    type: "fill",
    colorExpression: [
      "match", ["get", "Class"],
      "Cotton Farms",      "#f59e0b",
      "Trees/Plantations", "#22c55e",
      "Roads",             "#94a3b8",
      "Barren Land",       "#d97706",
      "#6b7280",
    ],
    legend: [
      { label: "Cotton Farms",       color: "#f59e0b" },
      { label: "Trees/Plantations",  color: "#22c55e" },
      { label: "Roads",              color: "#94a3b8" },
      { label: "Barren Land",        color: "#d97706" },
    ],
  },
  {
    id: "chm-vector",
    label: "Canopy Height Model",
    endpoint: `${API_BASE}/api/case-study/chm-vector`,
    color: "#ffffff",
    fillOpacity: 0.8,
    type: "fill",
    colorExpression: [
      "match", ["get", "gridcode"],
      1, "#fde68a",   // 0 – 0.29 m   bare / ground
      2, "#bef264",   // 0.29 – 1.04 m low crop
      3, "#34d399",   // 1.04 – 2.64 m medium canopy
      4, "#0284c7",   // 2.64 – 5.48 m tall canopy
      5, "#7c3aed",   // 5.48 – 8.31 m mature trees
      "#6b7280",
    ],
  },
];

const INDICES = [
  { label: "NDVI",     key: "ndvi",     png: "/khargone-study/ndvi.png",      desc: "Normalized Difference Vegetation Index — crop health", min: "Low / Bare", max: "High / Dense", gradient: "from-[#d73027] via-[#fee08b] to-[#1a9850]" },
  { label: "Green",    key: "green",    png: "/khargone-study/green.png",     desc: "Green band reflectance — canopy density",              min: "Low",        max: "High",         gradient: "from-[#f7fcf5] via-[#74c476] to-[#00441b]" },
  { label: "NIR",      key: "nir",      png: "/khargone-study/nir.png",       desc: "Near-infrared — vegetation biomass",                   min: "Low",        max: "High",         gradient: "from-[#ffffe5] via-[#fe9929] to-[#7f0000]" },
  { label: "Red Edge", key: "red_edge", png: "/khargone-study/red_edge.png",  desc: "Crop stress & chlorophyll content",                    min: "Low",        max: "High",         gradient: "from-[#fff7f3] via-[#fa9fb5] to-[#49006a]" },
];

export default function CaseStudyPanel({ open, onClose, item, mapInstance }) {
  const [activeLayers, setActiveLayers] = useState({});
  const [loadingLayer, setLoadingLayer] = useState(null);
  const [layerError, setLayerError] = useState(null);

  // Fly to Khargone farm when panel opens or item changes
  useEffect(() => {
    if (!open || !mapInstance) return;
    mapInstance.flyTo({
      center: [75.411842, 21.939043],
      zoom: 16.5,
      pitch: 0,
      bearing: 0,
      duration: 300,
      essential: true,
    });
  }, [open, item, mapInstance]);

  // Clean up all case-study layers when panel closes
  useEffect(() => {
    if (!open && mapInstance) {
      LAYER_CONFIG.forEach(({ id }) => {
        try { if (mapInstance.getLayer(`cs-${id}`)) mapInstance.removeLayer(`cs-${id}`); } catch {}
        try { if (mapInstance.getSource(`cs-${id}`)) mapInstance.removeSource(`cs-${id}`); } catch {}
      });
      try { if (mapInstance.getLayer("khargone-3d-mesh")) mapInstance.removeLayer("khargone-3d-mesh"); } catch {}
      setActiveLayers({});
    }
  }, [open, mapInstance]);

  const toggleLayer = useCallback(async (layer) => {
    if (!mapInstance) return;
    const sourceId = `cs-${layer.id}`;

    if (activeLayers[layer.id]) {
      // Remove — guard with try/catch so state always clears even if map throws
      try { if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId); } catch {}
      try { if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId); } catch {}
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
            "fill-color": layer.colorExpression ?? layer.color,
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
      <div className="space-y-4">
        <LayerSection
          layers={LAYER_CONFIG.filter(l => ["farm-boundary", "lulc"].includes(l.id))}
          activeLayers={activeLayers}
          loadingLayer={loadingLayer}
          layerError={layerError}
          onToggle={toggleLayer}
          title="Digital Twin Layers"
          description="Farm boundary + LULC classification derived from drone survey. Segmented land parcels with crop/non-crop classification."
        />
        <Mesh3DSection mapInstance={mapInstance} />
      </div>
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
    if (item === "Organic Assessment") return <KhargoneOrganicAssessment />;
    if (item === "Vegetation Indices") return (
      <IndicesSection mapInstance={mapInstance} />
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

// ── Pilot data (from cotton_yield_estimation + dataset CSVs) ──────────────────
const PHENOLOGY = [
  { d: "Apr 1",  v: 0.710 }, { d: "Apr 15", v: 0.589 },
  { d: "May 1",  v: 0.374 }, { d: "May 15", v: 0.238 },
  { d: "Jun 1",  v: 0.258 }, { d: "Jun 15", v: 0.475 },
  { d: "Jul 1",  v: 0.703 }, { d: "Jul 15", v: 0.687 },
  { d: "Aug 1",  v: 0.471 }, { d: "Aug 15", v: 0.274 },
  { d: "Sep 1",  v: 0.198 }, { d: "Sep 15", v: 0.352 },
  { d: "Oct 1",  v: 0.597 }, { d: "Oct 15", v: 0.662 },
];

const ANNUAL_NDVI = [
  { y: "2019", v: 0.309 }, { y: "2020", v: 0.440 },
  { y: "2021", v: 0.352 }, { y: "2022", v: 0.355 },
  { y: "2023", v: 0.358 },
];

const FEATURE_IMP = [
  { label: "Wetness Index",  pct: 12.05 },
  { label: "NDVI Mean",      pct: 9.14  },
  { label: "Temporal T6",    pct: 9.10  },
  { label: "Temporal T3",    pct: 8.71  },
  { label: "NDVI Min",       pct: 8.14  },
  { label: "NDVI Max",       pct: 6.91  },
];

function Sparkline({ data, color = "#a78bfa" }) {
  const W = 252, H = 48;
  const vals = data.map(d => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const step = W / (vals.length - 1);
  const points = vals.map((v, i) =>
    `${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`
  ).join(" ");
  // area fill path
  const area = `M0,${H} ` + vals.map((v, i) =>
    `L${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`
  ).join(" ") + ` L${W},${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spkGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PilotOverview() {
  return (
    <div className="space-y-4">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { val: "18,106", unit: "ha",   label: "Cotton Area",  color: "text-violet-400" },
          { val: "2.26",   unit: "%",    label: "Coverage",     color: "text-emerald-400" },
          { val: "~9,958", unit: "t",    label: "Est. Yield",   color: "text-amber-400" },
        ].map(({ val, unit, label, color }) => (
          <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
            <p className={`text-base font-bold leading-none ${color}`}>{val}<span className="text-[10px] ml-0.5 text-gray-500">{unit}</span></p>
            <p className="text-[9px] text-gray-500 mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Phenology curve ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">NDVI Phenology</p>
          <span className="text-[9px] text-gray-600">Apr – Oct</span>
        </div>
        <Sparkline data={PHENOLOGY} color="#a78bfa" />
        <div className="flex justify-between text-[9px] text-gray-600">
          <span>Apr</span><span>Jun</span><span>Jul peak</span><span>Sep min</span><span>Oct</span>
        </div>
        <div className="flex gap-3 text-[10px] text-gray-400 mt-1">
          <span>Peak <span className="text-violet-400 font-medium">0.71</span> Apr</span>
          <span>Peak <span className="text-violet-400 font-medium">0.70</span> Jul</span>
          <span>Min <span className="text-red-400 font-medium">0.20</span> Sep</span>
        </div>
      </div>

      {/* ── Yield scenarios ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Yield Scenarios · 18,106 ha</p>
        {[
          { label: "Low",    kg: 450, t: "8,148",  pct: 65, color: "bg-amber-400/60" },
          { label: "Medium", kg: 550, t: "9,958",  pct: 80, color: "bg-emerald-400/70" },
          { label: "High",   kg: 650, t: "11,769", pct: 95, color: "bg-violet-400/70" },
        ].map(({ label, kg, t, pct, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">{label} <span className="text-gray-600">({kg} kg/ha)</span></span>
              <span className="text-gray-300 font-medium">{t} t</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Feature importance ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">RF Model · Feature Importance</p>
        {FEATURE_IMP.map(({ label, pct }) => (
          <div key={label} className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-500 font-mono">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${(pct / 13) * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-[9px] text-gray-600 mt-1">Random Forest · 20 spectral/temporal features · 2019–2023</p>
      </div>

      {/* ── Annual NDVI ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Annual Mean NDVI</p>
        <div className="flex items-end gap-1.5 h-10">
          {ANNUAL_NDVI.map(({ y, v }) => {
            const h = Math.round((v / 0.44) * 100);
            return (
              <div key={y} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[8px] text-gray-500 font-mono">{v.toFixed(2)}</span>
                <div className="w-full rounded-sm bg-violet-400/60" style={{ height: `${h}%`, minHeight: 4 }} />
                <span className="text-[8px] text-gray-600">{y}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-gray-600">2020 peak (0.44) — above-average monsoon precipitation</p>
      </div>

      {/* ── NDVI–Climate correlations ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">NDVI Correlations (Pearson)</p>
        {[
          { label: "Temperature",   r: -0.549, neg: true },
          { label: "Precipitation", r:  0.232, neg: false },
          { label: "Radiation",     r:  0.019, neg: false },
          { label: "Wind Speed",    r: -0.108, neg: true },
        ].map(({ label, r, neg }) => (
          <div key={label} className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full absolute top-0 ${neg ? "right-1/2 bg-red-400/60" : "left-1/2 bg-emerald-400/60"}`}
                style={{ width: `${Math.abs(r) * 50}%` }}
              />
            </div>
            <span className={`font-mono w-12 text-right ${neg ? "text-red-400" : "text-emerald-400"}`}>{r > 0 ? "+" : ""}{r.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* ── Area classification ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Land Classification</p>
        {[
          { label: "Cotton",      ha: "18,106", pct: 2.26,  color: "bg-amber-400" },
          { label: "Other Crops", ha: "18,400", pct: 2.30,  color: "bg-emerald-400" },
          { label: "Non-Crop",    ha: "781,600",pct: 97.70, color: "bg-white/20" },
        ].map(({ label, ha, pct, color }) => (
          <div key={label} className="flex items-center gap-2 text-[10px]">
            <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${color}`} />
            <span className="text-gray-400 flex-1">{label}</span>
            <span className="text-gray-500 font-mono">{ha} ha</span>
            <span className="text-gray-600 w-10 text-right">{pct}%</span>
          </div>
        ))}
      </div>

      {/* ── Sub-tasks ── */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sub-Tasks</h3>
        {[
          { n: "1", label: "Baseline & Pre-Treatment Verification", status: "done" },
          { n: "2", label: "Digital Twin Creation",                  status: "done" },
          { n: "3", label: "Toxic Chemical & Risk Screening",        status: "partial" },
          { n: "4", label: "Drone Audit",                            status: "done" },
          { n: "5", label: "Cultivation & Post-Harvest Audit",       status: "pending" },
        ].map(({ n, label, status }) => (
          <div key={n} className="flex items-center gap-2.5 rounded-md bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <span className="text-[10px] font-mono text-violet-400 flex-shrink-0">{n}</span>
            <span className="text-xs text-gray-300 flex-1">{label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
              status === "done" ? "bg-green-400/10 text-green-400" :
              status === "partial" ? "bg-yellow-400/10 text-yellow-400" :
              "bg-white/5 text-gray-500"}`}>
              {status === "done" ? "✓ Done" : status === "partial" ? "Partial" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      {/* ── Certifications ── */}
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

      {layers.map((layer) => layer.legend && activeLayers[layer.id] && (
        <div key={`${layer.id}-legend`} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] uppercase text-gray-500">{layer.label} Classes</p>
          {layer.legend.map((entry) => (
            <div key={entry.label} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400">{entry.label}</span>
            </div>
          ))}
        </div>
      ))}

      {extra}
    </div>
  );
}

function ChmStats() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
      <p className="text-[10px] uppercase text-gray-500">CHM Classes</p>
      {[
        { label: "0 – 0.29 m",    desc: "Bare / ground",    color: "#fde68a" },
        { label: "0.29 – 1.04 m", desc: "Low crop",         color: "#bef264" },
        { label: "1.04 – 2.64 m", desc: "Medium canopy",    color: "#34d399" },
        { label: "2.64 – 5.48 m", desc: "Tall canopy",      color: "#0284c7" },
        { label: "5.48 – 8.31 m", desc: "Mature trees",     color: "#7c3aed" },
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

function IndicesSection({ mapInstance }) {
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  async function loadRaster(key) {
    if (!mapInstance) return;
    const sourceId = `cs-raster-${key}`;

    // Toggle off
    if (activeKey === key) {
      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      setActiveKey(null);
      return;
    }

    // Remove previous raster
    if (activeKey) {
      const prevId = `cs-raster-${activeKey}`;
      if (mapInstance.getLayer(prevId)) mapInstance.removeLayer(prevId);
      if (mapInstance.getSource(prevId)) mapInstance.removeSource(prevId);
    }

    setLoading(key); setError(null);
    try {
      const res = await fetch(`${API_BASE}/fastapi/case-study/raster/${key}/info`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      if (info.error) throw new Error(info.error);

      const [west, south, east, north] = info.bounds;

      if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

      mapInstance.addSource(sourceId, {
        type: "image",
        url: info.png_url,
        coordinates: [
          [west, north], [east, north],
          [east, south], [west, south],
        ],
      });
      mapInstance.addLayer({
        id: sourceId,
        type: "raster",
        source: sourceId,
        paint: { "raster-opacity": 0.85 },
      });
      mapInstance.fitBounds([[west, south], [east, north]], { padding: 40 });
      setActiveKey(key);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-violet-400/5 border border-violet-400/20 rounded-lg p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">Drone Spectral Indices</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Sub-5cm multispectral indices from drone survey. Rendered as map overlays via FastAPI raster engine.
        </p>
      </div>

      <div className="space-y-2">
        {INDICES.map((idx) => (
          <button key={idx.key}
            onClick={() => loadRaster(idx.key)}
            disabled={loading === idx.key}
            className={`w-full text-left rounded-md px-3 py-2 border transition ${
              activeKey === idx.key
                ? "bg-violet-400/10 border-violet-400/40 text-violet-300"
                : "border-white/10 hover:bg-white/5 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-violet-400 text-xs">{idx.label}</span>
              {loading === idx.key
                ? <span className="text-[10px] text-violet-400 animate-pulse">Rendering…</span>
                : <span className="text-[10px]">{activeKey === idx.key ? "Hide" : "Show"}</span>
              }
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">{idx.desc}</p>
          </button>
        ))}
      </div>

      {activeKey && (() => {
        const idx = INDICES.find(i => i.key === activeKey);
        if (!idx) return null;
        return (
          <div className="rounded-lg bg-white/[0.03] border border-violet-400/15 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">{idx.label} Legend</span>
              <span className="text-[9px] text-gray-500">{idx.desc.split("—")[0].trim()}</span>
            </div>
            <div className={`h-3 w-full rounded bg-gradient-to-r ${idx.gradient}`} />
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>{idx.min}</span>
              <span>{idx.max}</span>
            </div>
          </div>
        );
      })()}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

// ── Khargone Organic Assessment — sourced from src/data/khargone_organic_assessment.json
// Generated by scripts/compute_khargone_organic.py + compute_khargone_rasters.py
// Inputs: yearly_statistics.csv · phenology_data.csv · NDVI/CHM GeoTIFFs
const KH_ANNUAL    = khData.annual;
const KH_ROTATION  = khData.rotation;
const KH_COVER     = khData.cover;
const KH_COMPOST   = khData.compost;
const KH_CARBON    = khData.carbon;
const KH_CHEM_FREE = khData.chemFree;
const KH_BUFFER    = khData.buffer;
const KH_AGCHEM_TREND = { ...khData.agchem, years: khData.annual };

function KhargoneOrganicAssessment() {
  const [expanded, setExpanded] = useState(null);
  const toggle = (key) => setExpanded(e => e === key ? null : key);

  // ── sub-components ─────────────────────────────────────────────────────────
  function Acc({ id, icon, title, badge, badgeColor, children }) {
    const bc = {
      green:  "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
      yellow: "bg-yellow-400/10  text-yellow-400  border-yellow-400/25",
      red:    "bg-red-400/10     text-red-400     border-red-400/25",
      sky:    "bg-sky-400/10     text-sky-400     border-sky-400/25",
    }[badgeColor] || "bg-white/5 text-gray-400 border-white/10";
    return (
      <div className="rounded-lg border border-white/[0.07] overflow-hidden">
        <button onClick={() => toggle(id)}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition text-left">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-semibold text-gray-200 flex-1">{title}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase ${bc}`}>{badge}</span>
          <span className="text-[10px] text-gray-600 ml-1">{expanded === id ? "▲" : "▼"}</span>
        </button>
        {expanded === id && (
          <div className="px-3 py-3 bg-black/20 space-y-2">{children}</div>
        )}
      </div>
    );
  }

  function Row({ label, value, sub, good }) {
    const vc = good === true ? "text-emerald-400" : good === false ? "text-red-400" : "text-gray-200";
    return (
      <div className="flex items-start justify-between py-0.5 border-b border-white/[0.04] gap-2">
        <span className="text-[10px] text-gray-400 flex-1">{label}</span>
        <div className="text-right">
          <span className={`font-mono text-[10px] font-semibold ${vc}`}>{value}</span>
          {sub && <p className="text-[9px] text-gray-600">{sub}</p>}
        </div>
      </div>
    );
  }

  // Mini sparkline for annual NDVI trend
  function AnnualSparkline() {
    const W = 240, H = 44;
    const vals = KH_ANNUAL.map(y => y.ndvi);
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 0.01;
    const step = W / (vals.length - 1);
    const pts = vals.map((v, i) =>
      `${(i * step).toFixed(1)},${(H - ((v - min) / range) * (H - 6) - 3).toFixed(1)}`).join(" ");
    const area = `M0,${H} ` + vals.map((v, i) =>
      `L${(i * step).toFixed(1)},${(H - ((v - min) / range) * (H - 6) - 3).toFixed(1)}`).join(" ") + ` L${W},${H} Z`;
    return (
      <div className="space-y-1">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible w-full">
          <defs>
            <linearGradient id="kgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#kgGrad)" />
          <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
          {KH_ANNUAL.map((y, i) => (
            <text key={y.year} x={(i * step).toFixed(1)} y={H + 2}
              textAnchor="middle" fontSize="7" fill="#6b7280">{y.year}</text>
          ))}
        </svg>
        <div className="flex justify-between text-[9px] text-gray-600 mt-3">
          <span>Min <span className="text-violet-400 font-mono">0.309</span> (2019)</span>
          <span>Peak <span className="text-violet-400 font-mono">0.440</span> (2020)</span>
          <span>Slope <span className="text-emerald-400 font-mono">+0.0013/yr</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="rounded-lg bg-orange-400/5 border border-orange-400/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mb-1">
          Organic &amp; Regenerative Assessment · Khargone
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Results computed from Sentinel-2 NDVI time-series (2019–2023 annual + 2024 seasonal phenology).
          Methodology mirrors the live Organic &amp; Regenerative panel. Metrics requiring lab data are flagged.
        </p>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {[
            ["Data source", "Sentinel-2 NDVI", "orange"],
            ["Season obs.",  "14 (Apr–Oct)",   "amber"],
            ["Annual years", "5 (2019–23)",    "violet"],
          ].map(([l, v, c]) => (
            <div key={l} className={`text-center rounded py-1 bg-${c}-400/5 border border-${c}-400/15`}>
              <p className={`text-[10px] font-bold text-${c}-400`}>{v}</p>
              <p className="text-[9px] text-gray-600">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 1. Crop Rotation Detection ── */}
      <Acc id="rotation" icon="🔄" title="Crop Rotation Detection"
           badge="Detected" badgeColor="green">
        <Row label="Rotation detected" value="Yes" good={true}
             sub="Annual NDVI spread 0.131 > 0.05 threshold" />
        <Row label="Years analysed" value="5 (2019–2023)" />
        <Row label="NDVI spread (max–min)" value="0.131" good={true} />
        <Row label="2020 peak NDVI" value="0.440"
             sub="Above-avg monsoon: 4,094,519 mm·ha" />
        <Row label="2019 baseline NDVI" value="0.309"
             sub="Dry year: 3,579,712 mm·ha" />
        <div className="pt-1">
          <p className="text-[9px] uppercase text-gray-600 tracking-wider mb-1">Annual NDVI trend (2019–2023)</p>
          <AnnualSparkline />
        </div>
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_ROTATION.note}</p>
      </Acc>

      {/* ── 2. Cover Crop Verification ── */}
      <Acc id="cover" icon="🌱" title="Cover Crop Verification"
           badge="Verified" badgeColor="green">
        <Row label="Off-season green cover" value="Confirmed" good={true}
             sub="April NDVI proxy (post-rabi, pre-kharif)" />
        <Row label="Off-season mean NDVI" value="0.650" good={true}
             sub="Apr-1: 0.710 · Apr-15: 0.589" />
        <Row label="Off-season obs." value="2" />
        <Row label="Growing-season mean NDVI" value="0.471"
             sub="Jun–Oct (kharif cotton)" />
        <Row label="NDVI contrast" value="0.179"
             sub="off-season − growing season" />
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_COVER.note}</p>
      </Acc>

      {/* ── 3. Compost Application Map ── */}
      <Acc id="compost" icon="🌿" title="Compost Application Map"
           badge="Not Detected" badgeColor="yellow">
        <Row label="Spring NDVI uplift" value="0.010"
             sub="Below 0.05 detection threshold" />
        <Row label="Spring mean NDVI (Apr–May)" value="0.478" />
        <Row label="Baseline mean (Jun–Oct)" value="0.468" />
        <Row label="Peak observation" value="0.710" sub="01-Apr — residual rabi crop" />
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_COMPOST.note}</p>
      </Acc>

      {/* ── 4. Soil Carbon Trend ── */}
      <Acc id="carbon" icon="🌍" title="Soil Carbon Trend"
           badge="Accumulating" badgeColor="green">
        <Row label="Multi-year trend" value="Accumulating" good={true} />
        <Row label="OLS slope" value="+0.00130 / yr"
             sub="Positive NDVI trend 2019–2023" />
        <Row label="Mean annual NDVI" value="0.363" />
        <Row label="Carbon proxy" value="~16.3 tC / ha"
             sub="NDVI × 45 (Baccini proxy)" />
        <Row label="Scene count" value="5 years" />
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_CARBON.note}</p>
      </Acc>

      {/* ── 5. Chemical-Free Verification ── */}
      <Acc id="chemfree" icon="✅" title="Chemical-Free Verification"
           badge="Contextually Clean" badgeColor="sky">
        <Row label="Algorithm verdict" value="5 dips detected"
             sub="Raw score: 0/100 — all agronomic" />
        <Row label="Contextual score" value="82 / 100" good={true}
             sub="Adjusted for natural transitions" />
        <div className="space-y-1 pt-1">
          <p className="text-[9px] uppercase text-gray-600 tracking-wider">NDVI dip events</p>
          {KH_CHEM_FREE.dips.map((d, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-300 font-mono">{d.from} → {d.date}
                  <span className="ml-1.5 text-red-400">−{d.drop}</span>
                  <span className={`ml-1.5 text-[9px] ${d.severity === "High" ? "text-red-400" : "text-yellow-400"}`}>{d.severity}</span>
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5">{d.cause}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_CHEM_FREE.note}</p>
      </Acc>

      {/* ── 6. Buffer Zone & Drift Risk ── */}
      <Acc id="buffer" icon="🛡️" title="Buffer Zone &amp; Drift Risk"
           badge="Low Risk" badgeColor="green">
        <Row label="Drift risk" value="Low" good={true}
             sub="Seasonal mean NDVI 0.471 > 0.45 threshold" />
        <Row label="Mean NDVI (buffer proxy)" value="0.471" good={true} />
        <Row label="Min NDVI" value="0.198" sub="01-Sep — cotton senescence minimum" />
        <Row label="NDVI std dev" value="0.188" sub="High seasonality, expected for cotton" />
        <Row label="Low-NDVI months (< 0.30)" value="4"
             sub="Aug–Sep natural canopy decline" />
        <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">{KH_BUFFER.note}</p>
      </Acc>

      {/* ── Agricultural Chemical Trend Indicator ── */}
      <div className="rounded-lg border border-violet-400/20 overflow-hidden">
        <div className="px-3 py-2.5 bg-violet-400/5 flex items-center gap-2">
          <span className="text-sm">📈</span>
          <span className="text-[11px] font-semibold text-gray-200 flex-1">
            Agricultural Chemical Trend Indicator
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded border bg-emerald-400/10 text-emerald-400 border-emerald-400/25 font-semibold uppercase">
            Stable
          </span>
        </div>
        <div className="px-3 py-3 bg-black/20 space-y-2">
          <p className="text-[9px] text-gray-500">
            Multi-year NDVI standard deviation as proxy for chemical stress events.
            Low consistent std = stable organic management. Spikes indicate stress anomalies.
          </p>
          <div className="space-y-1.5">
            {KH_ANNUAL.map(y => {
              const barW = Math.round((y.ndvi / 0.44) * 100);
              const stdW = Math.round((y.std / 0.073) * 100);
              return (
                <div key={y.year} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400 font-mono w-8">{y.year}</span>
                    <span className="text-violet-300 font-mono">NDVI {y.ndvi.toFixed(3)}</span>
                    <span className="text-gray-500 font-mono text-[9px]">std {y.std.toFixed(3)}</span>
                    <span className="text-gray-600 font-mono text-[9px]">{(y.precip/1e6).toFixed(1)}M mm·ha</span>
                  </div>
                  <div className="flex gap-1 h-1.5">
                    <div className="flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-400/60" style={{ width: `${barW}%` }} />
                    </div>
                    <div className="w-12 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${y.std > 0.065 ? "bg-yellow-400/70" : "bg-emerald-400/50"}`}
                        style={{ width: `${stdW}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[9px] text-gray-600 mt-1">
            <span><span className="inline-block w-2 h-1.5 rounded-full bg-violet-400/60 mr-1" />NDVI mean</span>
            <span><span className="inline-block w-2 h-1.5 rounded-full bg-emerald-400/50 mr-1" />std (low)</span>
            <span><span className="inline-block w-2 h-1.5 rounded-full bg-yellow-400/70 mr-1" />std (elevated)</span>
          </div>
          <p className="text-[9px] text-gray-500 leading-relaxed">{KH_AGCHEM_TREND.interpretation}</p>
        </div>
      </div>

      {/* ── Data provenance footer ── */}
      <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2 space-y-0.5">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">Data Provenance</p>
        <p className="text-[9px] text-gray-600">NDVI: Sentinel-2 (ESA) · 10 m · 2019–2024</p>
        <p className="text-[9px] text-gray-600">Files: phenology_data.csv · yearly_statistics.csv · area_statistics.csv</p>
        <p className="text-[9px] text-gray-600">Method: OrganicCompliancePanel deriveResult() logic applied to Khargone series</p>
        <p className="text-[9px] text-yellow-600">Soil chemistry, pesticide residues &amp; heavy metals require field sampling — not available in project data.</p>
      </div>
    </div>
  );
}

// ── 3-D farm mesh layer (Three.js + Mapbox custom layer) ────────────────────
const MESH_ORIGIN = [75.411842, 21.939043]; // farm centre lon/lat
const MESH_LAYER_ID = "khargone-3d-mesh";

function Mesh3DSection({ mapInstance }) {
  const [visible, setVisible]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const rendererRef             = useRef(null);
  const sceneRef                = useRef(null);
  const cameraRef               = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance && mapInstance.getLayer(MESH_LAYER_ID)) {
        mapInstance.removeLayer(MESH_LAYER_ID);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [mapInstance]);

  function toggle() {
    if (!mapInstance) return;

    if (visible) {
      if (mapInstance.getLayer(MESH_LAYER_ID)) mapInstance.removeLayer(MESH_LAYER_ID);
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
      sceneRef.current = null;
      setVisible(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Mercator anchor for the farm centre
    const mc = mapboxgl.MercatorCoordinate.fromLngLat(MESH_ORIGIN, 0);
    const mScale = mc.meterInMercatorCoordinateUnits();

    const scene    = new THREE.Scene();
    const camera   = new THREE.Camera();
    sceneRef.current  = scene;
    cameraRef.current = camera;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(1, 2, 1).normalize();
    scene.add(sun);

    // Load MTL → OBJ
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/khargone-mesh/");
    mtlLoader.load("Khategoan_project_simplified_3d_mesh.mtl", (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath("/khargone-mesh/");
      objLoader.load(
        "Khategoan_project_simplified_3d_mesh.obj",
        (object) => {
          // Centre the mesh on its bounding box
          const box = new THREE.Box3().setFromObject(object);
          const centre = box.getCenter(new THREE.Vector3());
          object.position.sub(centre);
          scene.add(object);

          const customLayer = {
            id: MESH_LAYER_ID,
            type: "custom",
            renderingMode: "3d",
            onAdd(_map, gl) {
              const renderer = new THREE.WebGLRenderer({
                canvas: _map.getCanvas(),
                context: gl,
                antialias: true,
              });
              renderer.autoClear = false;
              rendererRef.current = renderer;
            },
            render(_gl, matrix) {
              const renderer = rendererRef.current;
              if (!renderer) return;

              // OBJ is Z-up (X=East, Y=North, Z=Elevation) — no rotation needed.
              // scale(m, -m, m) handles the Mercator Y-south flip.
              const m = new THREE.Matrix4().fromArray(matrix);
              const l = new THREE.Matrix4()
                .makeTranslation(mc.x, mc.y, mc.z)
                .scale(new THREE.Vector3(mScale, -mScale, mScale));

              cameraRef.current.projectionMatrix = m.multiply(l);
              renderer.resetState();
              renderer.render(sceneRef.current, cameraRef.current);
              mapInstance.triggerRepaint();
            },
          };

          if (mapInstance.getLayer(MESH_LAYER_ID)) mapInstance.removeLayer(MESH_LAYER_ID);
          mapInstance.addLayer(customLayer);

          mapInstance.flyTo({
            center: MESH_ORIGIN,
            zoom: 17,
            pitch: 55,
            bearing: -20,
            duration: 1800,
            essential: true,
          });

          setVisible(true);
          setLoading(false);
        },
        undefined,
        (err) => { setError(`OBJ load failed: ${err.message}`); setLoading(false); }
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-violet-400/5 border border-violet-400/20 rounded-lg p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">3D Farm Mesh</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Photogrammetric 3-D surface mesh from drone survey (~139 m × 122 m). Textured OBJ rendered as a Mapbox custom layer.
        </p>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md border transition text-xs ${
          visible
            ? "bg-violet-400/10 border-violet-400/40 text-violet-300"
            : "border-white/10 hover:bg-white/5 text-gray-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-violet-400" />
          <span>Khategoan 3D Surface</span>
        </div>
        {loading
          ? <span className="text-[10px] text-violet-400 animate-pulse">Loading mesh…</span>
          : <span className="text-[10px]">{visible ? "Hide" : "Show"}</span>
        }
      </button>

      {visible && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1.5 text-[10px] text-gray-400">
          <p className="font-semibold text-gray-300">Mesh info</p>
          <div className="flex justify-between"><span>Vertices</span><span className="font-mono text-gray-300">96,031</span></div>
          <div className="flex justify-between"><span>Faces</span><span className="font-mono text-gray-300">191,114</span></div>
          <div className="flex justify-between"><span>Extent</span><span className="font-mono text-gray-300">~139 × 122 m</span></div>
          <div className="flex justify-between"><span>Elev. range</span><span className="font-mono text-gray-300">8.5 m</span></div>
          <div className="flex justify-between"><span>Source</span><span className="text-gray-500">Drone photogrammetry</span></div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
