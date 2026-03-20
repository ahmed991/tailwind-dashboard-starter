import { useState, useEffect, useCallback, useRef } from "react";

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
  { label: "NDVI",     key: "ndvi",     desc: "Normalized Difference Vegetation Index — crop health", min: "Low / Bare", max: "High / Dense", gradient: "from-[#d73027] via-[#fee08b] to-[#1a9850]" },
  { label: "Green",    key: "green",    desc: "Green band reflectance — canopy density",              min: "Low",        max: "High",         gradient: "from-[#f7fcf5] via-[#74c476] to-[#00441b]" },
  { label: "NIR",      key: "nir",      desc: "Near-infrared — vegetation biomass",                   min: "Low",        max: "High",         gradient: "from-[#ffffe5] via-[#fe9929] to-[#7f0000]" },
  { label: "Red Edge", key: "red_edge", desc: "Crop stress & chlorophyll content",                    min: "Low",        max: "High",         gradient: "from-[#fff7f3] via-[#fa9fb5] to-[#49006a]" },
];

export default function CaseStudyPanel({ open, onClose, item, mapInstance }) {
  const [activeLayers, setActiveLayers] = useState({});
  const [loadingLayer, setLoadingLayer] = useState(null);
  const [layerError, setLayerError] = useState(null);

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
      const res = await fetch(`http://localhost:8000/case-study/raster/${key}/info`);
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
