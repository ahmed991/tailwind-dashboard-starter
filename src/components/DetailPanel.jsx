import { useState as useLocalState, useEffect } from 'react';
import { fromUrl as geotiffFromUrl } from 'geotiff';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { API_BASE } from '../api/client';

// ── Compliance results store (localStorage) ──────────────────────────────────
const STORE_KEY = 'ffbs_compliance_results';

// storeResult now nests by indicatorKey so multiple runs per module are tracked separately:
// stored[farmName][module][indicatorKey] = { ...data, _savedAt }
function storeResult(module, farmName, indicatorKey, data) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (!existing[farmName]) existing[farmName] = {};
    if (!existing[farmName][module]) existing[farmName][module] = {};
    existing[farmName][module][indicatorKey] = { ...data, _savedAt: new Date().toISOString() };
    localStorage.setItem(STORE_KEY, JSON.stringify(existing));
  } catch {}
}

function getStoredResults(farmName) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return all[farmName] || {};
  } catch { return {}; }
}

function clearStoredResults(farmName) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    delete all[farmName];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {}
}

// Map sidebar labels (lowercased) → FastAPI RequestParams.indicator values
const labelToIndicator = {
  "soil fertility map":       "Soil Fertility Map",
  "green forest change":      "Green Forest Change",
  "forest cover change":      "Green Forest Change",   // sidebar label differs
  "main crop identification": "Main Crop Identification",
  "cotton phenology":         "Main Crop Identification",
  "evapotranspiration":       "ETa",
  // Short-code aliases kept for backwards compat
  "sfm": "Soil Fertility Map",
  "scl": "Green Forest Change",
};

const VALID_INDICATORS = new Set([
  "NDVI","NDWI","PVI","LAI","NDMI","EVI","SAVI","MSI",
  "Green Forest Change","Soil Fertility Map","Main Crop Identification","ETa",
]);

const SENSOR_META = {
  "sentinel-2":  { label: "Sentinel-2 L2A", color: "emerald", note: "Element84 STAC · 10m · optical" },
  "sentinel-1":  { label: "Sentinel-1 GRD",  color: "sky",     note: "Element84 STAC · 20m · SAR radar" },
  "sentinel-3":  { label: "Sentinel-3 OLCI", color: "cyan",    note: "CDSE OData · 300m · quicklook via CDSE auth" },
  "landsat":     { label: "Landsat C2 L2",   color: "amber",   note: "Planetary Computer · 30m · 40yr archive" },
  "copdem":      { label: "CopDEM GLO-30",   color: "slate",   note: "Element84 STAC · 30m · terrain/elevation" },
  "enmap":       { label: "EnMAP L2A",        color: "violet",  note: "DLR STAC · 30m · 224 spectral bands" },
  "planet-open": { label: "Planet SkySat",    color: "orange",  note: "Planet CC open data · SkySat scenes" },
};

// Maps Multi-Sensor Data sidebar item labels → sensor keys used by the historical viewer
const SENSOR_ITEM_MAP = {
  "Sentinel-2 (Multispectral)": "sentinel-2",
  "Sentinel-1 (SAR)":           "sentinel-1",
  "Sentinel-3 (Water/LST)":     "sentinel-3",
  "Landsat Archive":             "landsat",
  "CopDEM (30m Terrain)":       "copdem",
  "EnMAP Hyperspectral":         "enmap",
  "Planet Open Data":            "planet-open",
};

function resolveIndicator(item) {
  const mapped = labelToIndicator[item.trim().toLowerCase()];
  const resolved = mapped || item;
  return VALID_INDICATORS.has(resolved) ? resolved : null;
}

// ── Biodiversity helpers ──────────────────────────────────────────────────────
function computeMetrics(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const proportions = Object.values(counts).map(c => c / total);
  const shannon  = -proportions.reduce((s, p) => s + p * Math.log(p), 0);
  const richness = Object.keys(counts).length;
  const evenness = richness > 1 ? shannon / Math.log(richness) : 1;
  const simpson  = 1 - proportions.reduce((s, p) => s + p * p, 0);
  return { shannon: +shannon.toFixed(3), simpson: +simpson.toFixed(3), richness, evenness: +evenness.toFixed(3), total };
}

function addGeoLayer(map, sourceId, geojson, color, radius = 5) {
  if (!map) return;
  try {
    if (map.getLayer(sourceId)) map.removeLayer(sourceId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    map.addSource(sourceId, { type: "geojson", data: geojson });
    map.addLayer({ id: sourceId, type: "circle", source: sourceId,
      paint: { "circle-radius": radius, "circle-color": color, "circle-opacity": 0.75, "circle-stroke-width": 1, "circle-stroke-color": "#fff" } });
  } catch {}
}

function MetricCard({ label, value, max, color, unit = "" }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/[0.06]">
      <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold text-${color}-300`}>{value}{unit}</p>
      <div className="h-1 bg-white/10 rounded mt-1.5">
        <div className={`h-1 bg-${color}-400 rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SpeciesCard({ name, count, source, color }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5 border border-white/[0.04] hover:bg-white/8 transition-colors">
      <span className={`w-1.5 h-1.5 rounded-full bg-${color}-400 flex-shrink-0`} />
      <span className="flex-1 text-[11px] text-gray-300 truncate italic">{name}</span>
      {count > 1 && <span className={`text-[9px] px-1 py-0.5 rounded bg-${color}-500/15 text-${color}-400`}>{count}</span>}
      <span className="text-[9px] text-gray-600">{source}</span>
    </div>
  );
}

function FarmPicker({ farms, activeFarm, onPick, color = "yellow" }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Farm</h3>
      <div className="space-y-0.5">
        {Object.keys(farms).map(name => (
          <button key={name} onClick={() => onPick(name)}
            className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors ${
              activeFarm === name
                ? `bg-${color}-500/15 text-${color}-300 border border-${color}-400/20`
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
          >{name}</button>
        ))}
      </div>
    </div>
  );
}

// ── Czech Republic Pilot Panel ────────────────────────────────────────────────
const CZECH_BBOX = [12.09, 48.55, 18.87, 51.06]; // [west, south, east, north]

// Colormaps for TIF rendering
function applyColormap(norm, type) {
  // clamp
  const t = Math.max(0, Math.min(1, norm));
  if (type === "ndvi" || type === "ndre") {
    // Brown → yellow → green
    if (t < 0.3) { const s = t / 0.3; return [Math.round(165 - s*100), Math.round(42 + s*90), Math.round(42 - s*30), 220]; }
    if (t < 0.6) { const s = (t-0.3)/0.3; return [Math.round(65 + s*50), Math.round(132 - s*40), Math.round(12 + s*10), 220]; }
    const s = (t-0.6)/0.4; return [Math.round(115 - s*80), Math.round(92 + s*100), Math.round(22 - s*10), 220];
  }
  if (type === "evi") {
    // Blue → cyan → green
    if (t < 0.5) { const s = t/0.5; return [Math.round(0), Math.round(100 + s*100), Math.round(200 - s*100), 220]; }
    const s = (t-0.5)/0.5; return [Math.round(s*30), Math.round(200 - s*50), Math.round(100 - s*80), 220];
  }
  if (type === "lulc") {
    // Spectral colormap for categorical land cover
    const palettes = [
      [68,1,84],[72,40,120],[62,83,160],[49,122,183],[38,166,185],
      [53,183,121],[109,205,89],[180,222,44],[253,231,37],[252,186,3],
      [231,102,2],[186,47,0],[120,10,10],[60,5,5],[200,200,200],
    ];
    const idx = Math.floor(t * (palettes.length - 1));
    const [r,g,b] = palettes[Math.min(idx, palettes.length-1)];
    return [r, g, b, 210];
  }
  if (type === "change") {
    // Unchanged=dark, Changed=vivid orange-red
    return t > 0.5
      ? [255, Math.round(80 - t*60), Math.round(20), 230]
      : [Math.round(30 + t*40), Math.round(30 + t*40), Math.round(40 + t*40), 180];
  }
  if (type === "eucalyptus") {
    // Gray for low NDRE (non-forest), vivid green for high persistent NDRE (evergreen canopy)
    if (t < 0.35) { const s = t / 0.35; return [Math.round(80 - s*50), Math.round(80 - s*30), Math.round(80 - s*30), 160]; }
    const s = (t - 0.35) / 0.65;
    return [Math.round(30 + s*20), Math.round(130 + s*110), Math.round(30 + s*20), 230];
  }
  if (type === "deciduous") {
    // Amber/orange (senescence / low NDVI) → yellow-green → deep green (peak summer broadleaf)
    if (t < 0.3) { const s = t / 0.3; return [Math.round(180 + s*40), Math.round(80 + s*80), Math.round(10), 200]; }
    if (t < 0.6) { const s = (t-0.3)/0.3; return [Math.round(220 - s*140), Math.round(160 + s*40), Math.round(10 + s*20), 220]; }
    const s = (t-0.6)/0.4; return [Math.round(80 - s*60), Math.round(200 - s*30), Math.round(30 + s*20), 230];
  }
  // Default: grayscale
  const v = Math.round(t * 255);
  return [v, v, v, 220];
}

async function renderTifToCanvas(url, colormapType) {
  const tiff = await geotiffFromUrl(url);
  const image = await tiff.getImage();
  const data = await image.readRasters({ interleave: true });
  const width = image.getWidth();
  const height = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);

  // Extract single band (use first band)
  const band = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) band[i] = data[i * samplesPerPixel];

  // Compute min/max ignoring nodata (common nodata: 0, -9999, NaN)
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (isNaN(v) || v === -9999 || v === 0) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    const isNodata = isNaN(v) || v === -9999;
    if (isNodata) {
      imgData.data[i*4]   = 0;
      imgData.data[i*4+1] = 0;
      imgData.data[i*4+2] = 0;
      imgData.data[i*4+3] = 0;
      continue;
    }
    const norm = (v - min) / range;
    const [r, g, b, a] = applyColormap(norm, colormapType);
    imgData.data[i*4]   = r;
    imgData.data[i*4+1] = g;
    imgData.data[i*4+2] = b;
    imgData.data[i*4+3] = a;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

const CZECH_LAYERS = {
  "Pilot Overview": null,
  "Land Cover 2017": {
    tif: "/czech-study/landcover_2017.tif",
    geojson: "/czech-study/landcover_2017.geojson",
    colormap: "lulc",
    label: "Land Cover 2017",
    description: "LULC classification · Czech Republic · 2017 baseline (Sentinel-2 derived)",
  },
  "Land Cover 2024": {
    tif: "/czech-study/landcover_2024.tif",
    geojson: "/czech-study/landcover_2024.geojson",
    colormap: "lulc",
    label: "Land Cover 2024",
    description: "LULC classification · Czech Republic · 2024 current state",
  },
  "Change Detection Map": {
    tif: "/czech-study/landcover_change_map.tif",
    colormap: "change",
    label: "Land Cover Change 2017→2024",
    description: "Binary change map · red = changed pixels · dark = unchanged",
  },
  "Change by Class Chart": {
    png: "/czech-study/landcover_change_by_class.png",
    label: "Change by Class 2017–2024",
    description: "Area statistics showing gain/loss per land cover class",
    chartOnly: true,
  },
  "NDVI": {
    tif: "/czech-study/NDVI.tif",
    colormap: "ndvi",
    label: "NDVI — Czech Republic",
    description: "Normalized Difference Vegetation Index · 500m · brown→yellow→green scale",
  },
  "NDRE": {
    tif: "/czech-study/NDRE.tif",
    colormap: "ndre",
    label: "NDRE — Czech Republic",
    description: "Normalized Difference Red Edge · 500m · nitrogen stress indicator",
  },
  "EVI": {
    tif: "/czech-study/EVI.tif",
    colormap: "evi",
    label: "EVI — Czech Republic",
    description: "Enhanced Vegetation Index · 500m · blue→cyan→green scale",
  },
  "NDVI Autumn": {
    png: "/czech-study/NDVI_Autumn_Czech_Republic.png",
    label: "NDVI Autumn (Sep–Nov)",
    description: "Autumn season NDVI · shows harvest & winter crop germination",
    chartOnly: true,
  },
  "Combined View": {
    png: "/czech-study/Combined_Vegetation_Czech_Republic.png",
    label: "Combined Vegetation Indices",
    description: "Side-by-side comparison of NDVI, NDRE and EVI across Czech Republic",
    chartOnly: true,
  },
  // ── Tree Species Classification ──
  "Species Overview":        null,
  "Eucalyptus Mapping":      null,
  "Beech Tree Mapping":      null,
  "Red Edge Classification": null,
  "Seasonal NDVI Profile": {
    png: "/czech-study/NDVI_Autumn_Czech_Republic.png",
    label: "Seasonal NDVI Profile — Autumn",
    description: "Autumn NDVI shows deciduous senescence — beech signature visible as NDVI drop zones across Czech forests",
    chartOnly: true,
  },
};

// Colormap legend entries per type
const LEGENDS = {
  lulc:   [["#2d6a2d","Tree Cover"],["#74c476","Shrubland"],["#d4e157","Grassland"],["#f9a825","Cropland"],["#e53935","Built-up"],["#1565c0","Water Bodies"],["#bdbdbd","Bare/Sparse"]],
  ndvi:   [["#a52a2a","Bare/Urban"],["#c8962c","Low veg."],["#417c0c","Moderate"],["#237012","Dense veg."]],
  ndre:   [["#a52a2a","Low N"],["#c8962c","Moderate"],["#237012","High N"]],
  evi:    [["#0064c8","Water"],["#00c8c8","Sparse"],["#00c850","Moderate"],["#009632","Dense"]],
  change:      [["#1e1e28","Unchanged"],["#ff5014","Changed"]],
  eucalyptus:  [["#303030","Non-forest / Low"],["#1e7a1e","Moderate Canopy"],["#00e000","High — Eucalyptus"]],
  deciduous:   [["#c85000","Senescence / Low"],["#dcb400","Transitional"],["#28a028","Peak Broadleaf — Beech"]],
};

// ── Šumava AOI ────────────────────────────────────────────────────────────────
const SUMAVA_BBOX   = [13.15, 48.75, 13.65, 49.10];
const SUMAVA_GEOJSON = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: {
    type: "Polygon",
    coordinates: [[[13.15,48.75],[13.65,48.75],[13.65,49.10],[13.15,49.10],[13.15,48.75]]]
  }}]
};

function TreeSpeciesPanel({ item, mapInstance, Header }) {
  const [startDate, setStartDate] = useLocalState("2023-09-01");
  const [endDate,   setEndDate]   = useLocalState("2023-09-30");
  const [loading,   setLoading]   = useLocalState(false);
  const [error,     setError]     = useLocalState(null);
  const [result,    setResult]    = useLocalState(null);
  const [activeMap, setActiveMap] = useLocalState("class"); // "class" | "ndre" | "chart"

  const LABEL_MAP = {
    "Eucalyptus Mapping":      { title: "Eucalyptus Detection",  color: "emerald", focus: "eucalyptus" },
    "Beech Tree Mapping":      { title: "Beech Tree Detection",  color: "amber",   focus: "beech"      },
    "Red Edge Classification": { title: "Red Edge Index (NDRE)", color: "teal",    focus: "ndre"       },
  };
  const meta = LABEL_MAP[item] || LABEL_MAP["Eucalyptus Mapping"];

  // Fly to Šumava + draw boundary on mount
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.fitBounds([[SUMAVA_BBOX[0], SUMAVA_BBOX[1]], [SUMAVA_BBOX[2], SUMAVA_BBOX[3]]], { padding: 40, duration: 1200 });

    const SRC = "sumava-boundary-src";
    const FILL = "sumava-boundary-fill";
    const LINE = "sumava-boundary-line";

    const addBoundary = () => {
      try {
        if (!mapInstance.getSource(SRC)) {
          mapInstance.addSource(SRC, { type: "geojson", data: SUMAVA_GEOJSON });
        }
        if (!mapInstance.getLayer(FILL)) {
          mapInstance.addLayer({ id: FILL, type: "fill", source: SRC,
            paint: { "fill-color": "#2dd4bf", "fill-opacity": 0.06 } });
        }
        if (!mapInstance.getLayer(LINE)) {
          mapInstance.addLayer({ id: LINE, type: "line", source: SRC,
            paint: { "line-color": "#2dd4bf", "line-width": 1.5, "line-dasharray": [4, 3], "line-opacity": 0.7 } });
        }
      } catch {}
    };

    if (mapInstance.isStyleLoaded()) {
      addBoundary();
    } else {
      mapInstance.once("load", addBoundary);
    }

    return () => {
      try { if (mapInstance.getLayer(LINE)) mapInstance.removeLayer(LINE); } catch {}
      try { if (mapInstance.getLayer(FILL)) mapInstance.removeLayer(FILL); } catch {}
      try { if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC); } catch {}
    };
  }, [item, mapInstance]);

  // Derive which raster URL to display based on active map selection
  const rasterUrlMap = result ? {
    eucalyptus: result.eucalyptus_map_url,
    beech:      result.beech_map_url,
    ndre:       result.ndre_map_url,
    class:      result.class_map_url,
    chart:      result.chart_url,
  } : {};

  // Render raw NDRE TIF onto Mapbox using renderTifToCanvas (same as other indicators)
  useEffect(() => {
    if (!mapInstance || !result) return;
    const SRC = "ts-raster-src";
    const LYR = "ts-raster-lyr";
    const remove = () => {
      try { if (mapInstance.getLayer(LYR)) mapInstance.removeLayer(LYR); } catch {}
      try { if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC); } catch {}
    };
    remove();

    const tifUrl = `${API_BASE}/raster/ts_ndre_${result._ts}/tif`;
    const colormap = meta.focus === "beech" ? "deciduous" : "eucalyptus";
    const [w, s, e, n] = SUMAVA_BBOX;

    renderTifToCanvas(tifUrl, colormap)
      .then(dataUrl => {
        mapInstance.addSource(SRC, {
          type: "image", url: dataUrl,
          coordinates: [[w, n], [e, n], [e, s], [w, s]],
        });
        mapInstance.addLayer({ id: LYR, type: "raster", source: SRC, paint: { "raster-opacity": 0.88 } });
      })
      .catch(() => {});

    return remove;
  }, [result, mapInstance]);

  async function runDetection() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/fastapi/tree-species/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geojson: SUMAVA_GEOJSON, start_date: startDate, end_date: endDate, cloud_cover: 20 }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
      const data = await res.json();
      setResult(data);
      setActiveMap(meta.focus);  // eucalyptus | beech | ndre depending on item
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const descMap = {
    "Eucalyptus Mapping":      "Live Sentinel-2A detection using NDRE ≥ 0.28 as evergreen canopy proxy · Šumava, Czech Republic",
    "Beech Tree Mapping":      "Live Sentinel-2A detection using NDRE 0.10–0.18 deciduous signature · Šumava, Czech Republic",
    "Red Edge Classification": "Live NDRE map from Sentinel-2A B5/B8A · Šumava forest region, Czech Republic",
  };

  return (
    <div className="space-y-3">
      <Header label={meta.title} description={descMap[item]} />

      {/* AOI info */}
      <div className="rounded-lg bg-teal-900/10 border border-teal-400/15 p-2.5">
        <p className="text-teal-300 text-[11px] font-semibold">Šumava / Bohemian Forest</p>
        <p className="text-gray-500 text-[10px] mt-0.5">49°N, 13°E · 220,000 ha · Czech Republic · Mixed beech-spruce forest</p>
      </div>

      {/* Date pickers */}
      <div className="grid grid-cols-2 gap-2">
        {[["Start Date", startDate, setStartDate], ["End Date", endDate, setEndDate]].map(([label, val, set]) => (
          <div key={label}>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <input type="date" value={val} onChange={e => set(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-teal-400" />
          </div>
        ))}
      </div>

      {/* Run button */}
      <button onClick={runDetection} disabled={loading}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          loading ? "bg-gray-700 text-gray-400" : "bg-teal-500 hover:bg-teal-400 text-gray-900"
        }`}>
        {loading ? "Running Sentinel-2A Analysis…" : "Run Species Detection on Šumava"}
      </button>

      {error && <p className="text-red-400 text-[11px] bg-red-400/10 border border-red-400/20 rounded-lg p-2">{error}</p>}

      {result && (
        <div className="space-y-3">
          {/* Summary KPIs */}
          <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-2">
              Detection Results · {result.scene_count} scene{result.scene_count !== 1 ? "s" : ""} · {startDate} → {endDate}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="col-span-2 text-center p-2 rounded-lg bg-teal-400/5 border border-teal-400/10">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Dominant Species</p>
                <p className="text-teal-300 text-[13px] font-bold mt-0.5">{result.summary.dominant_species}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                ["NDRE Mean", result.summary.avg_ndre, "teal"],
                ["Eucalyptus", `${result.summary.pct_eucalyptus}%`, "emerald"],
                ["Beech", `${result.summary.pct_beech}%`, "amber"],
                ["Transitional", `${result.summary.pct_transitional}%`, "gray"],
                ["Eucalyptus ha", result.summary.eucalyptus_ha?.toLocaleString(), "emerald"],
                ["Beech ha", result.summary.beech_ha?.toLocaleString(), "amber"],
              ].map(([l, v, c]) => (
                <div key={l} className={`text-center p-1.5 rounded bg-${c}-400/5 border border-${c}-400/10`}>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-tight">{l}</p>
                  <p className={`text-[11px] font-bold text-${c}-300 mt-0.5`}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Raster viewer */}
          <div>
            <div className="flex gap-1.5 mb-2">
              {[
                [meta.focus, "Classified Raster"],
                ["class",    "All Species"],
                ["ndre",     "NDRE Map"],
                ["chart",    "Monthly Chart"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setActiveMap(k)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors border ${
                    activeMap === k
                      ? "bg-teal-500/20 border-teal-400/40 text-teal-300"
                      : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300"
                  }`}>{label}</button>
              ))}
            </div>
            {rasterUrlMap[activeMap] && (
              <img
                src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(rasterUrlMap[activeMap])}`}
                alt={activeMap}
                className="w-full rounded-lg border border-white/[0.06]"
              />
            )}
          </div>

          {/* Per-scene table */}
          {result.scenes?.length > 0 && (
            <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2">
              <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-1.5">Monthly Composite Breakdown</p>
              <div className="space-y-1">
                {result.scenes.map(s => (
                  <div key={s.date} className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-gray-500 w-20 flex-shrink-0">{s.date}</span>
                    <span className="text-teal-300 w-14">NDRE {s.mean_ndre}</span>
                    <span className="text-emerald-400 w-12">{s.pct_eucalyptus}% Eu</span>
                    <span className="text-amber-400">{s.pct_beech}% Bch</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CzechPilotPanel({ item, mapInstance }) {
  const [tifLoading, setTifLoading]   = useLocalState(false);
  const [tifOnMap,   setTifOnMap]     = useLocalState(false);
  const [geojsonOn,  setGeojsonOn]    = useLocalState(false);
  const [error,      setError]        = useLocalState(null);
  const layerData = CZECH_LAYERS[item];

  // Fly to Czech Republic on item change
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.fitBounds([[CZECH_BBOX[0], CZECH_BBOX[1]], [CZECH_BBOX[2], CZECH_BBOX[3]]], { padding: 50, duration: 1200 });
    setTifOnMap(false);
    setGeojsonOn(false);
    setError(null);
  }, [item, mapInstance]);

  // Load Czech boundary when Pilot Overview is active
  useEffect(() => {
    if (!mapInstance) return;
    const SRC = "czech-boundary-src";
    const LYR = "czech-boundary-lyr";
    const LYR_FILL = "czech-boundary-fill";

    const removeBoundary = () => {
      try { if (mapInstance.getLayer(LYR))      mapInstance.removeLayer(LYR);      } catch {}
      try { if (mapInstance.getLayer(LYR_FILL)) mapInstance.removeLayer(LYR_FILL); } catch {}
      try { if (mapInstance.getSource(SRC))     mapInstance.removeSource(SRC);     } catch {}
    };

    if (item !== "Pilot Overview") { removeBoundary(); return; }

    fetch("/czech-study/czech_boundary.geojson")
      .then(r => r.json())
      .then(geojson => {
        if (!mapInstance.getSource(SRC)) {
          mapInstance.addSource(SRC, { type: "geojson", data: geojson });
          mapInstance.addLayer({ id: LYR_FILL, type: "fill",   source: SRC, paint: { "fill-color": "#2dd4bf", "fill-opacity": 0.06 } });
          mapInstance.addLayer({ id: LYR,      type: "line",   source: SRC, paint: { "line-color": "#2dd4bf", "line-width": 1.8, "line-dasharray": [3, 2] } });
        }
      })
      .catch(() => {});

    return removeBoundary;
  }, [item, mapInstance]);

  const tifLayerId    = `czech-tif-${item.replace(/\s+/g,"-").toLowerCase()}`;
  const geojsonLayerId = `czech-geo-${item.replace(/\s+/g,"-").toLowerCase()}`;
  const mapCoords = [
    [CZECH_BBOX[0], CZECH_BBOX[3]], [CZECH_BBOX[2], CZECH_BBOX[3]],
    [CZECH_BBOX[2], CZECH_BBOX[1]], [CZECH_BBOX[0], CZECH_BBOX[1]],
  ];

  async function toggleTif() {
    if (!mapInstance || !layerData?.tif) return;
    if (tifOnMap) {
      if (mapInstance.getLayer(tifLayerId)) { mapInstance.removeLayer(tifLayerId); mapInstance.removeSource(tifLayerId); }
      setTifOnMap(false);
      return;
    }
    setTifLoading(true);
    setError(null);
    try {
      const dataUrl = await renderTifToCanvas(layerData.tif, layerData.colormap);
      if (mapInstance.getLayer(tifLayerId)) { mapInstance.removeLayer(tifLayerId); mapInstance.removeSource(tifLayerId); }
      mapInstance.addSource(tifLayerId, { type: "image", url: dataUrl, coordinates: mapCoords });
      mapInstance.addLayer({ id: tifLayerId, type: "raster", source: tifLayerId, paint: { "raster-opacity": 0.85 } });
      setTifOnMap(true);
    } catch (e) {
      setError("Failed to load TIF: " + e.message);
    } finally {
      setTifLoading(false);
    }
  }

  function toggleGeojson() {
    if (!mapInstance || !layerData?.geojson) return;
    if (geojsonOn) {
      if (mapInstance.getLayer(geojsonLayerId + "-outline")) mapInstance.removeLayer(geojsonLayerId + "-outline");
      if (mapInstance.getLayer(geojsonLayerId)) mapInstance.removeLayer(geojsonLayerId);
      if (mapInstance.getSource(geojsonLayerId)) mapInstance.removeSource(geojsonLayerId);
      setGeojsonOn(false);
      return;
    }
    fetch(layerData.geojson).then(r => r.json()).then(data => {
      if (mapInstance.getLayer(geojsonLayerId)) { mapInstance.removeLayer(geojsonLayerId); mapInstance.removeSource(geojsonLayerId); }
      mapInstance.addSource(geojsonLayerId, { type: "geojson", data });
      // ESA WorldCover class codes → colors
      const lulcColor = [
        "match", ["get", "class"],
        10, "#2d6a2d",   // Tree cover
        20, "#74c476",   // Shrubland
        30, "#d4e157",   // Grassland
        40, "#f9a825",   // Cropland
        50, "#e53935",   // Built-up
        60, "#bdbdbd",   // Bare/sparse vegetation
        70, "#ffffff",   // Snow and ice
        80, "#1565c0",   // Permanent water bodies
        90, "#4dd0e1",   // Herbaceous wetland
        95, "#1b5e20",   // Mangroves
        "#888888",       // default
      ];
      mapInstance.addLayer({ id: geojsonLayerId, type: "fill", source: geojsonLayerId,
        paint: { "fill-color": lulcColor, "fill-opacity": 0.65, "fill-outline-color": "rgba(255,255,255,0.15)" } });
      mapInstance.addLayer({ id: geojsonLayerId + "-outline", type: "line", source: geojsonLayerId,
        paint: { "line-color": "rgba(255,255,255,0.25)", "line-width": 0.5 } });
      setGeojsonOn(true);
    }).catch(e => setError("GeoJSON error: " + e.message));
  }

  // ── Shared header style ──
  const Header = ({ label, description }) => (
    <div className="rounded-xl overflow-hidden mb-3">
      <div className="bg-gradient-to-br from-[#0f1f1a] via-[#0c1c28] to-[#131727] p-3 border border-teal-400/15">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Pilot 2 · Czech Republic</span>
        </div>
        <p className="text-white text-[12px] font-semibold leading-tight">{label}</p>
        <p className="text-cyan-200/60 text-[10px] mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );

  if (item === "Pilot Overview") {
    return (
      <div className="space-y-3">
        <Header label="Czech Republic — Land Cover & Vegetation Study" description="Multi-temporal EO analysis covering LULC change detection and vegetation health across the Czech Republic (2017–2024)." />
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Study Area", value: "Czech Republic" },
            { label: "Period", value: "2017 – 2024" },
            { label: "Resolution", value: "10 – 500 m" },
            { label: "Datasets", value: "LULC · NDVI · NDRE · EVI" },
          ].map(({ label, value }) => (
            <div key={label} className="p-2 rounded-lg bg-white/[0.04] border border-teal-400/10">
              <p className="text-cyan-400/60 text-[9px] uppercase tracking-wider">{label}</p>
              <p className="text-gray-100 text-[11px] font-semibold mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-teal-400/60 mb-2">Land Cover Summary (2017–2024)</p>
          {[
            { cls: "Tree Cover",   ha2017: "5,526,571", ha2024: "5,434,160", chg: "-1.7%",  neg: true },
            { cls: "Cropland",     ha2017: "4,847,914", ha2024: "4,420,605", chg: "-8.8%",  neg: true },
            { cls: "Grassland",    ha2017: "1,682,351", ha2024: "2,219,557", chg: "+31.9%", neg: false },
            { cls: "Water Bodies", ha2017: "42,123",    ha2024: "34,098",    chg: "-19.1%", neg: true },
            { cls: "Built-up",     ha2017: "87,567",    ha2024: "83,206",    chg: "-5.0%",  neg: true },
            { cls: "Bare/Sparse",  ha2017: "775",       ha2024: "1,500",     chg: "+93.5%", neg: false },
          ].map(({ cls, ha2017, ha2024, chg, neg }) => (
            <div key={cls} className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-400 flex-1 truncate">{cls}</span>
              <span className="text-gray-500 w-16 text-right">{ha2017} ha</span>
              <span className="text-gray-500 w-16 text-right">{ha2024} ha</span>
              <span className={`w-12 text-right font-semibold ${neg ? "text-red-400" : "text-emerald-400"}`}>{chg}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-[9px] text-gray-600 mt-0.5">
            <span className="flex-1" />
            <span className="w-16 text-right">2017</span>
            <span className="w-16 text-right">2024</span>
            <span className="w-12 text-right">Δ%</span>
          </div>
        </div>
        <p className="text-teal-300/30 text-[10px] px-1">Select a layer from the sidebar to explore maps.</p>
      </div>
    );
  }

  if (item === "Species Overview") {
    return (
      <div className="space-y-3">
        <Header label="Tree Species Classification — Czech Republic" description="Eucalyptus vs. Beech detection using Sentinel-2 Red Edge bands and temporal NDVI signatures." />
        <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5 space-y-2">
          <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-1">Spectral Detection Method</p>
          {[
            { band: "B5 / B8A (NDRE)", species: "Eucalyptus", signal: "Persistent high NDRE year-round (evergreen)", color: "emerald" },
            { band: "NDVI Temporal Stack", species: "Beech",  signal: "Strong autumn drop → spring recovery (deciduous)", color: "amber" },
            { band: "Red Edge Ratio B7/B5", species: "Both",  signal: "Chlorophyll index separates canopy types", color: "teal" },
            { band: "SWIR B11",            species: "Eucalyptus", signal: "Lower SWIR reflectance (high leaf water content)", color: "cyan" },
          ].map(({ band, species, signal, color }) => (
            <div key={band} className={`p-2 rounded bg-${color}-400/5 border border-${color}-400/15`}>
              <div className="flex justify-between items-center mb-0.5">
                <span className={`text-[9px] font-bold text-${color}-400 uppercase tracking-wider`}>{band}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full bg-${color}-400/10 text-${color}-300`}>{species}</span>
              </div>
              <p className="text-gray-400 text-[10px]">{signal}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Target Species",   value: "Eucalyptus · Beech" },
            { label: "Key Bands",        value: "B5, B7, B8A, B11" },
            { label: "Method",           value: "NDRE + Temporal NDVI" },
            { label: "Confidence",       value: "POC · Proxy-based" },
          ].map(({ label, value }) => (
            <div key={label} className="p-2 rounded-lg bg-white/[0.04] border border-teal-400/10">
              <p className="text-cyan-400/60 text-[9px] uppercase tracking-wider">{label}</p>
              <p className="text-gray-100 text-[11px] font-semibold mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-emerald-900/10 border border-emerald-400/15 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-emerald-400/60 mb-1.5">Eucalyptus Signature</p>
          <p className="text-gray-300 text-[10px] leading-relaxed">Evergreen · NDRE stays above 0.25 year-round · Low seasonal variation · High B8A NIR reflectance · Lower B11 SWIR due to high leaf water content.</p>
        </div>
        <div className="rounded-lg bg-amber-900/10 border border-amber-400/15 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-amber-400/60 mb-1.5">Beech Tree Signature</p>
          <p className="text-gray-300 text-[10px] leading-relaxed">Deciduous · NDVI peaks in Jun–Jul (~0.7–0.8) and drops sharply in Oct–Nov (~0.2–0.3) · Strong autumn senescence visible in temporal stack · High seasonal NDRE amplitude.</p>
        </div>
        <p className="text-teal-300/30 text-[10px] px-1">Select a detection layer from the sidebar to visualise species probability maps.</p>
      </div>
    );
  }

  // ── Live Tree Species Detection (Eucalyptus, Beech, Red Edge) ────────────
  const TREE_SPECIES_ITEMS = ["Eucalyptus Mapping", "Beech Tree Mapping", "Red Edge Classification"];
  if (TREE_SPECIES_ITEMS.includes(item)) {
    return <TreeSpeciesPanel item={item} mapInstance={mapInstance} Header={Header} />;
  }

  if (!layerData) return null;

  const legend = LEGENDS[layerData.colormap];

  return (
    <div className="space-y-3">
      <Header label={layerData.label} description={layerData.description} />

      {/* Item-specific stats */}
      {item === "Land Cover 2017" && (
        <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-2">Area by Land Cover Class · 2017</p>
          {[["Tree Cover","5,526,571"],["Cropland","4,847,914"],["Grassland","1,682,351"],["Built-up","87,567"],["Water Bodies","42,123"],["Bare/Sparse","775"]].map(([cls, ha]) => (
            <div key={cls} className="flex justify-between text-[10px] py-0.5 border-b border-white/[0.04]">
              <span className="text-gray-400">{cls}</span>
              <span className="text-gray-300 font-medium">{ha} ha</span>
            </div>
          ))}
        </div>
      )}
      {item === "Land Cover 2024" && (
        <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-2">Area by Land Cover Class · 2024</p>
          {[["Tree Cover","5,434,160"],["Cropland","4,420,605"],["Grassland","2,219,557"],["Built-up","83,206"],["Water Bodies","34,098"],["Bare/Sparse","1,500"]].map(([cls, ha]) => (
            <div key={cls} className="flex justify-between text-[10px] py-0.5 border-b border-white/[0.04]">
              <span className="text-gray-400">{cls}</span>
              <span className="text-gray-300 font-medium">{ha} ha</span>
            </div>
          ))}
        </div>
      )}
      {item === "Change Detection Map" && (
        <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-2">Change by Class · 2017 → 2024</p>
          {[
            ["Grassland",    "+537,206 ha", "+31.9%", false],
            ["Bare/Sparse",  "+725 ha",     "+93.5%", false],
            ["Cropland",     "-427,309 ha", "-8.8%",  true],
            ["Tree Cover",   "-92,411 ha",  "-1.7%",  true],
            ["Built-up",     "-4,361 ha",   "-5.0%",  true],
            ["Water Bodies", "-8,025 ha",   "-19.1%", true],
          ].map(([cls, delta, pct, neg]) => (
            <div key={cls} className="flex items-center gap-1 text-[10px] py-0.5 border-b border-white/[0.04]">
              <span className="text-gray-400 flex-1">{cls}</span>
              <span className={`font-medium ${neg ? "text-red-400" : "text-emerald-400"}`}>{delta}</span>
              <span className={`ml-2 text-[9px] ${neg ? "text-red-500" : "text-emerald-500"}`}>{pct}</span>
            </div>
          ))}
        </div>
      )}
      {(item === "NDVI" || item === "NDRE" || item === "EVI") && (
        <div className="rounded-lg bg-white/[0.03] border border-teal-400/10 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-teal-400/50 mb-2">Summary Statistics · Czech Republic · Jan–Feb 2023</p>
          {[
            { idx: "NDVI", mean: "0.379", min: "0.157", max: "0.754", std: "0.136" },
            { idx: "NDRE", mean: "0.255", min: "0.110", max: "0.504", std: "0.090" },
            { idx: "EVI",  mean: "0.816", min: "-9.19",  max: "20.24",  std: "5.37" },
          ].filter(r => r.idx === item).map(r => (
            <div key={r.idx} className="grid grid-cols-4 gap-1 mt-1">
              {[["Mean", r.mean, "teal"], ["Min", r.min, "gray"], ["Max", r.max, "gray"], ["Std", r.std, "gray"]].map(([lbl, val, col]) => (
                <div key={lbl} className={`text-center p-1.5 rounded bg-${col}-400/5 border border-${col}-400/10`}>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider">{lbl}</p>
                  <p className={`text-[11px] font-bold text-${col}-300`}>{val}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Chart-only: show PNG */}
      {layerData.chartOnly && layerData.png && (
        <div className="rounded-lg overflow-hidden border border-cyan-500/15">
          <img src={layerData.png} alt={layerData.label} className="w-full object-contain bg-[#050e14]" />
        </div>
      )}

      {/* TIF layer: legend + map button */}
      {!layerData.chartOnly && layerData.tif && (
        <>
          {legend && (
            <div className="rounded-lg bg-[#050e14] border border-cyan-500/15 p-2.5">
              <p className="text-[9px] uppercase tracking-widest text-cyan-400/60 mb-2">Colormap Legend</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {legend.map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={toggleTif}
            disabled={tifLoading}
            className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold transition-all border ${
              tifOnMap
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : tifLoading
                ? "bg-[#0a4a5c]/40 border-cyan-500/20 text-cyan-400/60 cursor-wait"
                : "bg-gradient-to-r from-[#0d3d2e]/80 to-[#0a4a5c]/80 border-cyan-500/25 text-cyan-300 hover:border-cyan-400/50 hover:text-white"
            }`}
          >
            {tifLoading ? "Rendering GeoTIFF…" : tifOnMap ? "Remove TIF Layer" : "Add GeoTIFF to Map"}
          </button>

          {layerData.geojson && (
            <button
              onClick={toggleGeojson}
              className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold transition-all border ${
                geojsonOn
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-[#0d3d2e]/40 border-emerald-500/20 text-emerald-400/70 hover:border-emerald-400/50 hover:text-emerald-200"
              }`}
            >
              {geojsonOn ? "Remove GeoJSON Layer" : "Add GeoJSON Layer"}
            </button>
          )}
        </>
      )}

      {error && (
        <p className="text-red-400 text-[10px] bg-red-400/10 rounded p-2 border border-red-400/20">{error}</p>
      )}
    </div>
  );
}

// ── Carbon & GHG In-Development Panel ────────────────────────────────────────
const CARBON_DEV_INFO = {
  "CO2 Capture Data": {
    color: "pink",
    description: "Integrates satellite-derived vegetation carbon uptake estimates with atmospheric CO₂ concentration data (Sentinel-5P XCO₂, OCO-2) to model net ecosystem carbon capture at farm and regional scales.",
    timeline: "Q3 2025",
    methodology: "GPP × APAR (Monteith model) + Sentinel-5P XCO₂ assimilation",
    dataSources: ["Sentinel-5P (TROPOMI XCO₂)","OCO-2/OCO-3 (NASA)","MODIS GPP (MOD17A2)","FLUXNET ground stations"],
  },
  "Carbon Stock Modeling": {
    color: "pink",
    description: "Estimates above-ground biomass carbon stocks using GEDI LiDAR canopy height, Sentinel-1 backscatter, and allometric equations. Produces spatially explicit maps of carbon density (Mg C/ha).",
    timeline: "Q3 2025",
    methodology: "GEDI Level-2 + S1 SAR backscatter → AGB allometry → SOC Tier 2",
    dataSources: ["NASA GEDI (Level-2A/2B)","Sentinel-1 C-band SAR","ESA CCI Biomass map","Global Forest Watch AGB"],
  },
  "Carbon MRV Output": {
    color: "pink",
    description: "Generates Measurement, Reporting, and Verification (MRV) reports conforming to VCS/Gold Standard methodologies. Combines satellite monitoring with field survey data for credible carbon accounting.",
    timeline: "Q4 2025",
    methodology: "ISO 14064 / VCS VM0042 / Gold Standard Land Use & Forest",
    dataSources: ["All above carbon layers","Field SOC measurements","Compliance store (local)","FAO FAOSTAT emission factors"],
  },
  "Carbon Credit Mgmt.": {
    color: "pink",
    description: "Tracks the full lifecycle of carbon credits from project registration through issuance, retirement, and resale. Integrates with leading registries (Verra, Gold Standard, CAR) for automated credit management.",
    timeline: "Q1 2026",
    methodology: "Registry API integration + blockchain-based credit provenance",
    dataSources: ["Verra Registry API","Gold Standard Impact Registry","Climate Action Reserve","Chicago Climate Exchange data"],
  },
};

function CarbonDevPanel({ item }) {
  const info = CARBON_DEV_INFO[item];
  if (!info) return null;
  const col = info.color;
  return (
    <div className="space-y-3 mt-2">
      <div className="rounded-xl overflow-hidden">
        <div className={`bg-gradient-to-br from-[#1a0010] to-[#180012] p-3 border border-${col}-400/15`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full bg-${col}-400 flex-shrink-0`} />
            <span className={`text-[9px] font-bold uppercase tracking-widest text-${col}-400`}>Carbon & GHG · In Development</span>
            <span className={`ml-auto text-[8px] px-2 py-0.5 rounded-full bg-${col}-400/10 border border-${col}-400/20 text-${col}-400`}>🚧 {info.timeline}</span>
          </div>
          <p className="text-white text-[12px] font-semibold leading-tight">{item}</p>
          <p className={`text-${col}-200/50 text-[10px] mt-1 leading-relaxed`}>{info.description}</p>
        </div>
      </div>
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
        <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Methodology</p>
        <p className="text-[10px] text-gray-300 leading-relaxed">{info.methodology}</p>
      </div>
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
        <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2">Planned Data Sources</p>
        {info.dataSources.map(src => (
          <div key={src} className="flex items-center gap-2 py-0.5">
            <span className={`w-1 h-1 rounded-full bg-${col}-400/60 flex-shrink-0`} />
            <span className="text-[10px] text-gray-400">{src}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BiodiversityPanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect, mapInstance }) {
  const EMPTY_SRC = { species: [], counts: {}, geojson: null, loading: false, loaded: false };

  const [activeFarm,    setActiveFarm]    = useLocalState(selectedFarm || null);
  const [gbif,          setGbif]          = useLocalState({ ...EMPTY_SRC });
  const [inat,          setInat]          = useLocalState({ ...EMPTY_SRC });
  const [ebird,         setEbird]         = useLocalState({ species: [], loading: false, loaded: false });
  const [hotspots,      setHotspots]      = useLocalState({ list: [], loading: false, loaded: false });
  const [metrics,       setMetrics]       = useLocalState(null);
  const [layerVis,      setLayerVis]      = useLocalState({ gbif: true, inat: true, ebird: true, hotspot: true });

  // Sync farm + reset data on farm change
  useEffect(() => {
    if (selectedFarm && selectedFarm !== activeFarm) {
      setActiveFarm(selectedFarm);
      setGbif({ ...EMPTY_SRC });
      setInat({ ...EMPTY_SRC });
      setEbird({ species: [], loading: false, loaded: false });
      setHotspots({ list: [], loading: false, loaded: false });
      setMetrics(null);
    }
  }, [selectedFarm]); // eslint-disable-line

  // Recompute combined metrics when GBIF or iNat data loads
  useEffect(() => {
    const combined = { ...gbif.counts, ...inat.counts };
    setMetrics(Object.keys(combined).length ? computeMetrics(combined) : null);
  }, [gbif.loaded, inat.loaded]); // eslint-disable-line

  const pickFarm = (name) => {
    onFarmSelect(name);
    setSelectedFarm(name);
    setActiveFarm(name);
    setGbif({ ...EMPTY_SRC });
    setInat({ ...EMPTY_SRC });
    setEbird({ species: [], loading: false, loaded: false });
    setHotspots({ list: [], loading: false, loaded: false });
    setMetrics(null);
  };

  const toggleLayer = (id, layerKey) => {
    if (!mapInstance) return;
    try {
      const cur = mapInstance.getLayoutProperty(id, "visibility");
      const next = cur === "visible" ? "none" : "visible";
      mapInstance.setLayoutProperty(id, "visibility", next);
      setLayerVis(v => ({ ...v, [layerKey]: next === "visible" }));
    } catch {}
  };

  const fetchGBIF = async () => {
    if (!activeFarm) return;
    setGbif(s => ({ ...s, loading: true }));
    try {
      const farm = farms[activeFarm];
      const res  = await fetch(`${API_BASE}/api/gbif/species`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geometry: farm.wkt }) });
      const data = await res.json();
      const species = data?.species || [];
      const counts  = (data?.geojson?.features || []).reduce((acc, f) => {
        const n = f.properties?.name; if (n) acc[n] = (acc[n] || 0) + 1; return acc;
      }, {});
      setGbif({ species, counts, geojson: data.geojson, loading: false, loaded: true });
      if (data.geojson) addGeoLayer(mapInstance, "gbif-species-layer", data.geojson, "#22c55e");
    } catch { setGbif(s => ({ ...s, loading: false })); }
  };

  const fetchINat = async () => {
    if (!activeFarm) return;
    setInat(s => ({ ...s, loading: true }));
    try {
      const farm = farms[activeFarm];
      const res  = await fetch(`${API_BASE}/api/inaturalist/species`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geometry: farm.wkt }) });
      const data = await res.json();
      const species = data?.species || [];
      const counts  = (data?.geojson?.features || []).reduce((acc, f) => {
        const n = f.properties?.name; if (n) acc[n] = (acc[n] || 0) + 1; return acc;
      }, {});
      setInat({ species, counts, geojson: data.geojson, loading: false, loaded: true });
      if (data.geojson) addGeoLayer(mapInstance, "inat-species-layer", data.geojson, "#06b6d4");
    } catch { setInat(s => ({ ...s, loading: false })); }
  };

  const fetchEBird = async () => {
    if (!activeFarm) return;
    setEbird(s => ({ ...s, loading: true }));
    try {
      const farm   = farms[activeFarm];
      const center = farm.center || [0, 0];
      const res    = await fetch(`${API_BASE}/api/ebird/species`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: center[1], lng: center[0] }) });
      const data   = await res.json();
      const species = data?.speciesList || [];
      setEbird({ species, loading: false, loaded: true });
      if (data.geojson) addGeoLayer(mapInstance, "ebird-species-layer", data.geojson, "#f472b6", 4);
    } catch { setEbird(s => ({ ...s, loading: false })); }
  };

  const fetchHotspots = async () => {
    if (!activeFarm) return;
    setHotspots(s => ({ ...s, loading: true }));
    try {
      const farm   = farms[activeFarm];
      const center = farm.center || [0, 0];
      const res    = await fetch(`${API_BASE}/api/ebird/hotspots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: center[1], lng: center[0] }) });
      const data   = await res.json();
      const list   = (data?.geojson?.features || []).map(f => ({
        id: f.properties.id, name: f.properties.name,
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      }));
      setHotspots({ list, loading: false, loaded: true });
      if (data.geojson) {
        try {
          if (mapInstance?.getLayer("ebird-hotspots-layer")) mapInstance.removeLayer("ebird-hotspots-layer");
          if (mapInstance?.getSource("ebird-hotspots"))      mapInstance.removeSource("ebird-hotspots");
          mapInstance?.addSource("ebird-hotspots", { type: "geojson", data: data.geojson });
          mapInstance?.addLayer({ id: "ebird-hotspots-layer", type: "heatmap", source: "ebird-hotspots",
            paint: { "heatmap-intensity": 1.5, "heatmap-color": ["interpolate",["linear"],["heatmap-density"],0,"rgba(0,0,0,0)",1,"#f59e0b"], "heatmap-radius": 20, "heatmap-opacity": 0.7 } });
        } catch {}
      }
    } catch { setHotspots(s => ({ ...s, loading: false })); }
  };

  const FetchBtn = ({ onClick, loading, loaded, label, color = "yellow" }) => (
    <button onClick={onClick} disabled={loading || !activeFarm}
      className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
        loaded
          ? `bg-${color}-500/10 border border-${color}-400/20 text-${color}-400`
          : `bg-${color}-500/20 border border-${color}-400/30 text-${color}-300 hover:bg-${color}-500/30`
      }`}
    >
      {loading ? "Loading…" : loaded ? `✓ ${label} (refresh)` : label}
    </button>
  );

  const LayerToggle = ({ label, visible, onToggle, color }) => (
    <button onClick={onToggle}
      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
        visible ? `bg-${color}-500/20 border border-${color}-400/30 text-${color}-300` : "bg-white/5 border border-white/10 text-gray-500"
      }`}
    >
      {visible ? "◉" : "○"} {label}
    </button>
  );

  // ── Species Observation Log ──────────────────────────────────────────────
  if (item === "Species Observation Log") {
    const allSpecies = [
      ...Object.entries(gbif.counts).map(([n, c]) => ({ name: n, count: c, source: "GBIF",  color: "emerald" })),
      ...Object.entries(inat.counts).map(([n, c]) => ({ name: n, count: c, source: "iNat",  color: "cyan" })),
    ].sort((a, b) => b.count - a.count);

    return (
      <div className="space-y-4">
        <FarmPicker farms={farms} activeFarm={activeFarm} onPick={pickFarm} />

        {/* Fetch buttons */}
        <div className="flex gap-2">
          <FetchBtn onClick={fetchGBIF} loading={gbif.loading} loaded={gbif.loaded} label="GBIF" color="emerald" />
          <FetchBtn onClick={fetchINat} loading={inat.loading} loaded={inat.loaded} label="iNaturalist" color="cyan" />
        </div>

        {/* Layer toggles */}
        {(gbif.loaded || inat.loaded) && (
          <div className="flex flex-wrap gap-1.5">
            {gbif.loaded  && <LayerToggle label="GBIF"  visible={layerVis.gbif}  onToggle={() => toggleLayer("gbif-species-layer", "gbif")}  color="emerald" />}
            {inat.loaded  && <LayerToggle label="iNat"  visible={layerVis.inat}  onToggle={() => toggleLayer("inat-species-layer", "inat")}  color="cyan" />}
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Diversity Metrics</h3>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Species Richness" value={metrics.richness} max={Math.max(metrics.richness, 50)} color="yellow" />
              <MetricCard label="Shannon Index" value={metrics.shannon} max={5} color="emerald" unit=" H′" />
              <MetricCard label="Simpson Index" value={metrics.simpson} max={1} color="cyan" />
              <MetricCard label="Evenness" value={metrics.evenness} max={1} color="violet" />
            </div>
            <p className="text-[9px] text-gray-600 mt-1">{metrics.total} total observations · {metrics.richness} unique species</p>
          </div>
        )}

        {/* Species list */}
        {allSpecies.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Species ({allSpecies.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {allSpecies.map((s, i) => <SpeciesCard key={i} {...s} />)}
            </div>
          </div>
        )}

        {!gbif.loaded && !inat.loaded && (
          <p className="text-[11px] text-gray-600 italic text-center py-4">
            {activeFarm ? "Fetch GBIF or iNaturalist data above." : "Select a farm to begin."}
          </p>
        )}
      </div>
    );
  }

  // ── Bird Species Data ────────────────────────────────────────────────────
  if (item === "Bird Species Data") {
    return (
      <div className="space-y-4">
        <FarmPicker farms={farms} activeFarm={activeFarm} onPick={pickFarm} color="pink" />

        <FetchBtn onClick={fetchEBird} loading={ebird.loading} loaded={ebird.loaded} label="Fetch eBird Species" color="pink" />

        {ebird.loaded && (
          <div className="flex flex-wrap gap-1.5">
            <LayerToggle label="eBird layer" visible={layerVis.ebird} onToggle={() => toggleLayer("ebird-species-layer", "ebird")} color="pink" />
          </div>
        )}

        {ebird.species.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Bird Species ({ebird.species.length})
            </h3>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {ebird.species.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5 border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0" />
                  <span className="flex-1 text-[11px] text-gray-300 truncate">{s.comName || s}</span>
                  {s.howMany && <span className="text-[9px] text-gray-500">×{s.howMany}</span>}
                  {s.obsDt   && <span className="text-[9px] text-gray-600">{s.obsDt?.slice(0, 10)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {ebird.loaded && ebird.species.length === 0 && (
          <p className="text-[11px] text-gray-500 text-center py-3">No recent bird observations found near this farm.</p>
        )}

        {!ebird.loaded && (
          <p className="text-[11px] text-gray-600 italic text-center py-4">
            {activeFarm ? "Fetch eBird data above." : "Select a farm to begin."}
          </p>
        )}
      </div>
    );
  }

  // ── Biodiversity Hotspot Viewer ──────────────────────────────────────────
  if (item === "Biodiversity Hotspot Viewer") {
    return (
      <div className="space-y-4">
        <FarmPicker farms={farms} activeFarm={activeFarm} onPick={pickFarm} color="amber" />

        <FetchBtn onClick={fetchHotspots} loading={hotspots.loading} loaded={hotspots.loaded} label="Fetch eBird Hotspots" color="amber" />

        {hotspots.loaded && (
          <div className="flex flex-wrap gap-1.5">
            <LayerToggle label="Heatmap" visible={layerVis.hotspot} onToggle={() => toggleLayer("ebird-hotspots-layer", "hotspot")} color="amber" />
          </div>
        )}

        {hotspots.list.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {hotspots.list.length} Nearby Hotspots
            </h3>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500">
                    <th className="text-left py-1 pr-2 font-semibold">Location</th>
                    <th className="text-left py-1 pr-1 font-semibold">Lat</th>
                    <th className="text-left py-1 font-semibold">Lng</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.list.map((h, i) => (
                    <tr key={i}
                      onClick={() => mapInstance?.flyTo({ center: [h.lng, h.lat], zoom: 12 })}
                      className="border-b border-white/5 cursor-pointer hover:bg-amber-400/5 text-gray-300 transition-colors"
                    >
                      <td className="py-1.5 pr-2 text-amber-300 font-medium">{h.name}</td>
                      <td className="py-1.5 pr-1 text-gray-500">{h.lat.toFixed(3)}</td>
                      <td className="py-1.5 text-gray-500">{h.lng.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hotspots.loaded && hotspots.list.length === 0 && (
          <p className="text-[11px] text-gray-500 text-center py-3">No hotspots found within 20 km of this farm.</p>
        )}

        {!hotspots.loaded && (
          <p className="text-[11px] text-gray-600 italic text-center py-4">
            {activeFarm ? "Fetch hotspot data above." : "Select a farm to begin."}
          </p>
        )}
      </div>
    );
  }

  // ── Biodiversity Index Score ─────────────────────────────────────────────
  if (item === "Biodiversity Index Score") {
    const totalSpecies = new Set([...gbif.species, ...inat.species, ...ebird.species.map(s => s.comName || s)]).size;
    const anyLoaded = gbif.loaded || inat.loaded || ebird.loaded;

    return (
      <div className="space-y-4">
        <FarmPicker farms={farms} activeFarm={activeFarm} onPick={pickFarm} color="yellow" />

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Run All Surveys</h3>
          <div className="grid grid-cols-3 gap-1.5">
            <FetchBtn onClick={fetchGBIF}     loading={gbif.loading}     loaded={gbif.loaded}     label="GBIF"  color="emerald" />
            <FetchBtn onClick={fetchINat}     loading={inat.loading}     loaded={inat.loaded}     label="iNat"  color="cyan" />
            <FetchBtn onClick={fetchEBird}    loading={ebird.loading}    loaded={ebird.loaded}    label="Birds" color="pink" />
          </div>
        </div>

        {anyLoaded && metrics && (
          <>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Composite Score</h3>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-400/20">
                <div className="text-4xl font-black text-yellow-300">{Math.round(metrics.evenness * metrics.simpson * 100)}</div>
                <div>
                  <p className="text-[10px] text-gray-400">Biodiversity Index</p>
                  <p className="text-[9px] text-gray-600">evenness × simpson × 100</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Total Species" value={totalSpecies} max={Math.max(totalSpecies, 50)} color="yellow" />
              <MetricCard label="Shannon H′" value={metrics.shannon} max={5} color="emerald" />
              <MetricCard label="Simpson D" value={metrics.simpson} max={1} color="cyan" />
              <MetricCard label="Evenness J" value={metrics.evenness} max={1} color="violet" />
            </div>

            <div className="space-y-1.5">
              {[
                { label: "GBIF species",  count: gbif.species.length,  color: "emerald", loaded: gbif.loaded },
                { label: "iNat species",  count: inat.species.length,  color: "cyan",    loaded: inat.loaded },
                { label: "Bird species",  count: ebird.species.length, color: "pink",    loaded: ebird.loaded },
              ].map(({ label, count, color, loaded }) => (
                <div key={label} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${loaded ? `bg-${color}-400` : "bg-gray-700"}`} />
                  <span className="text-gray-400 flex-1">{label}</span>
                  <span className={`font-medium ${loaded ? `text-${color}-300` : "text-gray-600"}`}>
                    {loaded ? count : "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {anyLoaded && !metrics && (
          <p className="text-[11px] text-gray-500 text-center py-3">Run GBIF or iNaturalist to compute metrics.</p>
        )}

        {!anyLoaded && (
          <p className="text-[11px] text-gray-600 italic text-center py-4">
            {activeFarm ? "Run surveys above to compute the biodiversity index." : "Select a farm to begin."}
          </p>
        )}
      </div>
    );
  }

  // ── Habitat Fragmentation ────────────────────────────────────────────────
  if (item === "Habitat Fragmentation") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a1400] to-[#1a1000] p-3 border border-yellow-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">Biodiversity · Landscape</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Habitat Fragmentation Analysis</p>
            <p className="text-yellow-200/50 text-[10px] mt-1 leading-relaxed">Quantifies landscape fragmentation using patch metrics (FRAGSTATS-compatible): patch size distribution, edge density, nearest-neighbour distance, and connectivity index derived from ESA WorldCover + Sentinel-2 LULC.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[["Patch Density","Number of habitat patches per 100 ha"],["Mean Patch Size","Average contiguous habitat area"],["Edge Density","m of edge per ha (fragmentation proxy)"],["Core Area Index","% habitat away from edge effects"],["Connectivity Index","Graph-based functional connectivity"]].map(([m, d]) => (
            <div key={m} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
              <div>
                <p className="text-[11px] font-semibold text-yellow-300">{m}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 px-1 italic">Requires classified LULC layer. Run ESA WorldCover or custom LULC first.</p>
      </div>
    );
  }

  // ── Aquatic Biodiversity ─────────────────────────────────────────────────
  if (item === "Aquatic Biodiversity") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#001828] to-[#001418] p-3 border border-cyan-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Biodiversity · Aquatic</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Aquatic Ecosystem Assessment</p>
            <p className="text-cyan-200/50 text-[10px] mt-1 leading-relaxed">Assesses water body health and aquatic biodiversity potential using satellite-derived water quality indices (NDWI, turbidity, chlorophyll-a) combined with GBIF aquatic species occurrence data.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[["NDWI","Water body mapping","cyan"],["Turbidity","Suspended sediment","blue"],["Chl-a Proxy","FAI / Red-Edge index","emerald"],["Water pH proxy","S2 band ratio","gray"]].map(([lbl, val, col]) => (
            <div key={lbl} className={`p-2 rounded-lg bg-${col}-400/5 border border-${col}-400/15`}>
              <p className={`text-[9px] text-${col}-400/60 uppercase tracking-wider`}>{lbl}</p>
              <p className={`text-[11px] font-semibold text-${col}-300 mt-0.5`}>{val}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-cyan-400/10 p-2.5">
          <p className="text-[9px] uppercase tracking-widest text-cyan-400/50 mb-1.5">Data Sources</p>
          {[["GBIF Aquatic Species","gbif.org/species — filter kingdom: Animalia, habitat: freshwater"],["iNaturalist Water Obs.","inaturalist.org — taxon: fish, amphibians, aquatic insects"],["Global Water Watch","globalwaterwatch.earth — water body polygons"],["HydroSHEDS","hydrosheds.org — river network, basin boundaries"]].map(([name, desc]) => (
            <div key={name} className="mb-1.5">
              <p className="text-[10px] text-cyan-300 font-medium">{name}</p>
              <p className="text-[9px] text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Wildlife Corridor Mapping ────────────────────────────────────────────
  if (item === "Wildlife Corridor Mapping") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#0f1800] to-[#141f00] p-3 border border-lime-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-lime-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-lime-400">Biodiversity · Corridors</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Wildlife Corridor Identification</p>
            <p className="text-lime-200/50 text-[10px] mt-1 leading-relaxed">Identifies and maps potential wildlife movement corridors between habitat patches using least-cost path analysis on resistance surfaces derived from LULC, road networks, and human footprint index.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[["Resistance Surface","LULC + road proximity + human footprint","Raster layer"],["Least-Cost Path","Dijkstra / Circuitscape algorithm","Vector corridors"],["Corridor Width","Minimum viable corridor (100–500 m)","Configurable"],["Priority Zones","Overlap with IUCN protected areas","Polygon overlay"]].map(([m, d, u]) => (
            <div key={m} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-lime-400/5 border border-lime-400/10">
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-lime-300">{m}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{d}</p>
              </div>
              <span className="text-[9px] text-lime-500/60 whitespace-nowrap">{u}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 px-1 italic">Corridor analysis requires processed LULC and road network data for the region.</p>
      </div>
    );
  }

  // ── Endangered Species Data ──────────────────────────────────────────────
  if (item === "Endangered Species Data") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a0a00] to-[#180800] p-3 border border-orange-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">Biodiversity · Endangered Species</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Threatened & Endangered Species</p>
            <p className="text-orange-200/50 text-[10px] mt-1 leading-relaxed">Cross-references farm location with databases of threatened and protected species to flag potential presence and compliance obligations under Habitats Directive and national legislation.</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Available APIs & Data Sources</p>
          {[
            { name: "IUCN Red List API", url: "apiv3.iucnredlist.org", desc: "Official threatened species database — token required. Query by lat/lon buffer or taxon.", badge: "API key" },
            { name: "GBIF Threatened Species", url: "api.gbif.org/v1/occurrence", desc: "Filter by iucnRedListCategory: EN, CR, VU within a geometry.", badge: "Free" },
            { name: "EU Habitats Directive", url: "natura2000.eea.europa.eu", desc: "Annex II & IV species occurrences near Natura 2000 sites. WFS available.", badge: "Free" },
            { name: "Protected Planet WDPA", url: "protectedplanet.net/api", desc: "World Database of Protected Areas — overlap check. REST API available.", badge: "API key" },
            { name: "Biodiversity Heritage Library", url: "biodiversitylibrary.org/api", desc: "Historical species occurrence records, taxonomic literature.", badge: "Free" },
          ].map(({ name, url, desc, badge }) => (
            <div key={name} className="rounded-lg bg-white/[0.03] border border-orange-400/10 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[11px] font-semibold text-orange-300">{name}</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${badge === "Free" ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"}`}>{badge}</span>
              </div>
              <p className="text-[9px] text-gray-500 font-mono mb-1">{url}</p>
              <p className="text-[9px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Tree Species Data ────────────────────────────────────────────────────
  if (item === "Tree Species Data") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#0a1800] to-[#0f1f00] p-3 border border-green-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Biodiversity · Tree Species</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Tree Species Identification & Mapping</p>
            <p className="text-green-200/50 text-[10px] mt-1 leading-relaxed">Identifies tree species composition using hyperspectral data (EnMAP), canopy height models (GEDI), and occurrence databases to support agroforestry design and biodiversity assessment.</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Available APIs & Data Sources</p>
          {[
            { name: "GBIF Tree Species", url: "api.gbif.org/v1", desc: "Filter taxon rank=SPECIES + kingdom=Plantae + habitat=forest. Returns occurrence points.", badge: "Free" },
            { name: "Global Forest Watch API", url: "api.globalforestwatch.org", desc: "Forest cover, species richness layers, canopy height. GeoJSON AOI queries.", badge: "Free" },
            { name: "NASA GEDI (via LP DAAC)", url: "lpdaac.usgs.gov/products/gedi02", desc: "Global Ecosystem Dynamics Investigation — 25m canopy height shots. EarthData login.", badge: "EarthData" },
            { name: "iNaturalist Trees", url: "api.inaturalist.org/v1", desc: "taxon_name=Plantae, place_id + iconic_taxon_name=Plantae. High-density observations.", badge: "Free" },
            { name: "TreeMap (US Forest Service)", url: "apps.fs.usda.gov/treemap", desc: "30m tree species probability maps. CONUS only, useful for methodology reference.", badge: "Free" },
          ].map(({ name, url, desc, badge }) => (
            <div key={name} className="rounded-lg bg-white/[0.03] border border-green-400/10 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[11px] font-semibold text-green-300">{name}</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${badge === "Free" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"}`}>{badge}</span>
              </div>
              <p className="text-[9px] text-gray-500 font-mono mb-1">{url}</p>
              <p className="text-[9px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Pollinator Data ──────────────────────────────────────────────────────
  if (item === "Pollinator Data") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a1200] to-[#1a0f00] p-3 border border-amber-400/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">Biodiversity · Pollinators</span>
            </div>
            <p className="text-white text-[12px] font-semibold leading-tight">Pollinator Habitat & Occurrence</p>
            <p className="text-amber-200/50 text-[10px] mt-1 leading-relaxed">Maps pollinator habitat suitability and occurrence records for bees, butterflies, and other pollinators using flower resource density (Sentinel-2 bloom indices) and species observation APIs.</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Available APIs & Data Sources</p>
          {[
            { name: "GBIF Pollinators", url: "api.gbif.org/v1", desc: "Filter by taxonKey for Apidae (bees), Lepidoptera (butterflies), Syrphidae (hoverflies). Occurrence per AOI.", badge: "Free" },
            { name: "iNaturalist — Pollinators", url: "api.inaturalist.org/v1", desc: "iconic_taxon_name=Insecta + taxon_name=Apis/Bombus. Rich observation data with photos.", badge: "Free" },
            { name: "Polli.Nation / SPRING", url: "polli.nation.eu", desc: "EU-funded pollinator monitoring network. CSV datasets available for EU countries.", badge: "EU Open Data" },
            { name: "BEES4Life (EU H2020)", url: "bees4life.org", desc: "Pan-European wild bee occurrence maps. WMS tiles available.", badge: "Free" },
            { name: "eBee / Agromonitoring", url: "agromonitoring.com/api", desc: "Drone-based flower detection + pollinator activity zones (commercial API).", badge: "Commercial" },
          ].map(({ name, url, desc, badge }) => (
            <div key={name} className="rounded-lg bg-white/[0.03] border border-amber-400/10 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[11px] font-semibold text-amber-300">{name}</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${badge === "Free" ? "bg-emerald-500/15 text-emerald-400" : badge === "EU Open Data" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"}`}>{badge}</span>
              </div>
              <p className="text-[9px] text-gray-500 font-mono mb-1">{url}</p>
              <p className="text-[9px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback for other biodiversity items
  return (
    <div className="space-y-4">
      <FarmPicker farms={farms} activeFarm={activeFarm} onPick={pickFarm} />
      <p className="text-[11px] text-gray-600 italic text-center py-4">{item} — coming soon.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [histSensors, setHistSensors] = useLocalState(["sentinel-2"]);
  const [histLoading, setHistLoading] = useLocalState(false);

  // When a Multi-Sensor Data item is clicked, pre-lock the sensor and clear old results
  useEffect(() => {
    const sensorKey = SENSOR_ITEM_MAP[item];
    if (section === "Multi-Sensor Data" && sensorKey) {
      setHistSensors([sensorKey]);
      setThumbnails([]);
    }
  }, [section, item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Main Crop Identification — default to Khargone farm, Sept–Oct 2025, fly to farm
  useEffect(() => {
    if (item !== "Main Crop Identification") return;
    // Pre-select Khargone
    if (farms["Khargone (India)"]) {
      setSelectedFarm("Khargone (India)");
      onFarmSelect("Khargone (India)");
    }
    // Pre-set date range Sept 1 – Oct 31 2025
    selectedRangeRef.current = [new Date("2025-08-01"), new Date("2025-10-31")];
    // Fly to Khargone
    if (mapInstance) {
      mapInstance.flyTo({ center: [75.4122051, 21.9440786], zoom: 14, duration: 1400 });
    }
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared thumbnail-click handler: fly to bbox + overlay on map for optical scenes
  const handleThumbClickFn = (thumb) => {
    if (!mapInstance || !thumb.bbox) return;
    const newId = `thumb-${thumb.id}`;
    if (activeThumbnailId === thumb.id) {
      try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
      try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}
      setActiveThumbnailId(null);
      return;
    }
    if (activeThumbnailId) {
      const oldId = `thumb-${activeThumbnailId}`;
      try { if (mapInstance.getLayer(oldId)) mapInstance.removeLayer(oldId); } catch {}
      try { if (mapInstance.getSource(oldId)) mapInstance.removeSource(oldId); } catch {}
    }
    try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
    try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}
    mapInstance.fitBounds([[thumb.bbox[0], thumb.bbox[1]], [thumb.bbox[2], thumb.bbox[3]]], { padding: 40, duration: 1200 });
    if (!thumb.thumbnail_url) { setActiveThumbnailId(thumb.id); return; }
    setActiveThumbnailId(thumb.id);
    const proxiedUrl = thumb.thumbnail_url.startsWith("http")
      ? `${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(thumb.thumbnail_url)}`
      : thumb.thumbnail_url;
    fetch(proxiedUrl)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob(); })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
        try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}
        mapInstance.addSource(newId, {
          type: "image", url: blobUrl,
          coordinates: [[thumb.bbox[0],thumb.bbox[3]],[thumb.bbox[2],thumb.bbox[3]],[thumb.bbox[2],thumb.bbox[1]],[thumb.bbox[0],thumb.bbox[1]]],
        });
        mapInstance.addLayer({ id: newId, type: "raster", source: newId, paint: { "raster-opacity": 0.9 } });
      })
      .catch(err => console.warn(`[Thumb] ${thumb.id}: ${err.message}`));
  };

  const sectionAccentMap = {
    "Farm Monitoring":            "border-lime-400/40",
    "Organic Assessment":         "border-cyan-400/40",
    "Carbon & GHG Metrics":       "border-pink-400/40",
    "Biodiversity Assessment":    "border-yellow-400/40",
    "Compliance & Regulatory":    "border-purple-400/40",
    "Compliance & Reporting":     "border-purple-400/40",
    "Crop Details":               "border-amber-400/40",
    "Heavy Metal Contamination":  "border-red-400/40",
    "Contamination":              "border-red-400/40",
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

      {section === "Biodiversity Assessment" && (
  <BiodiversityPanel
    item={item}
    farms={farms}
    selectedFarm={selectedFarm}
    setSelectedFarm={setSelectedFarm}
    onFarmSelect={onFarmSelect}
    mapInstance={mapInstance}
  />
)}

      {false && item === "Species Observation Log" && (
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



{false && item === "Bird Species Data" && (
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


{(section === "Compliance & Regulatory" || section === "Compliance & Reporting") && (
  <CompliancePanel item={item} farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect} />
)}

{false && item === "Biodiversity Hotspot Viewer" && (
  
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

{(section === "Crop Details" || section === "Organic & Regenerative") && item === "Land Use & Landscape ID" && (
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

      {section === "Carbon & GHG Metrics" && item === "GHG Emission Tracker" && (
        <GhgPanel selectedGHG={selectedGHG} setSelectedGHG={setSelectedGHG}
          farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect}
          mapInstance={mapInstance} />
      )}
      {section === "Carbon & GHG Metrics" && (item === "CO2 Capture Data" || item === "Carbon Stock Modeling" || item === "Carbon MRV Output" || item === "Carbon Credit Mgmt.") && (
        <CarbonDevPanel item={item} />
      )}

{(section === "Heavy Metal Contamination" || section === "Contamination") && (
  <div className="mt-4">
    <HeavyMetalPanel
      item={item}
      farms={farms}
      selectedFarm={selectedFarm}
      setSelectedFarm={setSelectedFarm}
      onFarmSelect={onFarmSelect}
      mapInstance={mapInstance}
      drawInstance={drawInstance}
    />
  </div>
)}
{false && section === "Heavy Metal Contamination_OLD" && (
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
          const response = await fetch(`${API_BASE}/fastapi/static/files-host/files-host/map.geojson`);
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
{section === "Organic Assessment" && item === "Soil Nutrients and Chemicals" && (
  <div className="space-y-3 mt-2">
    <div className="rounded-xl overflow-hidden">
      <div className="bg-gradient-to-br from-[#0f1f1a] to-[#131727] p-3 border border-cyan-400/15">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Soil Health · Nutrients & Chemicals</span>
        </div>
        <p className="text-white text-[12px] font-semibold leading-tight">Soil Nutrient & Chemical Profiling</p>
        <p className="text-cyan-200/50 text-[10px] mt-1 leading-relaxed">Combines satellite-derived soil indices with field sampling data to map macronutrient availability (N, P, K) and detect chemical residues (pesticides, heavy metals) across the farm.</p>
      </div>
    </div>
    <div className="space-y-1.5">
      {[["Nitrogen (N) Index","NDRE + S2 RedEdge bands","bg-emerald-400/10 text-emerald-300"],["Phosphorus (P)","Field sampling + kriging interpolation","bg-yellow-400/10 text-yellow-300"],["Potassium (K)","Soil electrical conductivity proxy","bg-amber-400/10 text-amber-300"],["Pesticide Residues","Spectral anomaly detection","bg-red-400/10 text-red-300"],["pH Mapping","Satellite hyperspectral + EC correlation","bg-purple-400/10 text-purple-300"]].map(([nutrient, method, cls]) => (
        <div key={nutrient} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border border-white/[0.05] ${cls.split(" ")[0]}`}>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-semibold ${cls.split(" ")[1]}`}>{nutrient}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">{method}</p>
          </div>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-gray-600 px-1 italic">Integration with field lab data required for full nutrient mapping. Contact data team.</p>
  </div>
)}

{section === "Organic Assessment" && item === "Buffer Zone Assessment" && (
  <div className="space-y-3 mt-2">
    <div className="rounded-xl overflow-hidden">
      <div className="bg-gradient-to-br from-[#0f1f1a] to-[#131727] p-3 border border-cyan-400/15">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">Organic Assessment · Buffer Zones</span>
        </div>
        <p className="text-white text-[12px] font-semibold leading-tight">Buffer Zone & Pesticide Drift Risk</p>
        <p className="text-cyan-200/50 text-[10px] mt-1 leading-relaxed">Delineates mandatory buffer zones around organic fields per EU Regulation 2018/848. Assesses pesticide drift risk from adjacent conventional farms using wind direction, crop height, and spray equipment models.</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[["Min. Buffer Width","3–10 m (EU std.)","cyan"],["Drift Risk Model","Wind + distance","emerald"],["Adjacent Land","Satellite LULC","amber"],["Compliance Check","EU 2018/848","purple"]].map(([lbl, val, col]) => (
        <div key={lbl} className={`p-2 rounded-lg bg-${col}-400/5 border border-${col}-400/15`}>
          <p className={`text-[9px] text-${col}-400/60 uppercase tracking-wider`}>{lbl}</p>
          <p className={`text-[11px] font-semibold text-${col}-300 mt-0.5`}>{val}</p>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-gray-600 px-1 italic">Buffer zone delineation requires confirmed farm boundary. Upload ROI to begin.</p>
  </div>
)}

{section === "Organic Assessment" && item === "Carbon Sequestration" && (
  <div className="space-y-3 mt-2">
    <div className="rounded-xl overflow-hidden">
      <div className="bg-gradient-to-br from-[#0f1f1a] to-[#131727] p-3 border border-cyan-400/15">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Organic Assessment · Carbon</span>
        </div>
        <p className="text-white text-[12px] font-semibold leading-tight">Soil Carbon Sequestration Mapping</p>
        <p className="text-emerald-200/50 text-[10px] mt-1 leading-relaxed">Estimates soil organic carbon (SOC) stocks and sequestration rates using satellite-derived spectral indices (NDVI, EVI, Bare Soil Index) combined with IPCC Tier 2 methodology and field SOC measurements.</p>
      </div>
    </div>
    <div className="space-y-1.5">
      {[["SOC Stock Estimate","Satellite BSI + NDVI + field data","Mg C/ha"],["Annual Sequestration Rate","IPCC Tier 2 × land use change","Mg CO₂e/yr"],["Tillage Practice Impact","Cover crop & no-till bonus factors","Multiplier"],["Agroforestry Bonus","Tree canopy C + root zone","Mg C/ha/yr"]].map(([m, d, u]) => (
        <div key={m} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-emerald-300">{m}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">{d}</p>
          </div>
          <span className="text-[9px] text-emerald-500/60 whitespace-nowrap">{u}</span>
        </div>
      ))}
    </div>
  </div>
)}


{section === "Organic Assessment" && !["Soil Nutrients and Chemicals","Buffer Zone Assessment","Carbon Sequestration"].includes(item) && (
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

    const indicator = resolveIndicator(item);
    if (!indicator) { alert(`"${item}" is not a supported satellite indicator.`); setIsLoading(false); return; }

    const startStr = startDate.toISOString().split("T")[0];
    const endStr   = endDate.toISOString().split("T")[0];

    // ── ETa: route to dedicated ET endpoint ──────────────────────────────────
    if (indicator === "ETa") {
      try {
        const res = await fetch(`${API_BASE}/fastapi/et/compute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geojson, start_date: startStr, end_date: endStr, cloud_cover: 30 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || res.statusText);
        const [w, s, e, n] = data.bbox || [0, 0, 0, 0];
        const products = [];
        if (data.chart_url) {
          const proxied = `${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(data.chart_url)}`;
          products.push({ timestamp: `ETa Chart ${startStr}→${endStr}`, png_url: proxied, legend_url: null, bounds: [w, s, e, n] });
        }
        if (data.map_url) {
          const proxied = `${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(data.map_url)}`;
          products.push({ timestamp: `ETa Spatial Map`, png_url: proxied, legend_url: null, bounds: [w, s, e, n] });
        }
        if (products.length === 0) { console.warn("⚠️ ET returned no outputs"); setIsLoading(false); return; }
        setIndicatorFrames(products);
        setCurrentFrameIndex(0);
        setIndicatorLayers(products.map((p, i) => ({ id: `indicator-${i}`, name: p.timestamp, png_url: p.png_url, legend_url: p.legend_url, bbox: p.bounds, visible: false })));
      } catch (err) {
        console.error("❌ ET request failed:", err);
        alert("ET request failed. See console for details.");
      } finally {
        setIsLoading(false);
      }
      return;
    }
    // ── Standard satellite indicator ─────────────────────────────────────────

    const payload = {
      satellite_sensor: satProvider,
      indicator,
      cloud_cover: 50,
      resample: resample,
      start_date: startStr,
      end_date: endStr,
      geojson: geojson
    };

    console.log("📡 Sending indicator request:", payload);

    try {
      const res = await fetch(`${API_BASE}/api/indicator/process`, {
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

      // Store result for compliance report — map section to module key
      if (selectedFarm) {
        const sectionModuleMap = {
          "Organic Assessment":        "organic",
          "Crop Details":              "organic",
          "EUDR Deforestation":        "eudr",
          "Carbon & GHG Metrics":      "carbon",
          "Biodiversity Assessment":   "biodiversity",
          "Contamination":             "contamination",
          "Heavy Metal Contamination": "contamination",
        };
        const moduleKey = sectionModuleMap[section] || "organic";
        storeResult(moduleKey, selectedFarm, payload.indicator, {
          count: products.length,
          start_date: payload.start_date,
          end_date: payload.end_date,
          satellite_sensor: payload.satellite_sensor,
          timestamps: products.map(p => p.timestamp),
          bounds: products[0]?.bounds,
        });
      }
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
  <div className="mt-4 space-y-2">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
      {indicatorLayers.length} Layer{indicatorLayers.length !== 1 ? "s" : ""}
    </h3>
    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
      {indicatorLayers.map((layer, i) => (
        <div key={layer.id} className={`border rounded-md overflow-hidden transition-colors ${layer.visible ? "border-emerald-400/40" : "border-white/10"}`}>
          <div
            className={`flex items-center justify-between px-2 py-1.5 cursor-pointer ${layer.visible ? "bg-emerald-400/10" : "hover:bg-white/5"}`}
            onClick={() => {
              if (!mapInstance) return;
              const newLayers = [...indicatorLayers];
              const updated = { ...newLayers[i], visible: !newLayers[i].visible };
              newLayers[i] = updated;
              setIndicatorLayers(newLayers);
              const id = updated.id;
              if (updated.visible) {
                try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
                fetch(`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(updated.png_url)}`)
                  .then(r => r.ok ? r.blob() : Promise.reject(r.status))
                  .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                    try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
                    mapInstance.addSource(id, {
                      type: "image", url: blobUrl,
                      coordinates: [
                        [updated.bbox[0], updated.bbox[3]],
                        [updated.bbox[2], updated.bbox[3]],
                        [updated.bbox[2], updated.bbox[1]],
                        [updated.bbox[0], updated.bbox[1]],
                      ],
                    });
                    mapInstance.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.9 } });
                  })
                  .catch(err => console.warn(`[Indicator] Overlay failed for ${id}:`, err));
                mapInstance.fitBounds([[updated.bbox[0], updated.bbox[1]], [updated.bbox[2], updated.bbox[3]]], { padding: 20, duration: 900 });
              } else {
                try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
              }
            }}
          >
            <span className="text-[11px] text-gray-300 font-medium truncate">{layer.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ml-2 shrink-0 ${layer.visible ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-white/5 border-white/10 text-gray-500"}`}>
              {layer.visible ? "On" : "Off"}
            </span>
          </div>
          {layer.visible && (
            <div className="px-2 pb-2 pt-1 bg-black/20 space-y-1">
              {layer.png_url && (
                <img src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(layer.png_url)}`}
                  alt={layer.name} className="w-full h-auto rounded" />
              )}
              {layer.legend_url && (
                <div>
                  <p className="text-[9px] text-gray-500 mb-0.5 uppercase tracking-wider">Legend</p>
                  <img src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(layer.legend_url)}`}
                    alt="legend" className="w-full h-auto rounded" />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
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
{(section === "Crop Details" || section === "Organic & Regenerative") && item === "Main Crop Identification" && (
  
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
        defaultValue={[new Date("2025-08-01"), new Date("2025-10-31")]}
        onChange={(range) => {
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

    const indicator = resolveIndicator(item);
    if (!indicator) { alert(`"${item}" is not a supported satellite indicator.`); setIsLoading(false); return; }

    const payload = {
      satellite_sensor: satProvider,
      indicator,
      cloud_cover: 50,
      resample: resample,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      geojson: geojson
    };

    console.log("📡 Sending indicator request:", payload);

    try {
      const res = await fetch(`${API_BASE}/api/indicator/process`, {
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
  <div className="mt-4 space-y-2">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
      {indicatorLayers.length} Layer{indicatorLayers.length !== 1 ? "s" : ""}
    </h3>
    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
      {indicatorLayers.map((layer, i) => (
        <div key={layer.id} className={`border rounded-md overflow-hidden transition-colors ${layer.visible ? "border-emerald-400/40" : "border-white/10"}`}>
          <div
            className={`flex items-center justify-between px-2 py-1.5 cursor-pointer ${layer.visible ? "bg-emerald-400/10" : "hover:bg-white/5"}`}
            onClick={() => {
              if (!mapInstance) return;
              const newLayers = [...indicatorLayers];
              const updated = { ...newLayers[i], visible: !newLayers[i].visible };
              newLayers[i] = updated;
              setIndicatorLayers(newLayers);
              const id = updated.id;
              if (updated.visible) {
                try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
                fetch(`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(updated.png_url)}`)
                  .then(r => r.ok ? r.blob() : Promise.reject(r.status))
                  .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                    try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
                    mapInstance.addSource(id, {
                      type: "image", url: blobUrl,
                      coordinates: [
                        [updated.bbox[0], updated.bbox[3]],
                        [updated.bbox[2], updated.bbox[3]],
                        [updated.bbox[2], updated.bbox[1]],
                        [updated.bbox[0], updated.bbox[1]],
                      ],
                    });
                    mapInstance.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.9 } });
                  })
                  .catch(err => console.warn(`[Indicator] Overlay failed for ${id}:`, err));
                mapInstance.fitBounds([[updated.bbox[0], updated.bbox[1]], [updated.bbox[2], updated.bbox[3]]], { padding: 20, duration: 900 });
              } else {
                try { if (mapInstance.getLayer(id)) mapInstance.removeLayer(id); } catch {}
                try { if (mapInstance.getSource(id)) mapInstance.removeSource(id); } catch {}
              }
            }}
          >
            <span className="text-[11px] text-gray-300 font-medium truncate">{layer.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ml-2 shrink-0 ${layer.visible ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-white/5 border-white/10 text-gray-500"}`}>
              {layer.visible ? "On" : "Off"}
            </span>
          </div>
          {layer.visible && (
            <div className="px-2 pb-2 pt-1 bg-black/20 space-y-1">
              {layer.png_url && (
                <img src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(layer.png_url)}`}
                  alt={layer.name} className="w-full h-auto rounded" />
              )}
              {layer.legend_url && (
                <div>
                  <p className="text-[9px] text-gray-500 mb-0.5 uppercase tracking-wider">Legend</p>
                  <img src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(layer.legend_url)}`}
                    alt="legend" className="w-full h-auto rounded" />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
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
{(section === "Crop Details" || section === "Organic & Regenerative") && item === "Green Cover Changes" && (
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
            const res = await fetch(`${API_BASE}/api/landcover/esa`, {
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
    {(item === "Historical Imagery" || (section === "Multi-Sensor Data" && SENSOR_ITEM_MAP[item])) && (
  <div className="pt-2">
    {SENSOR_ITEM_MAP[item] && (() => {
      const meta = SENSOR_META[SENSOR_ITEM_MAP[item]] || {};
      const col = meta.color || "sky";
      return (
        <div className={`mb-3 px-2 py-2 rounded-md bg-${col}-500/10 border border-${col}-400/20`}>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-${col}-400 flex-shrink-0`} />
            <span className={`text-[11px] text-${col}-300 font-medium`}>{meta.label || item}</span>
          </div>
          {meta.note && <p className="text-[9px] text-gray-500 mt-1 leading-tight">{meta.note}</p>}
        </div>
      );
    })()}
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Date</h3>
    <Calendar
      selectRange={true}
      maxDate={new Date()}
      onChange={(range) => {
        console.log("📅 Selected range:", range);
        selectedRangeRef.current = range;
      }}
    />

    {!SENSOR_ITEM_MAP[item] && (
      <div className="mt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Satellite Sources</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "sentinel-2", label: "Sentinel-2", color: "emerald" },
            { key: "sentinel-1", label: "Sentinel-1 SAR", color: "sky" },
            { key: "landsat",    label: "Landsat",      color: "amber" },
          ].map(({ key, label, color }) => {
            const checked = (histSensors || ["sentinel-2"]).includes(key);
            return (
              <label key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer text-xs transition-colors ${checked ? `bg-${color}-500/15 border-${color}-400/40 text-${color}-300` : "border-white/10 text-gray-500 hover:border-white/20"}`}>
                <input
                  type="checkbox"
                  className="accent-current w-3 h-3"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? (histSensors || ["sentinel-2"]).filter(s => s !== key)
                      : [...(histSensors || ["sentinel-2"]), key];
                    setHistSensors(next.length ? next : ["sentinel-2"]);
                  }}
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    )}

    <button
      onClick={async () => {
        const range = selectedRangeRef.current;
        if (!selectedFarm || !range || !range[0] || !range[1]) {
          alert("Please select a farm and a valid date range.");
          return;
        }

        const [start, end] = range;
        const farm = farms[selectedFarm];

        const coordinates = farm.wkt
          .replace("POLYGON((", "")
          .replace("))", "")
          .split(",")
          .map(p => p.trim().split(" ").map(Number));
        const geojson = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coordinates] } }],
        };

        const payload = {
          geojson,
          start_date: start.toISOString().split("T")[0],
          end_date:   end.toISOString().split("T")[0],
          sensors:    histSensors || ["sentinel-2"],
          cloud_cover: 30,
        };

        setHistLoading(true);
        try {
          const response = await fetch(`${API_BASE}/api/preview/historical-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok) {
            alert(`API error (${response.status}): ${result.error || "Unknown error"}. Is the FastAPI server running on port 8000?`);
            return;
          }
          const thumbs = Array.isArray(result.thumbnails) ? result.thumbnails : [];
          setThumbnails(thumbs);
          if (!thumbs.length) alert("No imagery found for the selected date range and area.");
        } catch (err) {
          console.error("❌ Request failed:", err);
          alert("Failed to fetch historical data.");
        } finally {
          setHistLoading(false);
        }
      }}
      className="mt-3 w-full px-3 py-1.5 bg-sky-500/20 border border-sky-400/30 text-sky-300 rounded-md text-xs hover:bg-sky-500/30 transition-colors disabled:opacity-50"
      disabled={histLoading}
    >
      {histLoading ? "Searching…" : `Search ${SENSOR_ITEM_MAP[item] ? (SENSOR_META[SENSOR_ITEM_MAP[item]]?.label || item) : "Historical Imagery"}`}
    </button>

 {thumbnails.length > 0 && (() => {
  // Scenes without public HTTPS thumbnails → tabular only
  // Sentinel-3 quicklooks come via /api/ghg/quicklook/:id (relative URL, not http) — treat as proxy thumbnails
  const isProxyThumb = (t) => t.thumbnail_url && (t.thumbnail_url.startsWith("http") || t.thumbnail_url.startsWith("/api/ghg/quicklook/"));
  const tabularScenes = thumbnails.filter(t => !isProxyThumb(t));
  const otherScenes   = thumbnails.filter(t =>  isProxyThumb(t));

  const handleThumbClick = (thumb) => {
    if (!mapInstance || !thumb.bbox) return;
    const newId = `thumb-${thumb.id}`;
    if (activeThumbnailId === thumb.id) {
      try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
      try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}
      setActiveThumbnailId(null);
      return;
    }
    if (activeThumbnailId) {
      const oldId = `thumb-${activeThumbnailId}`;
      try { if (mapInstance.getLayer(oldId)) mapInstance.removeLayer(oldId); } catch {}
      try { if (mapInstance.getSource(oldId)) mapInstance.removeSource(oldId); } catch {}
    }
    try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
    try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}

    if (!thumb.thumbnail_url) {
      setActiveThumbnailId(thumb.id);
      mapInstance.fitBounds([[thumb.bbox[0], thumb.bbox[1]], [thumb.bbox[2], thumb.bbox[3]]], { padding: 40, duration: 1200 });
      return;
    }
    // Always fly to the scene first
    mapInstance.fitBounds([[thumb.bbox[0], thumb.bbox[1]], [thumb.bbox[2], thumb.bbox[3]]], { padding: 40, duration: 1200 });
    setActiveThumbnailId(thumb.id);

    // Use proxy for external URLs; /api/ghg/quicklook/ and other relative URLs go direct
    const proxiedUrl = thumb.thumbnail_url.startsWith("http")
      ? `${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(thumb.thumbnail_url)}`
      : thumb.thumbnail_url;
    fetch(proxiedUrl)
      .then(r => {
        if (!r.ok) throw new Error(`Proxy ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        try { if (mapInstance.getLayer(newId)) mapInstance.removeLayer(newId); } catch {}
        try { if (mapInstance.getSource(newId)) mapInstance.removeSource(newId); } catch {}
        mapInstance.addSource(newId, {
          type: "image",
          url: blobUrl,
          coordinates: [
            [thumb.bbox[0], thumb.bbox[3]],
            [thumb.bbox[2], thumb.bbox[3]],
            [thumb.bbox[2], thumb.bbox[1]],
            [thumb.bbox[0], thumb.bbox[1]],
          ],
        });
        mapInstance.addLayer({ id: newId, type: "raster", source: newId, paint: { "raster-opacity": 0.9 } });
      })
      .catch(err => console.warn(`[Thumbnail] Could not load overlay for ${thumb.id}: ${err.message}`));
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Sentinel-2 / Landsat — image cards */}
      {otherScenes.length > 0 && (
        <div className="bg-white/5 rounded-lg p-3 border border-white/[0.06]">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {otherScenes.length} Optical Scene{otherScenes.length !== 1 ? "s" : ""}
          </h3>
          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {otherScenes.map((thumb) => {
              const sensorColor = {
                "Sentinel-2": "emerald", "Landsat": "amber",
                "Sentinel-3": "cyan", "EnMAP": "violet",
                "Planet SkySat": "orange", "CopDEM": "slate",
              }[thumb.sensor] || "gray";
              return (
                <div key={thumb.id}
                  className={`border rounded-md p-2 cursor-pointer transition-colors ${activeThumbnailId === thumb.id ? "bg-sky-400/10 border-sky-400/40" : "border-white/10 hover:bg-white/5"}`}
                  onClick={() => handleThumbClick(thumb)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-${sensorColor}-500/20 text-${sensorColor}-300 border border-${sensorColor}-400/30`}>
                      {thumb.sensor}
                    </span>
                    <span className="text-[10px] text-gray-500">{thumb.datetime ? thumb.datetime.slice(0, 10) : ""}</span>
                  </div>
                  {thumb.thumbnail_url && thumb.thumbnail_url.startsWith("http") && (
                    <img src={thumb.thumbnail_url} alt={thumb.id} className="w-full h-auto rounded mb-1" />
                  )}
                  <p className="text-[10px] text-gray-600 truncate">{thumb.id}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SAR / Landsat — tabular (no public thumbnail) */}
      {tabularScenes.length > 0 && (
        <div className="bg-white/5 rounded-lg p-3 border border-white/[0.06]">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {tabularScenes.length} Scene{tabularScenes.length !== 1 ? "s" : ""} (metadata only)
          </h3>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-[10px] text-gray-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-1 pr-2 font-semibold">Sensor</th>
                  <th className="text-left py-1 pr-2 font-semibold">Date</th>
                  <th className="text-left py-1 pr-2 font-semibold">Scene ID</th>
                  <th className="text-left py-1 font-semibold">View</th>
                </tr>
              </thead>
              <tbody>
                {tabularScenes.map((thumb) => (
                  <tr key={thumb.id}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${activeThumbnailId === thumb.id ? "bg-sky-400/10 text-sky-300" : "hover:bg-white/5"}`}
                    onClick={() => handleThumbClick(thumb)}
                  >
                    <td className="py-1.5 pr-2 whitespace-nowrap text-gray-400">{thumb.sensor}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {thumb.datetime ? thumb.datetime.slice(0, 10) : "—"}
                      {thumb.extra?.cloud_cover != null && <span className="ml-1 text-gray-600">{Math.round(thumb.extra.cloud_cover)}%☁</span>}
                    </td>
                    <td className="py-1.5 pr-2 truncate max-w-[100px] font-mono">{thumb.id.slice(0, 20)}…</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border ${activeThumbnailId === thumb.id ? "bg-sky-500/20 border-sky-400/30 text-sky-300" : "bg-white/5 border-white/10 text-gray-400"}`}>
                        {activeThumbnailId === thumb.id ? "Active" : "Fly to"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
})()}

  </div>
  
  
)}
  </div>
  
)}



{/* ── Sub-Task 1: Multi-Sensor Data viewer ────────────────────────────── */}
{section === "Multi-Sensor Data" && (() => {
  const sensorKey = SENSOR_ITEM_MAP[item];
  if (!sensorKey) return null; // "Processing Jobs" etc.
  const meta      = SENSOR_META[sensorKey] || {};
  const col       = meta.color || "sky";

  const OPTICAL_SENSORS = new Set(["sentinel-2", "landsat", "planet-open"]);
  const isProxyThumb = (t) =>
    t.thumbnail_url && (t.thumbnail_url.startsWith("http") || t.thumbnail_url.startsWith("/api/ghg/quicklook/"));
  const withImage = thumbnails.filter(t => isProxyThumb(t));
  const noImage   = thumbnails.filter(t => !isProxyThumb(t));

  const SENSOR_COLORS = {
    "Sentinel-2": "emerald", "Sentinel-1": "sky", "Sentinel-3": "cyan",
    "Landsat": "amber", "CopDEM": "slate", "EnMAP": "violet", "Planet SkySat": "orange",
  };

  return (
    <div className="space-y-4 mt-4">

      {/* ── Sensor badge ── */}
      <div className={`px-3 py-2.5 rounded-lg bg-${col}-500/10 border border-${col}-400/20`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full bg-${col}-400 flex-shrink-0`} />
          <span className={`text-[12px] font-semibold text-${col}-300`}>{meta.label || item}</span>
          {OPTICAL_SENSORS.has(sensorKey) && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-400/20">Map overlay</span>
          )}
        </div>
        {meta.note && <p className="text-[9px] text-gray-500 leading-tight">{meta.note}</p>}
      </div>

      {/* ── Farm selector ── */}
      {Object.keys(farms).length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Farm</h3>
          <div className="space-y-0.5">
            {Object.keys(farms).map(name => (
              <button key={name}
                onClick={() => { onFarmSelect(name); setSelectedFarm(name); }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors ${
                  selectedFarm === name
                    ? `bg-${col}-500/15 text-${col}-300 border border-${col}-400/20`
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Date range ── */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Date Range</h3>
        <Calendar
          selectRange={true}
          maxDate={new Date()}
          onChange={(range) => { selectedRangeRef.current = range; }}
        />
      </div>

      {/* ── Search ── */}
      <button
        disabled={histLoading || !selectedFarm}
        onClick={async () => {
          const range = selectedRangeRef.current;
          if (!selectedFarm || !range?.[0] || !range?.[1]) {
            alert("Select a farm and date range first.");
            return;
          }
          const farm = farms[selectedFarm];
          const coords = farm.wkt.replace("POLYGON((","").replace("))","").split(",").map(p => p.trim().split(" ").map(Number));
          const geojson = { type:"FeatureCollection", features:[{type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[coords]}}] };
          const [start, end] = range;
          setHistLoading(true);
          setThumbnails([]);
          try {
            const res = await fetch(`${API_BASE}/api/preview/historical-preview`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                geojson,
                start_date: start.toISOString().split("T")[0],
                end_date:   end.toISOString().split("T")[0],
                sensors:    [sensorKey],
                cloud_cover: 30,
              }),
            });
            const result = await res.json();
            if (!res.ok) { alert(`Error: ${result.error || res.statusText}`); return; }
            const thumbs = Array.isArray(result.thumbnails) ? result.thumbnails : [];
            setThumbnails(thumbs);
            if (!thumbs.length) alert("No scenes found for this date range and farm.");
          } catch (err) {
            alert("Failed to fetch scenes.");
          } finally {
            setHistLoading(false);
          }
        }}
        className={`w-full px-3 py-2 bg-${col}-500/20 border border-${col}-400/30 text-${col}-300 rounded-md text-xs font-medium hover:bg-${col}-500/30 transition-colors disabled:opacity-40`}
      >
        {histLoading ? "Searching…" : `Search ${meta.label || item} Scenes`}
      </button>

      {/* ── Results ── */}
      {thumbnails.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500">
            {thumbnails.length} scene{thumbnails.length !== 1 ? "s" : ""} found
            {selectedRangeRef.current?.[0] && (
              <span className="ml-1 text-gray-600">
                · {selectedRangeRef.current[0].toISOString().slice(0,10)} → {selectedRangeRef.current[1].toISOString().slice(0,10)}
              </span>
            )}
          </p>

          {/* Optical: image cards + Add to Map */}
          {withImage.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/[0.06]">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {withImage.length} Scene{withImage.length !== 1 ? "s" : ""} — click to toggle map overlay
              </h3>
              <div className="max-h-[28rem] overflow-y-auto space-y-3 pr-1">
                {withImage.map(thumb => {
                  const sc = SENSOR_COLORS[thumb.sensor] || "sky";
                  const isActive = activeThumbnailId === thumb.id;
                  return (
                    <div key={thumb.id}
                      className={`border rounded-md p-2 transition-colors ${isActive ? `bg-${sc}-400/10 border-${sc}-400/40` : "border-white/10 hover:bg-white/5"}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-${sc}-500/20 text-${sc}-300 border border-${sc}-400/30`}>
                          {thumb.sensor}
                        </span>
                        <span className="text-[10px] text-gray-500">{thumb.datetime?.slice(0, 10)}</span>
                      </div>
                      {thumb.thumbnail_url?.startsWith("http") && (
                        <img src={thumb.thumbnail_url} alt={thumb.id}
                          className="w-full h-auto rounded mb-2 border border-white/10"
                          onError={e => { e.target.style.display = "none"; }}
                        />
                      )}
                      <button
                        onClick={() => handleThumbClickFn(thumb)}
                        className={`w-full text-[10px] py-1.5 rounded-md font-medium transition-colors ${
                          isActive
                            ? `bg-${sc}-500/20 text-${sc}-300 border border-${sc}-400/30`
                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                      >
                        {isActive ? "✓ On Map — click to remove" : "Add to Map"}
                      </button>
                      <p className="text-[9px] text-gray-600 truncate mt-1 font-mono">{thumb.id}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Non-optical / no thumbnail: dataset table */}
          {noImage.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/[0.06]">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {noImage.length} Dataset{noImage.length !== 1 ? "s" : ""} — click to fly to
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-500">
                      <th className="text-left py-1 pr-2 font-semibold">Sensor</th>
                      <th className="text-left py-1 pr-2 font-semibold">Date</th>
                      <th className="text-left py-1 font-semibold">Scene ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noImage.map(thumb => {
                      const isActive = activeThumbnailId === thumb.id;
                      return (
                        <tr key={thumb.id}
                          onClick={() => {
                            if (mapInstance && thumb.bbox)
                              mapInstance.fitBounds([[thumb.bbox[0],thumb.bbox[1]],[thumb.bbox[2],thumb.bbox[3]]], { padding: 40, duration: 1200 });
                            setActiveThumbnailId(isActive ? null : thumb.id);
                          }}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${isActive ? "bg-sky-400/10 text-sky-300" : "hover:bg-white/5 text-gray-300"}`}
                        >
                          <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">{thumb.sensor}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            {thumb.datetime?.slice(0, 10) || "—"}
                            {thumb.extra?.cloud_cover != null && (
                              <span className="ml-1 text-gray-600">{Math.round(thumb.extra.cloud_cover)}%☁</span>
                            )}
                          </td>
                          <td className="py-1.5 font-mono truncate max-w-[90px]">{thumb.id.slice(0, 20)}…</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {thumbnails.length === 0 && !histLoading && (
        <p className="text-[11px] text-gray-600 text-center py-3 italic">
          {selectedFarm ? "Select a date range and search." : "Select a farm to begin."}
        </p>
      )}

    </div>
  );
})()}

{/* ── Pilot 2: Czech Republic ─────────────────────────────────────────── */}
{section === "Pilot 2 — Czech Republic" && (
  <CzechPilotPanel item={item} mapInstance={mapInstance} />
)}

{/* ── Sub-Task 3: EUDR Deforestation ─────────────────────────────────── */}
{section === "EUDR Deforestation" && (
  <EudrPanel item={item} farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect} satProvider={satProvider} setSatProvider={setSatProvider} mapInstance={mapInstance} drawInstance={drawInstance} />
)}

{/* ── Sub-Task 4: Organic & Regenerative ─────────────────────────────── */}
{section === "Organic & Regenerative" && item in {"Crop Rotation Detection":1,"Cover Crop Verification":1,"Compost Application Map":1,"Soil Carbon Trend":1,"Chemical-Free Verification":1,"Buffer Zone & Drift Risk":1} && (
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
// ── Heavy Metal Contamination Panel ───────────────────────────────────────────

// Pre-defined AOI: Ghaziabad industrial corridor, Uttar Pradesh, India
// Covers Hindon River basin + Loni + Sahibabad industrial estate
const GHAZIABAD_AOI = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { name: "Ghaziabad Industrial Corridor" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [77.350, 28.580], [77.550, 28.580],
        [77.550, 28.720], [77.350, 28.720],
        [77.350, 28.580],
      ]],
    },
  }],
};

const GHAZIABAD_META = {
  location:    "Ghaziabad, Uttar Pradesh, India",
  coordinates: "28.67°N, 77.44°E",
  context: "Industrial city in the NCR belt. The Hindon River and surrounding soils are impacted by discharge from electroplating, tannery, and textile industries — primary sources of hexavalent Chromium (Cr⁶⁺) contamination. Elevated Cr levels (~600 mg/kg) are detectable in the 600–900 nm spectral range.",
  metal: "Chromium (Cr)",
  criticalLevel: "600 mg/kg",
  spectralRange: "600–900 nm",
  sources: ["Hindon River effluent discharge", "Sahibabad industrial estate", "Electroplating units", "Tannery & textile factories"],
  geojsonUrl: `${API_BASE}/api/case-study/ghaziabad-chromium`,
  layerId: "chromium-contamination-layer",
  sourceId: "chromium-contamination-source",
};

const HM_THRESHOLDS = {
  pb: { low: 100, high: 300, label: "Lead (Pb)",   color: { Low:"text-emerald-400", Medium:"text-yellow-400", High:"text-red-400" } },
  cu: { low: 50,  high: 150, label: "Copper (Cu)", color: { Low:"text-emerald-400", Medium:"text-yellow-400", High:"text-red-400" } },
  zn: { low: 100, high: 300, label: "Zinc (Zn)",   color: { Low:"text-emerald-400", Medium:"text-yellow-400", High:"text-red-400" } },
};

// ── GHG Emission Tracker Panel ────────────────────────────────────────────────
const GHG_LIST = [
  { code: "CO",  name: "Carbon Monoxide",  cdse: "L2__CO____" },
  { code: "CH₄", name: "Methane",          cdse: "L2__CH4___" },
  { code: "NO₂", name: "Nitrogen Dioxide", cdse: "L2__NO2___" },
  { code: "O₃",  name: "Ozone",            cdse: "L2__O3____" },
  { code: "SO₂", name: "Sulphur Dioxide",  cdse: "L2__SO2___" },
];

function GhgPanel({ selectedGHG, setSelectedGHG, farms = {}, selectedFarm, setSelectedFarm, onFarmSelect, mapInstance }) {
  const farmNames = Object.keys(farms);
  const [ghgProducts,  setGhgProducts]  = useLocalState([]);
  const [ghgLoading,   setGhgLoading]   = useLocalState(false);
  const [ghgError,     setGhgError]     = useLocalState(null);
  const [activeGhgId,  setActiveGhgId]  = useLocalState(null);
  const [layerLoading, setLayerLoading] = useLocalState(null); // product id being loaded
  const [ghgStartDate, setGhgStartDate] = useLocalState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [ghgEndDate, setGhgEndDate] = useLocalState(() => new Date().toISOString().slice(0, 10));

  async function toggleGhgLayer(product) {
    if (!mapInstance) return;
    const srcId = `ghg-${product.id}`;
    if (activeGhgId === product.id) {
      if (mapInstance.getLayer(srcId)) mapInstance.removeLayer(srcId);
      if (mapInstance.getSource(srcId)) mapInstance.removeSource(srcId);
      setActiveGhgId(null);
      return;
    }
    // Remove previous layer
    if (activeGhgId) {
      const prev = `ghg-${activeGhgId}`;
      if (mapInstance.getLayer(prev)) mapInstance.removeLayer(prev);
      if (mapInstance.getSource(prev)) mapInstance.removeSource(prev);
    }
    if (!product.bbox) { setGhgError("No footprint available for this product."); return; }
    setLayerLoading(product.id);
    try {
      const res = await fetch(`${API_BASE}/api/ghg/quicklook/${product.id}`);
      if (!res.ok) throw new Error(`Quicklook fetch failed (${res.status})`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const [w, s, e, n] = product.bbox;
      mapInstance.addSource(srcId, { type: "image", url, coordinates: [[w,n],[e,n],[e,s],[w,s]] });
      mapInstance.addLayer({ id: srcId, type: "raster", source: srcId, paint: { "raster-opacity": 0.85 } });
      mapInstance.fitBounds([[w,s],[e,n]], { padding: 60 });
      setActiveGhgId(product.id);
    } catch (e) {
      setGhgError(e.message);
    } finally {
      setLayerLoading(null);
    }
  }

  async function searchGhg(cdseProductType) {
    if (!selectedFarm || !farms[selectedFarm]?.wkt) { setGhgError("Select a farm first."); return; }
    const wkt = farms[selectedFarm].wkt;
    setGhgLoading(true); setGhgError(null); setGhgProducts([]);
    try {
      const res = await fetch(`${API_BASE}/api/ghg/search`, {
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

      <div>
        <label className="text-[9px] uppercase text-gray-500 block mb-1">Farm</label>
        <select value={selectedFarm ?? ""} onChange={e => { setSelectedFarm(e.target.value); onFarmSelect(e.target.value); }}
          className="w-full bg-[#1a1a2e] border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
          <option value="">— Select farm —</option>
          {farmNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

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

      {ghgLoading && <p className="text-center text-pink-400 text-xs animate-pulse">Searching CDSE catalog...</p>}
      {ghgError && <p className="text-red-400 text-xs">{ghgError}</p>}
      {ghgProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] uppercase text-gray-500">{ghgProducts.length} products found · {selectedGHG}</p>
          {ghgProducts.map((p) => {
            const isActive  = activeGhgId === p.id;
            const isLoading = layerLoading === p.id;
            return (
              <div key={p.id} className={`border rounded-md px-3 py-2 bg-white/[0.03] space-y-1.5 transition-colors ${isActive ? "border-pink-400/40 bg-pink-400/5" : "border-white/10"}`}>
                <p className="text-[10px] text-pink-300 font-mono truncate">{p.name?.slice(0, 38)}…</p>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{p.datetime ? new Date(p.datetime).toLocaleDateString() : "—"}</span>
                  <span className={p.online ? "text-green-400" : "text-yellow-400"}>{p.online ? "Online" : "Offline"}</span>
                  <span>{p.size_mb} MB</span>
                </div>
                {p.bbox && (
                  <button
                    onClick={() => toggleGhgLayer(p)}
                    disabled={isLoading}
                    className={`w-full py-1 rounded text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                      isActive
                        ? "bg-pink-400/20 border border-pink-400/40 text-pink-300 hover:bg-pink-400/10"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:text-pink-300 hover:border-pink-400/30"
                    }`}
                  >
                    {isLoading ? "Loading…" : isActive ? "Remove from map" : "Add to map"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!ghgLoading && !ghgError && ghgProducts.length === 0 && selectedGHG && (
        <p className="text-xs text-gray-500 text-center">No products found for this period.</p>
      )}
    </div>
  );
}

function HeavyMetalPanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect, mapInstance, drawInstance }) {
  const isGhaziabad = item === "Ghaziabad Case Study";
  const [loading,       setLoading]       = useLocalState(false);
  const [mapLoading,    setMapLoading]    = useLocalState(false);
  const [result,        setResult]        = useLocalState(null);
  const [error,         setError]         = useLocalState(null);
  const [activeMetal,   setActiveMetal]   = useLocalState(null);
  const [crLayerActive, setCrLayerActive] = useLocalState(false);
  const [crLoading,     setCrLoading]     = useLocalState(false);
  const [crError,       setCrError]       = useLocalState(null);
  const [startDate,     setStartDate]     = useLocalState("2023-01-01");
  const [endDate,       setEndDate]       = useLocalState(new Date().toISOString().split("T")[0]);
  const [cloudCover,    setCloudCover]    = useLocalState(10);
  const [drawMode,      setDrawMode]      = useLocalState(false);
  const [drawnGeojson,  setDrawnGeojson]  = useLocalState(null);

  function toggleDraw() {
    if (!drawInstance) return;
    if (drawMode) {
      drawInstance.changeMode("simple_select");
      setDrawMode(false);
    } else {
      drawInstance.deleteAll();
      drawInstance.changeMode("draw_polygon");
      setDrawMode(true);
      const onCreated = () => {
        const fc = drawInstance.getAll();
        if (fc.features.length) { setDrawnGeojson(fc); setDrawMode(false); }
        mapInstance.off("draw.create", onCreated);
      };
      mapInstance.on("draw.create", onCreated);
    }
  }

  function clearDraw() {
    if (drawInstance) drawInstance.deleteAll();
    setDrawnGeojson(null); setDrawMode(false);
  }

  async function toggleChromiumLayer() {
    if (!mapInstance) return;
    const { layerId, sourceId, geojsonUrl } = GHAZIABAD_META;
    if (crLayerActive) {
      if (mapInstance.getLayer(layerId))  mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      setCrLayerActive(false);
      return;
    }
    setCrLoading(true); setCrError(null);
    try {
      const res  = await fetch(geojsonUrl);
      if (!res.ok) throw new Error(`Failed to load GeoJSON (${res.status})`);
      const data = await res.json();

      if (mapInstance.getLayer(layerId))  mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

      mapInstance.addSource(sourceId, { type: "geojson", data });

      mapInstance.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "contamination_level"],
            0,  "#22c55e",   // green  — clean
            3,  "#86efac",   // light green
            5,  "#eab308",   // yellow — moderate
            7,  "#f97316",   // orange — elevated
            10, "#ef4444",   // red    — critical
          ],
          "fill-opacity": 0.72,
          "fill-outline-color": "rgba(239,68,68,0.4)",
        },
      });

      // Fit map to data bounds (computed manually — no window.mapboxgl dependency)
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      data.features.forEach(f => {
        const geom = f.geometry;
        const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat(1);
        (rings[0] || []).forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        });
      });
      if (isFinite(minLng)) {
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        mapInstance.flyTo({ center: [centerLng, centerLat], zoom: 12, speed: 1.2, curve: 1.4 });
      }

      setCrLayerActive(true);
    } catch(e) { setCrError(e.message); }
    finally { setCrLoading(false); }
  }

  function buildGeojson() {
    if (isGhaziabad) return GHAZIABAD_AOI;
    if (drawnGeojson?.features?.length) return drawnGeojson;
    if (selectedFarm && farms[selectedFarm]?.wkt) {
      const wkt    = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      return { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
    }
    return null;
  }

  async function runAnalysis() {
    const geojson = buildGeojson();
    if (!geojson) return alert("Draw a shape on the map or select a farm.");
    if (!startDate || !endDate) return alert("Select a date range.");
    setLoading(true); setError(null); setResult(null); setActiveMetal(null);
    try {
      const res  = await fetch(`${API_BASE}/fastapi/heavy-metals/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geojson, start_date: startDate, end_date: endDate, cloud_cover: cloudCover, metal: "all" }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
      setResult(await res.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function showMetalMap(metal) {
    if (!mapInstance) return;
    const SRC = `hm-map-${metal}`;
    // Toggle off
    if (activeMetal === metal) {
      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);
      setActiveMetal(null);
      return;
    }
    // Remove previous metal map
    ["pb","cu","zn"].forEach(m => {
      const s = `hm-map-${m}`;
      if (mapInstance.getLayer(s)) mapInstance.removeLayer(s);
      if (mapInstance.getSource(s)) mapInstance.removeSource(s);
    });
    const geojson = buildGeojson();
    if (!geojson) return;
    setMapLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const body    = JSON.stringify({ geojson, start_date: startDate, end_date: endDate, cloud_cover: cloudCover, metal });

      const infoRes = await fetch(`${API_BASE}/fastapi/heavy-metals/info`,  { method:"POST", headers, body });
      const { bounds } = await infoRes.json();
      const [west, south, east, north] = bounds;

      const pngRes = await fetch(`${API_BASE}/fastapi/heavy-metals/png`, { method:"POST", headers, body });
      const blob   = await pngRes.blob();
      const pngUrl = URL.createObjectURL(blob);

      mapInstance.addSource(SRC, {
        type:"image", url: pngUrl,
        coordinates: [[west,north],[east,north],[east,south],[west,south]],
      });
      mapInstance.addLayer({ id: SRC, type:"raster", source: SRC, paint:{ "raster-opacity": 0.82 } });
      mapInstance.fitBounds([[west,south],[east,north]], { padding: 60 });
      setActiveMetal(metal);
    } catch(e) { alert("Map error: " + e.message); }
    finally { setMapLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span>☣️</span>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Heavy Metal Contamination</p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Estimates Pb / Cu / Zn spatial distribution using Sentinel-2 L2A reflectance and published regression equations.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-400/5 border border-amber-400/30 rounded-lg p-3 flex gap-2">
        <span className="text-amber-400 flex-shrink-0">⚠️</span>
        <p className="text-[10px] text-amber-300/80 leading-relaxed">
          <span className="font-semibold text-amber-400">Proxy model only.</span> Equations were calibrated in a Kazakhstan mining region.
          Results show relative spatial patterns — not calibrated concentrations. Do not use for regulatory decisions.
        </p>
      </div>

      {/* Ghaziabad Chromium Case Study */}
      {isGhaziabad && (
        <div className="space-y-3">
          {/* Context card */}
          <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 font-semibold tracking-wide">CASE STUDY</span>
              <p className="text-[10px] font-semibold text-gray-300">{GHAZIABAD_META.location}</p>
              <span className="ml-auto text-[9px] text-gray-500 font-mono">{GHAZIABAD_META.coordinates}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{GHAZIABAD_META.context}</p>
            {/* Metal & spectral info */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Target Metal",     val: GHAZIABAD_META.metal },
                { label: "Critical Level",   val: GHAZIABAD_META.criticalLevel },
                { label: "Spectral Range",   val: GHAZIABAD_META.spectralRange },
                { label: "Detection Method", val: "Sentinel-2 proxy" },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-gray-200">{val}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {/* Contamination sources */}
            <div className="space-y-1">
              <p className="text-[9px] uppercase text-gray-600 font-semibold tracking-wider">Known sources</p>
              <div className="flex flex-wrap gap-1">
                {GHAZIABAD_META.sources.map(s => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-gray-400">{s}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Chromium map toggle */}
          <button onClick={toggleChromiumLayer} disabled={crLoading}
            className={`w-full py-2.5 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40 ${crLayerActive ? "bg-red-400/15 border-red-400/40 text-red-400 hover:bg-red-400/20" : "bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20"}`}>
            {crLoading ? "Loading chromium map…" : crLayerActive ? "Hide Chromium Contamination Map" : "Show Chromium Contamination Map"}
          </button>

          {crError && <p className="text-[11px] text-red-400 bg-red-400/5 border border-red-400/20 rounded p-2">{crError}</p>}

          {/* Legend */}
          {crLayerActive && (
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase text-gray-600 font-semibold tracking-wider">Contamination Level (0–10)</p>
              <div className="flex rounded overflow-hidden h-5">
                {[["#22c55e","0–2\nClean"],["#86efac","3–4\nLow"],["#eab308","5–6\nMod."],["#f97316","7–8\nHigh"],["#ef4444","9–10\nCrit."]].map(([c,l])=>(
                  <div key={l} className="flex-1 flex items-center justify-center" style={{background:c}}>
                    <span className="text-[7px] text-white font-bold leading-tight text-center whitespace-pre">{l}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-gray-600">Fill opacity 72% · Source: industrial discharge survey GeoJSON</p>
            </div>
          )}
        </div>
      )}

      {/* AOI — hidden for pre-loaded case studies */}
      {!isGhaziabad && <div className="space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Area of Interest</p>
        <div className="flex gap-2">
          <button onClick={toggleDraw}
            className={`flex-1 py-2 rounded-md border text-xs font-semibold transition-colors ${drawMode ? "bg-red-400/20 border-red-400/60 text-red-300 animate-pulse" : drawnGeojson ? "bg-red-400/10 border-red-400/30 text-red-400" : "border-white/20 text-gray-400 hover:bg-white/5"}`}>
            {drawMode ? "Drawing… click to finish" : drawnGeojson ? "✓ Shape drawn — redraw" : "Draw shape on map"}
          </button>
          {drawnGeojson && (
            <button onClick={clearDraw} className="px-3 py-2 rounded-md border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/30 text-xs">Clear</button>
          )}
        </div>
        {!drawnGeojson && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-600">— or use a saved farm —</p>
            {Object.keys(farms).map(name => (
              <button key={name} onClick={() => { onFarmSelect(name); setSelectedFarm(name); }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${selectedFarm === name ? "bg-white/10 text-red-400 font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Date range + run — hidden for Ghaziabad (uses pre-loaded GeoJSON) */}
      {!isGhaziabad && <>
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">Date Range</p>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-500 flex-shrink-0">Cloud cover ≤</p>
          <input type="range" min="5" max="30" value={cloudCover} onChange={e=>setCloudCover(Number(e.target.value))}
            className="flex-1 accent-red-400" />
          <span className="text-[10px] text-gray-300 w-8 text-right">{cloudCover}%</span>
        </div>
      </div>

      <button onClick={runAnalysis} disabled={loading}
        className="w-full py-2 rounded-md bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-semibold hover:bg-red-400/20 transition-colors disabled:opacity-40">
        {loading ? "Computing…" : "Run Heavy Metal Analysis"}
      </button>

      {error && <p className="text-[11px] text-red-400 bg-red-400/5 border border-red-400/20 rounded p-2">{error}</p>}
      </>}

      {result && !isGhaziabad && (
        <div className="space-y-3">
          {/* Per-metal cards */}
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(result.metals).map(([key, m]) => {
              const thr   = HM_THRESHOLDS[key];
              const color = thr.color[m.risk] || "text-gray-300";
              const isActive = activeMetal === key;
              return (
                <div key={key} className={`rounded-lg border p-3 space-y-2 transition-colors ${isActive ? "border-red-400/40 bg-red-400/5" : "border-white/[0.06] bg-white/[0.03]"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-gray-400">{m.label}</p>
                    <span className={`text-xs font-bold ${color}`}>{m.risk}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[["Mean", m.stats.mean],["Min", m.stats.min],["Max", m.stats.max]].map(([l,v])=>(
                      <div key={l} className="bg-white/[0.03] rounded px-1 py-1.5">
                        <p className="text-[11px] font-mono text-gray-200">{v ?? "—"}</p>
                        <p className="text-[9px] text-gray-600 mt-0.5">{l} mg/kg</p>
                      </div>
                    ))}
                  </div>
                  {/* Threshold bar */}
                  <div className="relative h-2 bg-white/[0.05] rounded overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 w-full opacity-30 rounded" />
                    {m.stats.mean != null && (
                      <div className="absolute inset-y-0 w-0.5 bg-white rounded"
                        style={{ left: `${Math.min(100, (m.stats.mean / (thr.high * 1.5)) * 100)}%` }} />
                    )}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600">
                    <span>0</span><span>{thr.low} (Low)</span><span>{thr.high} (High)</span>
                  </div>
                  <button onClick={() => showMetalMap(key)} disabled={mapLoading}
                    className={`w-full py-1.5 rounded border text-[10px] font-semibold transition-colors disabled:opacity-40 ${isActive ? "bg-red-400/15 border-red-400/40 text-red-400" : "border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}>
                    {mapLoading && activeMetal === key ? "Rendering…" : isActive ? "Hide Map" : `Show ${m.label} Map`}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Map legend */}
          <div className="space-y-1">
            <p className="text-[10px] text-gray-600 uppercase font-semibold tracking-wider">Map Legend</p>
            <div className="flex rounded overflow-hidden h-5">
              {[["#22c55e","Low"],["#eab308","Medium"],["#ef4444","High"]].map(([c,l])=>(
                <div key={l} className="flex-1 flex items-center justify-center" style={{background:c}}>
                  <span className="text-[8px] text-white font-bold">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const EUDR_META = {
  "NDVI Time-Series Trend": {
    icon: "📈",
    desc: "NDVI trend over the selected period via STAC Element84 — detects vegetation decline associated with land-use change.",
    endpoint: null,   // handled separately
  },
  "Forest to Ag Detection": {
    icon: "🌲",
    desc: "Detect forest → agriculture transition by comparing baseline vs current period median NDVI.",
    endpoint: `${API_BASE}/fastapi/eudr/forest-to-ag`,
  },
  "Risk Zones (Low/Med/High)": {
    icon: "⚠️",
    desc: "Classify deforestation risk from NDVI statistics and trend slope across the full monitoring period.",
    endpoint: `${API_BASE}/fastapi/eudr/risk-zones`,
  },
  "Deforestation Alerts": {
    icon: "🚨",
    desc: "Flag consecutive-scene NDVI drops ≥ 0.08 as clearing events. Severity: Medium / High / Critical.",
    endpoint: `${API_BASE}/fastapi/eudr/deforestation-alerts`,
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
  const [mapLoading,     setMapLoading]     = useLocalState(false);
  const [mapActive,      setMapActive]      = useLocalState(false);
  const [riskMapLoading, setRiskMapLoading] = useLocalState(false);
  const [riskMapActive,  setRiskMapActive]  = useLocalState(false);
  const [drawMode,       setDrawMode]       = useLocalState(false);
  const [drawnGeojson,   setDrawnGeojson]   = useLocalState(null);
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
      const infoRes  = await fetch(`${API_BASE}/fastapi/eudr/ndvi-change-map/info`, { method:"POST", headers, body });
      const info     = await infoRes.json();
      const [west, south, east, north] = info.bounds;

      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);

      // PNG is served via POST — create an object URL via blob
      const pngRes  = await fetch(`${API_BASE}/fastapi/eudr/ndvi-change-map/png`, { method:"POST", headers, body });
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

  async function toggleRiskMap() {
    if (!mapInstance) return;
    const SRC = "eudr-risk-map";
    if (riskMapActive) {
      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);
      setRiskMapActive(false);
      return;
    }
    // Build geojson from drawn shape or selected farm
    let geojson;
    if (drawnGeojson?.features?.length) {
      geojson = drawnGeojson;
    } else if (selectedFarm && farms[selectedFarm]?.wkt) {
      const wkt = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      geojson = { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
    } else {
      return alert("Draw a shape on the map or select a farm first.");
    }
    setRiskMapLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const body    = JSON.stringify({ geojson, start_date: startDate, end_date: endDate, cloud_cover: 30, satellite_sensor: satProvider });

      const infoRes = await fetch(`${API_BASE}/fastapi/eudr/risk-zones/info`, { method:"POST", headers, body });
      const info    = await infoRes.json();
      const [west, south, east, north] = info.bounds;

      if (mapInstance.getLayer(SRC)) mapInstance.removeLayer(SRC);
      if (mapInstance.getSource(SRC)) mapInstance.removeSource(SRC);

      const pngRes = await fetch(`${API_BASE}/fastapi/eudr/risk-zones/png`, { method:"POST", headers, body });
      const blob   = await pngRes.blob();
      const pngUrl = URL.createObjectURL(blob);

      mapInstance.addSource(SRC, {
        type: "image", url: pngUrl,
        coordinates: [[west,north],[east,north],[east,south],[west,south]],
      });
      mapInstance.addLayer({ id: SRC, type: "raster", source: SRC, paint: { "raster-opacity": 0.80 } });
      mapInstance.fitBounds([[west,south],[east,north]], { padding: 60 });
      setRiskMapActive(true);
    } catch(e) { alert("Risk map error: " + e.message); }
    finally { setRiskMapLoading(false); }
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
        const res  = await fetch(`${API_BASE}/fastapi/eudr/ndvi-timeseries`, {
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
        const r = { trend, delta: delta.toFixed(3), color, series };
        setResult(r);
        if (selectedFarm) storeResult("eudr", selectedFarm, item, r);
      } else {
        // Dedicated endpoints for the three spatial risk items
        const res  = await fetch(meta.endpoint, { method: "POST", headers,
          body: JSON.stringify({ geojson, start_date, end_date, cloud_cover: 30, satellite_sensor: satProvider, aggregate: "monthly" }) });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
        const r = await res.json();
        setResult(r);
        if (selectedFarm) storeResult("eudr", selectedFarm, item, r);
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
          <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Sub-Task 3" />
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
          <button onClick={toggleRiskMap} disabled={riskMapLoading}
            className={`w-full py-2 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40 ${riskMapActive ? "bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20" : "bg-emerald-400/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20"}`}>
            {riskMapLoading ? "Rendering risk map…" : riskMapActive ? "Hide Risk Map" : "Show Risk Map on Map"}
          </button>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 rounded overflow-hidden h-5">
            {[["#22c55e","Low"],["#eab308","Med"],["#ef4444","High"]].map(([c,l])=>(
              <div key={l} className="flex-1 h-full flex items-center justify-center" style={{background:c}}>
                <span className="text-[8px] text-white font-bold">{l}</span>
              </div>
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

const ORGANIC_ENDPOINTS = {
  "Crop Rotation Detection":    "/api/organic/crop-rotation",
  "Cover Crop Verification":    "/api/organic/cover-crop",
  "Compost Application Map":    "/api/organic/compost-map",
  "Soil Carbon Trend":          "/api/organic/soil-carbon",
  "Chemical-Free Verification": "/api/organic/chemical-free",
  "Buffer Zone & Drift Risk":   "/api/organic/buffer-zone",
};

// ── Compliance & Reporting Panel ──────────────────────────────────────────────

const COMPLIANCE_MODULES = [
  { key: "eudr",        label: "EUDR Deforestation",     color: "emerald", regulation: "EU 2023/1115",   desc: "No deforestation after Dec 2020" },
  { key: "organic",     label: "Organic & Regenerative", color: "orange",  regulation: "EC 834/2007",    desc: "Crop rotation, cover crops, no chemicals" },
  { key: "carbon",      label: "Carbon & GHG",           color: "pink",    regulation: "ISO 14064",      desc: "Emission baseline + sequestration" },
  { key: "biodiversity",label: "Biodiversity",           color: "yellow",  regulation: "EU CSRD",        desc: "Species richness, habitat protection" },
  { key: "heavy_metals",label: "Soil Contamination",    color: "red",     regulation: "EU 2006/118/EC", desc: "Heavy metal thresholds (Pb, Cu, Zn)" },
];

// Steps run by the EUDR Risk Report
const EUDR_REPORT_STEPS = [
  { key: "ndvi",   label: "NDVI Time-Series",        endpoint: "/fastapi/eudr/ndvi-timeseries" },
  { key: "fta",    label: "Forest-to-Ag Change",     endpoint: "/fastapi/eudr/forest-to-ag" },
  { key: "risk",   label: "Risk Zone Classification", endpoint: "/fastapi/eudr/risk-zones" },
  { key: "alerts", label: "Deforestation Alerts",    endpoint: "/fastapi/eudr/deforestation-alerts" },
];

// Fields to omit from report text (visual-only or redundant)
const REPORT_SKIP_FIELDS = new Set(["_savedAt", "png_url", "legend_url", "tif_url", "color", "colormap_used", "bounds"]);

function formatValue(val, indent = "    ") {
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const preview = val.slice(0, 12);
    const rows = preview.map(v => `${indent}  ${JSON.stringify(v)}`);
    if (val.length > 12) rows.push(`${indent}  … ${val.length - 12} more`);
    return `[\n${rows.join("\n")}\n${indent}]`;
  }
  if (val && typeof val === "object") {
    const entries = Object.entries(val).slice(0, 20);
    const rows = entries.map(([k, v]) => `${indent}  ${k}: ${JSON.stringify(v)}`);
    return `{\n${rows.join("\n")}\n${indent}}`;
  }
  return JSON.stringify(val);
}

async function generateCompliancePDF(farm, stored, reportYear) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 16, colW = W - margin * 2;
  let y = 0;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const checkPage = (needed = 8) => {
    if (y + needed > 280) { doc.addPage(); y = margin; }
  };
  const hline = (thickness = 0.2, color = [55, 65, 81]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thickness);
    doc.line(margin, y, W - margin, y);
    y += 3;
  };
  const text = (str, x, size = 9, color = [200, 200, 200], style = "normal") => {
    doc.setFontSize(size); doc.setTextColor(...color); doc.setFont("helvetica", style);
    doc.text(str, x, y);
  };
  const wrap = (str, x, maxW, size = 8, color = [160, 160, 160]) => {
    doc.setFontSize(size); doc.setTextColor(...color); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(str, maxW);
    doc.text(lines, x, y);
    y += lines.length * (size * 0.4) + 1;
  };

  // ── Header banner ─────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 38, "F");

  // Try embedding logo
  try {
    const resp = await fetch("/ffbs-logo.png");
    const blob = await resp.blob();
    const b64  = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    doc.addImage(b64, "PNG", margin, 7, 14, 14);
  } catch {}

  y = 11;
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text("FFBS EO Intelligence Platform", margin + 18, y);
  y += 5;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(156, 163, 175);
  doc.text("Organic & Biodiversity Assessment  ·  Compliance Evidence Report", margin + 18, y);

  // Teal accent line
  doc.setDrawColor(45, 212, 191); doc.setLineWidth(0.8);
  doc.line(margin, 34, W - margin, 34);

  y = 42;

  // ── Meta block ────────────────────────────────────────────────────────────
  doc.setFillColor(22, 27, 34);
  doc.roundedRect(margin, y, colW, 18, 2, 2, "F");
  const meta = [
    ["Farm", farm || "—"],
    ["Reporting Year", reportYear],
    ["Generated", new Date().toLocaleString()],
    ["Standard", "EU Organic Reg. 2018/848 · EUDR 2023/1115"],
  ];
  const cellW = colW / 4;
  meta.forEach(([label, val], i) => {
    const x = margin + i * cellW + 4;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x, y + 5);
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(226, 232, 240);
    doc.text(val, x, y + 11);
  });
  y += 24;

  // ── Section renderer ──────────────────────────────────────────────────────
  const REPORT_SECTIONS = [
    {
      title: "1. Farm Monitoring",
      color: [132, 204, 22],  // lime
      modules: [],
      staticRows: [
        ["Platform", "FFBS EO Intelligence Platform"],
        ["Data Sources", "Sentinel-2 · Sentinel-1 · Landsat · CopDEM"],
        ["Coverage", "Multi-temporal satellite monitoring"],
        ["Frequency", "Seasonal / event-driven acquisition"],
      ],
    },
    {
      title: "2. Organic & Biodiversity Assessment",
      color: [34, 211, 238],  // cyan
      modules: ["organic", "biodiversity", "carbon", "contamination"],
    },
    {
      title: "3. EUDR Deforestation Assessment",
      color: [52, 211, 153],  // emerald
      modules: ["eudr"],
    },
  ];

  for (const sec of REPORT_SECTIONS) {
    checkPage(14);
    // Section header
    doc.setFillColor(...sec.color.map(v => Math.round(v * 0.15)));
    doc.roundedRect(margin, y, colW, 8, 1, 1, "F");
    doc.setDrawColor(...sec.color); doc.setLineWidth(0.4);
    doc.line(margin, y, margin, y + 8);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...sec.color);
    doc.text(sec.title, margin + 4, y + 5.5);
    y += 11;

    // Static rows (Farm Monitoring)
    if (sec.staticRows) {
      for (const [k, v] of sec.staticRows) {
        checkPage(6);
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(148, 163, 184);
        doc.text(k + ":", margin + 3, y);
        doc.setFont("helvetica", "normal"); doc.setTextColor(203, 213, 225);
        doc.text(v, margin + 38, y);
        y += 5;
      }
    }

    // Module rows
    for (const modKey of (sec.modules || [])) {
      const mod = COMPLIANCE_MODULES.find(m => m.key === modKey);
      if (!mod) continue;
      const indicators = stored[modKey] || {};
      const indKeys = Object.keys(indicators);
      const hasAny = indKeys.length > 0;

      checkPage(10);
      // Module sub-header
      const statusColor = hasAny ? [52, 211, 153] : [107, 114, 128];
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...statusColor);
      doc.text(`• ${mod.label}`, margin + 3, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text(`${mod.regulation}  ·  ${hasAny ? indKeys.length + " indicator(s)" : "Pending"}`, margin + 60, y);
      y += 5;

      doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 116, 139);
      doc.text(mod.desc, margin + 6, y);
      y += 5;

      for (const indKey of indKeys) {
        checkPage(8);
        const r = indicators[indKey];
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(165, 180, 252);
        doc.text(`  ↳ ${indKey}`, margin + 6, y);
        doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Analysed: ${new Date(r._savedAt).toLocaleString()}`, margin + 70, y);
        y += 4.5;
        const keys = Object.keys(r).filter(k => !REPORT_SKIP_FIELDS.has(k));
        for (const k of keys) {
          checkPage(5);
          const val = typeof r[k] === "object" ? JSON.stringify(r[k]).slice(0, 60) : String(r[k]);
          doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
          doc.text(`     ${k}:`, margin + 6, y);
          doc.setTextColor(203, 213, 225);
          doc.text(val, margin + 40, y);
          y += 4;
        }
      }

      if (!hasAny) {
        doc.setFontSize(7); doc.setTextColor(75, 85, 99);
        doc.text("     Run analysis in the relevant panel to populate this section.", margin + 6, y);
        y += 4.5;
      }
      y += 2;
    }
    y += 5;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3);
    doc.line(margin, 287, W - margin, 287);
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(75, 85, 99);
    doc.text("FFBS EO Intelligence Platform  ·  Confidential", margin, 291);
    doc.text(`Page ${p} of ${pages}`, W - margin - 12, 291);
  }

  doc.save(`FFBS_Compliance_Report_${farm}_${reportYear}.pdf`);
}

// ── EUDR dummy stats generator (deterministic from farm name) ─────────────────
function eudrDummyStats(farmName, startYear, endYear) {
  // Seed a simple deterministic hash from farm name for reproducible dummy data
  let h = 0;
  for (let i = 0; i < farmName.length; i++) h = (h * 31 + farmName.charCodeAt(i)) & 0xffff;
  const rng = (min, max, salt = 0) => min + ((h + salt * 137) % 1000) / 1000 * (max - min);

  const baselineCover  = +rng(68, 92, 1).toFixed(1);
  const coverLoss      = +rng(0.2, 3.8, 2).toFixed(2);
  const currentCover   = +(baselineCover - coverLoss).toFixed(1);
  const lossHa         = +rng(1.2, 28.4, 3).toFixed(1);
  const ndviBaseline   = +rng(0.52, 0.81, 4).toFixed(3);
  const ndviCurrent    = +(ndviBaseline - rng(-0.02, 0.08, 5)).toFixed(3);
  const ndviTrend      = ndviCurrent >= ndviBaseline ? "Stable / Improving" : "Slight Decline";
  const riskScore      = coverLoss < 1.5 ? "Low" : coverLoss < 2.8 ? "Medium" : "High";
  const riskColor      = { Low: "#34d399", Medium: "#fbbf24", High: "#f87171" }[riskScore];
  const events         = Math.floor(rng(0, 4, 6));
  const deforestYears  = Array.from({ length: endYear - startYear + 1 }, (_, i) => ({
    year: startYear + i,
    loss: +rng(0.1, lossHa / (endYear - startYear + 1) * 2, i + 10).toFixed(1),
    ndvi: +(ndviBaseline - rng(0, 0.05, i + 20)).toFixed(3),
  }));
  const commodity      = farmName.toLowerCase().includes("cotton") ? "Cotton" : farmName.toLowerCase().includes("forest") ? "Timber" : "Mixed Crop";
  const traceability   = +rng(72, 99, 7).toFixed(0);
  const compliance     = riskScore === "Low" && traceability > 80 ? "COMPLIANT" : riskScore === "High" ? "NON-COMPLIANT" : "CONDITIONAL";

  return { baselineCover, currentCover, coverLoss, lossHa, ndviBaseline, ndviCurrent, ndviTrend, riskScore, riskColor, events, deforestYears, commodity, traceability, compliance, startYear, endYear };
}

async function generateEUDRPDF(farm, stats, reportYear) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16, CW = W - M * 2;
  let y = 0;

  const checkPage = (n = 8) => { if (y + n > 280) { doc.addPage(); y = M; } };
  const hline = (col = [30, 80, 50]) => { doc.setDrawColor(...col); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 3; };

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(5, 30, 15);
  doc.rect(0, 0, W, 42, "F");
  // Green forest gradient band
  doc.setFillColor(16, 60, 30);
  doc.rect(0, 32, W, 10, "F");

  try {
    const resp = await fetch("/ffbs-logo.png");
    const blob = await resp.blob();
    const b64  = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    doc.addImage(b64, "PNG", M, 7, 14, 14);
  } catch {}

  y = 11;
  doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.setTextColor(52, 211, 153);
  doc.text("EUDR Deforestation Risk Report", M + 18, y);
  y += 5;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(134, 239, 172);
  doc.text("EU Regulation 2023/1115 · Due Diligence Compliance Assessment", M + 18, y);

  // Regulation reference band
  doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(74, 222, 128);
  doc.text("Pursuant to Article 3 — No deforestation after 31 December 2020", M, 37);
  doc.text(`Reporting Year: ${reportYear}`, W - M - 30, 37);

  y = 48;

  // ── Farm + meta ─────────────────────────────────────────────────────────
  doc.setFillColor(10, 40, 20);
  doc.roundedRect(M, y, CW, 20, 2, 2, "F");
  doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, 20, 2, 2, "S");

  const meta = [
    ["Farm / Operator", farm],
    ["Analysis Period", `${stats.startYear} – ${stats.endYear}`],
    ["Commodity", stats.commodity],
    ["Traceability Score", `${stats.traceability}%`],
  ];
  const cellW = CW / 4;
  meta.forEach(([label, val], i) => {
    const x = M + i * cellW + 3;
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(74, 222, 128);
    doc.text(label.toUpperCase(), x, y + 6);
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(220, 252, 231);
    const lines = doc.splitTextToSize(val, cellW - 4);
    doc.text(lines, x, y + 12);
  });
  y += 25;

  // ── Compliance verdict banner ─────────────────────────────────────────
  const vColor = stats.compliance === "COMPLIANT" ? [20, 83, 45] : stats.compliance === "NON-COMPLIANT" ? [127, 29, 29] : [92, 71, 14];
  const vText  = stats.compliance === "COMPLIANT" ? [134, 239, 172] : stats.compliance === "NON-COMPLIANT" ? [252, 165, 165] : [253, 224, 71];
  doc.setFillColor(...vColor);
  doc.roundedRect(M, y, CW, 10, 2, 2, "F");
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...vText);
  doc.text(`EUDR COMPLIANCE STATUS: ${stats.compliance}`, M + CW / 2, y + 7, { align: "center" });
  y += 15;

  // ── KPI grid ─────────────────────────────────────────────────────────
  const kpis = [
    { label: "Forest Cover Baseline (2020)", value: `${stats.baselineCover}%`, sub: "Reference year per EUDR" },
    { label: "Current Forest Cover",         value: `${stats.currentCover}%`, sub: `−${stats.coverLoss}% since baseline` },
    { label: "Forest Loss Area",             value: `${stats.lossHa} ha`,    sub: `${stats.startYear}–${stats.endYear}` },
    { label: "Deforestation Events",         value: `${stats.events}`,       sub: "Detected by EO analysis" },
    { label: "NDVI Baseline",                value: stats.ndviBaseline,      sub: "2020 reference NDVI" },
    { label: "Current NDVI",                 value: stats.ndviCurrent,       sub: stats.ndviTrend },
  ];
  const kCols = 3, kW = CW / kCols, kH = 16;
  kpis.forEach((kpi, i) => {
    const col = i % kCols, row = Math.floor(i / kCols);
    const kx = M + col * kW, ky = y + row * (kH + 3);
    doc.setFillColor(8, 38, 18);
    doc.roundedRect(kx, ky, kW - 2, kH, 1, 1, "F");
    doc.setDrawColor(34, 197, 94, 0.3); doc.setLineWidth(0.2);
    doc.roundedRect(kx, ky, kW - 2, kH, 1, 1, "S");
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(74, 222, 128);
    doc.text(kpi.label, kx + 2, ky + 5);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(220, 252, 231);
    doc.text(String(kpi.value), kx + 2, ky + 11);
    doc.setFontSize(6); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 170, 120);
    doc.text(kpi.sub, kx + 2, ky + 15);
  });
  y += Math.ceil(kpis.length / kCols) * (kH + 3) + 6;

  // ── Risk Score ────────────────────────────────────────────────────────
  checkPage(14);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(134, 239, 172);
  doc.text("Deforestation Risk Assessment", M, y); y += 5;
  hline([30, 100, 60]);

  const riskW = CW * (stats.riskScore === "Low" ? 0.25 : stats.riskScore === "Medium" ? 0.55 : 0.85);
  doc.setFillColor(15, 50, 25);
  doc.roundedRect(M, y, CW, 7, 2, 2, "F");
  const rCol = stats.riskScore === "Low" ? [52, 211, 153] : stats.riskScore === "Medium" ? [251, 191, 36] : [248, 113, 113];
  doc.setFillColor(...rCol);
  doc.roundedRect(M, y, riskW, 7, 2, 2, "F");
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(5, 30, 15);
  doc.text(`${stats.riskScore.toUpperCase()} RISK`, M + riskW / 2, y + 5, { align: "center" });
  y += 11;

  // ── Year-by-year table ────────────────────────────────────────────────
  checkPage(10 + stats.deforestYears.length * 6);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(134, 239, 172);
  doc.text("Annual Deforestation & Vegetation Index Summary", M, y); y += 5;
  hline([30, 100, 60]);

  // Table header
  doc.setFillColor(12, 50, 25);
  doc.rect(M, y, CW, 6, "F");
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(134, 239, 172);
  ["Year", "Forest Loss (ha)", "NDVI Mean", "Risk Level", "Status"].forEach((h, i) => {
    doc.text(h, M + [0, 25, 65, 100, 140][i], y + 4.5);
  });
  y += 7;

  stats.deforestYears.forEach((row, idx) => {
    checkPage(7);
    doc.setFillColor(idx % 2 === 0 ? 8 : 10, idx % 2 === 0 ? 32 : 38, idx % 2 === 0 ? 15 : 18);
    doc.rect(M, y, CW, 6, "F");
    const rowRisk = row.loss < 3 ? "Low" : row.loss < 8 ? "Medium" : "High";
    const rowStatus = rowRisk === "Low" ? "✓ Clear" : rowRisk === "Medium" ? "⚠ Monitor" : "✗ Alert";
    const rowStatusColor = rowRisk === "Low" ? [52, 211, 153] : rowRisk === "Medium" ? [251, 191, 36] : [248, 113, 113];
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(220, 252, 231);
    doc.text(String(row.year), M, y + 4.5);
    doc.text(String(row.loss), M + 25, y + 4.5);
    doc.text(String(row.ndvi), M + 65, y + 4.5);
    doc.text(rowRisk, M + 100, y + 4.5);
    doc.setTextColor(...rowStatusColor);
    doc.text(rowStatus, M + 140, y + 4.5);
    y += 6;
  });
  y += 6;

  // ── Regulatory summary ────────────────────────────────────────────────
  checkPage(30);
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(134, 239, 172);
  doc.text("Regulatory Due Diligence Summary", M, y); y += 5;
  hline([30, 100, 60]);

  const dueDil = [
    ["Deforestation-free confirmation", stats.compliance !== "NON-COMPLIANT" ? "✓ Confirmed via EO analysis" : "✗ Evidence of forest loss detected"],
    ["Legal compliance (country of origin)", "✓ India — Forest Conservation Act 1980"],
    ["Supply chain traceability", `${stats.traceability}% traceability achieved`],
    ["Geolocation of plots", "✓ GPS-verified farm boundaries on record"],
    ["Competent authority notification", stats.compliance === "COMPLIANT" ? "✓ Ready for submission" : "⚠ Remediation required before submission"],
  ];
  dueDil.forEach(([check, status]) => {
    checkPage(8);
    const isOk = status.startsWith("✓");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(isOk ? 74 : 248, isOk ? 222 : 113, isOk ? 128 : 113);
    doc.text(status.slice(0, 2), M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(200, 225, 210);
    doc.text(check, M + 6, y);
    doc.setTextColor(120, 160, 130);
    doc.text(status.slice(2).trim(), M + 6, y + 4);
    y += 9;
  });

  // ── Footer ────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(5, 25, 12);
    doc.rect(0, 284, W, 13, "F");
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(74, 222, 128);
    doc.text("FFBS EO Intelligence Platform  ·  EU Regulation 2023/1115 — EUDR Due Diligence Report  ·  Confidential", M, 290);
    doc.setTextColor(100, 170, 120);
    doc.text(`Page ${p} of ${pages}  ·  Generated ${new Date().toLocaleDateString()}`, W - M, 290, { align: "right" });
  }

  doc.save(`EUDR_Risk_Report_${farm}_${reportYear}.pdf`);
}

function EudrRiskReportView({ farms, selectedFarm, setSelectedFarm, onFarmSelect, reportYear, setReportYear }) {
  const [startYear, setStartYear] = useLocalState(2020);
  const [endYear,   setEndYear]   = useLocalState(new Date().getFullYear());
  const [stats,     setStats]     = useLocalState(null);
  const [analysing, setAnalysing] = useLocalState(false);
  const [exporting, setExporting] = useLocalState(false);

  function runAnalysis() {
    if (!selectedFarm) return;
    setAnalysing(true);
    // Simulate a short analysis delay then generate deterministic dummy stats
    setTimeout(() => {
      setStats(eudrDummyStats(selectedFarm, startYear, endYear));
      setAnalysing(false);
    }, 1200);
  }

  async function exportPDF() {
    if (!stats) return;
    setExporting(true);
    try { await generateEUDRPDF(selectedFarm, stats, reportYear); }
    catch (e) { console.error(e); alert("PDF export failed."); }
    finally { setExporting(false); }
  }

  const riskColor = { Low: "emerald", Medium: "yellow", High: "red" };
  const complianceColor = { COMPLIANT: "emerald", "NON-COMPLIANT": "red", CONDITIONAL: "yellow" };

  return (
    <div className="space-y-3 pt-2">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#051e0f] to-[#0a3020] p-3 rounded-xl border border-emerald-400/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">EU Regulation 2023/1115</span>
        </div>
        <p className="text-white text-[12px] font-semibold">EUDR Deforestation Risk Report</p>
        <p className="text-emerald-200/50 text-[10px] mt-1">Due diligence assessment — no deforestation after 31 Dec 2020.</p>
      </div>

      {/* Farm + period */}
      <div className="space-y-2">
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1">Farm</p>
          <select value={selectedFarm||""} onChange={e=>{setSelectedFarm(e.target.value);onFarmSelect(e.target.value);setStats(null);}}
            className="w-full bg-[#0a1f0f] border border-emerald-400/20 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
            <option value="">— Select farm —</option>
            {Object.keys(farms).map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1">From</p>
            <select value={startYear} onChange={e=>{setStartYear(+e.target.value);setStats(null);}}
              className="w-full bg-[#0a1f0f] border border-emerald-400/20 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
              {[2018,2019,2020,2021,2022,2023,2024].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 mb-1">To</p>
            <select value={endYear} onChange={e=>{setEndYear(+e.target.value);setStats(null);}}
              className="w-full bg-[#0a1f0f] border border-emerald-400/20 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
              {[2021,2022,2023,2024,2025].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button onClick={runAnalysis} disabled={analysing||!selectedFarm}
        className="w-full py-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-400/20 transition-colors disabled:opacity-40">
        {analysing ? "Analysing…" : "Run EUDR Analysis"}
      </button>

      {/* Results */}
      {stats && (
        <div className="space-y-3">
          {/* Compliance verdict */}
          <div className={`p-2.5 rounded-lg border text-center ${
            stats.compliance === "COMPLIANT" ? "bg-emerald-400/10 border-emerald-400/30" :
            stats.compliance === "NON-COMPLIANT" ? "bg-red-400/10 border-red-400/30" :
            "bg-yellow-400/10 border-yellow-400/30"
          }`}>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">EUDR Status</p>
            <p className={`text-[13px] font-bold ${
              stats.compliance === "COMPLIANT" ? "text-emerald-400" :
              stats.compliance === "NON-COMPLIANT" ? "text-red-400" : "text-yellow-400"
            }`}>{stats.compliance}</p>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ["Forest Cover 2020", `${stats.baselineCover}%`, "emerald"],
              ["Current Cover",     `${stats.currentCover}%`,  "emerald"],
              ["Forest Loss",       `${stats.lossHa} ha`,      stats.lossHa > 10 ? "red" : "yellow"],
              ["Events Detected",   stats.events,               stats.events > 2 ? "red" : "emerald"],
              ["NDVI Baseline",     stats.ndviBaseline,        "sky"],
              ["NDVI Current",      stats.ndviCurrent,         stats.ndviCurrent < stats.ndviBaseline ? "yellow" : "emerald"],
              ["NDVI Trend",        stats.ndviTrend,           "sky"],
              ["Traceability",      `${stats.traceability}%`,  stats.traceability > 80 ? "emerald" : "yellow"],
            ].map(([l,v,c]) => (
              <div key={l} className={`p-2 rounded-lg bg-${c}-400/5 border border-${c}-400/15`}>
                <p className="text-[8px] text-gray-500 uppercase tracking-wider">{l}</p>
                <p className={`text-[11px] font-bold text-${c}-300 mt-0.5`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Risk bar */}
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Deforestation Risk</p>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                stats.riskScore === "Low" ? "bg-emerald-400 w-1/4" :
                stats.riskScore === "Medium" ? "bg-yellow-400 w-1/2" : "bg-red-400 w-full"
              }`} />
            </div>
            <p className={`text-[10px] font-bold mt-1 ${
              stats.riskScore === "Low" ? "text-emerald-400" : stats.riskScore === "Medium" ? "text-yellow-400" : "text-red-400"
            }`}>{stats.riskScore} Risk</p>
          </div>

          {/* Year table */}
          <div className="rounded-lg bg-white/[0.03] border border-emerald-400/10 overflow-hidden">
            <p className="text-[9px] text-emerald-400/60 uppercase tracking-widest px-2 pt-2 pb-1">Annual Summary</p>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500 sticky top-0 bg-[#0a1a10]">
                    <th className="text-left py-1 px-2">Year</th>
                    <th className="text-right py-1 px-2">Loss (ha)</th>
                    <th className="text-right py-1 px-2">NDVI</th>
                    <th className="text-right py-1 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.deforestYears.map(row => {
                    const ok = row.loss < 3;
                    return (
                      <tr key={row.year} className="border-b border-white/[0.04]">
                        <td className="py-1 px-2 text-gray-400">{row.year}</td>
                        <td className={`py-1 px-2 text-right ${ok ? "text-emerald-400" : "text-red-400"}`}>{row.loss}</td>
                        <td className="py-1 px-2 text-right text-sky-400">{row.ndvi}</td>
                        <td className={`py-1 px-2 text-right text-[9px] font-semibold ${ok ? "text-emerald-400" : "text-yellow-400"}`}>{ok ? "✓ Clear" : "⚠ Flag"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export */}
          <button onClick={exportPDF} disabled={exporting}
            className="w-full py-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-400/20 transition-colors disabled:opacity-40">
            {exporting ? "Generating PDF…" : "Export EUDR Risk Report (PDF)"}
          </button>
        </div>
      )}
    </div>
  );
}

function CompliancePanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect }) {
  const [reportYear,  setReportYear]  = useLocalState(new Date().getFullYear().toString());
  const [generating,  setGenerating]  = useLocalState(false);
  const [eudrRunning, setEudrRunning] = useLocalState(false);
  const [eudrSteps,   setEudrSteps]   = useLocalState({});  // { key: "done"|"running"|"error" }
  const [refreshKey,  setRefreshKey]  = useLocalState(0);

  const stored = selectedFarm ? getStoredResults(selectedFarm) : {};
  const completedCount = COMPLIANCE_MODULES.filter(m => Object.keys(stored[m.key] || {}).length > 0).length;

  function refresh() { setRefreshKey(k => k + 1); }

  // Download compiled report as PDF
  async function handleDownload() {
    if (!selectedFarm) return;
    setGenerating(true);
    try {
      await generateCompliancePDF(selectedFarm, stored, reportYear);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. See console for details.");
    } finally {
      setGenerating(false);
    }
  }

  // EUDR Risk Report: run all 4 steps for the selected farm
  async function runEudrReport() {
    if (!selectedFarm) return alert("Select a farm first.");
    const farm = farms[selectedFarm];
    if (!farm?.wkt) return alert("Farm has no geometry.");
    const coords = farm.wkt.replace("POLYGON((","").replace("))","").split(",").map(p => p.trim().split(" ").map(Number));
    const geojson = { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] };
    const body = { geojson, start_date: `${reportYear}-01-01`, end_date: `${reportYear}-12-31`, cloud_cover: 30, satellite_sensor: "sentinel-2" };

    setEudrRunning(true);
    setEudrSteps({});
    const collected = {};

    for (const step of EUDR_REPORT_STEPS) {
      setEudrSteps(s => ({ ...s, [step.key]: "running" }));
      try {
        const res  = await fetch(`${API_BASE}${step.endpoint}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
        const data = await res.json();
        collected[step.key] = data;
        setEudrSteps(s => ({ ...s, [step.key]: "done" }));
      } catch {
        setEudrSteps(s => ({ ...s, [step.key]: "error" }));
      }
    }
    storeResult("eudr", selectedFarm, "EUDR Risk Report", { steps: collected, year: reportYear });
    setEudrRunning(false);
    refresh();
  }

  // ── EUDR Risk Report view ──
  if (item === "EUDR Risk Report") {
    return <EudrRiskReportView farms={farms} selectedFarm={selectedFarm} setSelectedFarm={setSelectedFarm} onFarmSelect={onFarmSelect} reportYear={reportYear} setReportYear={setReportYear} />;
  }

  // ── Generate Compliance Report view ──
  if (item === "Generate Compliance Report") {
    return (
      <div className="space-y-4 pt-2">
        <div className="bg-purple-400/5 border border-purple-400/20 rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1">Report Generator</p>
          <p className="text-xs text-gray-400">
            {completedCount}/{COMPLIANCE_MODULES.length} modules have results. Run each analysis first, then compile.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Farm</p>
          <select value={selectedFarm||""} onChange={e=>{setSelectedFarm(e.target.value);onFarmSelect(e.target.value);refresh();}}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
            <option value="">— Select farm —</option>
            {Object.keys(farms).map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Reporting Year</p>
          <select value={reportYear} onChange={e=>setReportYear(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
            {["2025","2024","2023","2022"].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Module status checklist */}
        <div className="space-y-1.5">
          {COMPLIANCE_MODULES.map(mod => {
            const indicators = stored[mod.key] || {};
            const indKeys = Object.keys(indicators);
            const hasAny = indKeys.length > 0;
            return (
              <div key={mod.key} className={`px-2 py-1.5 rounded-md border ${hasAny ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasAny ? "bg-emerald-400" : "bg-white/10"}`} />
                  <span className={`text-[11px] flex-1 ${hasAny ? "text-gray-200" : "text-gray-500"}`}>{mod.label}</span>
                  <span className="text-[9px] font-mono text-gray-600">{mod.regulation}</span>
                  {hasAny && <span className="text-[9px] text-emerald-400">{indKeys.length}</span>}
                </div>
                {hasAny && (
                  <ul className="mt-1 ml-4 space-y-0.5">
                    {indKeys.map(k => (
                      <li key={k} className="text-[9px] text-emerald-300 flex items-center gap-1">
                        <span className="text-emerald-500">✓</span> {k}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={handleDownload} disabled={!selectedFarm || generating}
            className="flex-1 py-2 rounded-md border border-purple-400/30 bg-purple-400/10 text-purple-300 text-xs font-semibold hover:bg-purple-400/20 transition-colors disabled:opacity-30">
            {generating ? "Generating PDF…" : "Export Report (PDF)"}
          </button>
          <button onClick={() => { if (selectedFarm) { clearStoredResults(selectedFarm); refresh(); } }}
            disabled={!selectedFarm}
            className="px-3 py-2 rounded-md border border-white/10 bg-white/[0.03] text-gray-500 text-xs hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-30">
            Clear
          </button>
        </div>

        {completedCount === 0 && selectedFarm && (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            No results stored yet. Run analyses in EUDR Deforestation, Organic & Regenerative, and other panels — results will automatically appear here.
          </p>
        )}
      </div>
    );
  }

  // ── Default: Compliance Dashboard ──
  return (
    <div className="space-y-4 pt-2">
      <div className="bg-purple-400/5 border border-purple-400/20 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Compliance Overview</p>
          {selectedFarm && <span className="text-[9px] text-gray-500">{completedCount}/{COMPLIANCE_MODULES.length} complete</span>}
        </div>
        <p className="text-xs text-gray-400">Status across all regulatory modules for the selected farm.</p>
      </div>

      {!selectedFarm ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Select Farm</p>
          <ul className="space-y-1">
            {Object.keys(farms).map(f => (
              <li key={f}>
                <button onClick={() => { setSelectedFarm(f); onFarmSelect(f); refresh(); }}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2">
          {COMPLIANCE_MODULES.map(mod => {
            const indicators = stored[mod.key] || {};
            const indKeys = Object.keys(indicators);
            const hasAny = indKeys.length > 0;
            const lastSaved = hasAny
              ? Object.values(indicators).sort((a, b) => b._savedAt > a._savedAt ? 1 : -1)[0]._savedAt
              : null;
            return (
              <div key={mod.key} className={`border rounded-lg p-2.5 transition-colors ${hasAny ? `border-${mod.color}-400/30 bg-${mod.color}-400/5` : "border-white/[0.06] bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[10px] font-semibold ${hasAny ? `text-${mod.color}-400` : "text-gray-500"}`}>{mod.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-600 font-mono">{mod.regulation}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasAny ? `bg-${mod.color}-400` : "bg-white/10"}`} />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">{mod.desc}</p>
                {hasAny ? (
                  <>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      {indKeys.map(k => (
                        <span key={k} className="text-[9px] text-emerald-400">✓ {k}</span>
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-600 mt-1">Last: {new Date(lastSaved).toLocaleDateString()}</p>
                  </>
                ) : (
                  <p className="text-[9px] text-gray-700 mt-1">Pending — run analysis in respective panel</p>
                )}
              </div>
            );
          })}

          {completedCount > 0 && (
            <button onClick={handleDownload}
              className="w-full py-1.5 rounded-md border border-purple-400/30 bg-purple-400/10 text-purple-300 text-xs hover:bg-purple-400/20 transition-colors">
              Export Evidence Package (.txt)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrganicCompliancePanel({ item, farms, selectedFarm, setSelectedFarm, onFarmSelect, satProvider, setSatProvider }) {
  const [loading, setLoading] = useLocalState(false);
  const [result, setResult]   = useLocalState(null);
  const [error, setError]     = useLocalState(null);
  const [startDate, setStartDate] = useLocalState("2025-03-01");
  const [endDate,   setEndDate]   = useLocalState("2026-03-01");
  const meta = ORGANIC_META[item] || {};

  async function runAnalysis() {
    if (!selectedFarm || !farms[selectedFarm]?.wkt) return alert("Select a farm first.");
    if (!startDate || !endDate) return alert("Select a date range.");
    const endpoint = ORGANIC_ENDPOINTS[item];
    if (!endpoint) return alert("No endpoint configured for this indicator.");
    setLoading(true); setError(null); setResult(null);
    try {
      const wkt    = farms[selectedFarm].wkt;
      const coords = wkt.replace("POLYGON((","").replace("))","").split(",").map(p=>p.trim().split(" ").map(Number));
      const payload = {
        satellite_sensor: satProvider,
        cloud_cover: 30,
        start_date: startDate,
        end_date:   endDate,
        geojson: { type:"FeatureCollection", features:[{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[coords] } }] },
      };
      const res = await fetch(`${API_BASE}${endpoint}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.statusText); }
      const r = await res.json();
      setResult(r);
      if (selectedFarm) storeResult("organic", selectedFarm, item, r);
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
          {item === "Crop Rotation Detection" && (
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-medium">In Development</span>
          )}
          {item !== "Crop Rotation Detection" && (
            <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" title="Sub-Task 4" />
          )}
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{meta.desc}</p>
      </div>

      {item === "Crop Rotation Detection" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-600">Planned Data Sources</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-gray-300 font-medium">Google Earth Engine — Dynamic World & Crop Mapper</p>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">Annual land cover classifications at 10m combined with Sentinel-2 NDVI time series. Enables per-parcel phenological fingerprinting across 5+ years to detect crop switching between seasons.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-gray-300 font-medium">OneSoil Crop Map</p>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">Field-boundary-aligned crop type labels across Europe at sub-field resolution. Annual layers serve as ground-truth anchors for rotation sequence validation and model calibration.</p>
              </div>
            </div>
          </div>
          <div className="pt-1 space-y-0.5">
            {[
              ["Spectral comparison", "NDVI peak timing shift > 3 weeks flags rotation"],
              ["Rotation score",      "0–100 index based on crop diversity over 3–5 years"],
              ["Compliance output",   "EC 2092/91 & USDA NOP rotation requirement check"],
            ].map(([label, detail]) => (
              <div key={label} className="flex gap-2 text-[10px]">
                <span className="text-gray-700 flex-shrink-0">–</span>
                <span><span className="text-gray-500">{label}:</span> <span className="text-gray-600">{detail}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <p className="text-[10px] text-gray-500 mt-1">{result.year_count} year(s) · peak month spread: {result.peak_month_spread} months</p>
          </div>
          <div className="space-y-1">
            {result.years?.map(({ year, peak_month, mean_ndvi }) => (
              <div key={year} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-10">{year}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-orange-400/70" style={{ width:`${mean_ndvi*100}%` }} />
                </div>
                <span className="text-gray-500 w-16 text-right font-mono">peak M{peak_month}</span>
                <span className="text-gray-400 font-mono w-12 text-right">NDVI {mean_ndvi}</span>
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
            <p className="text-[10px] text-gray-500 mt-1">Off-season NDVI: {result.off_season_ndvi} · {result.off_season_obs} obs.</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[["Off-season NDVI", result.off_season_ndvi],["Growing NDVI", result.growing_ndvi],["NDVI Contrast", result.ndvi_contrast]].map(([l,v])=>(
              <div key={l} className="bg-white/[0.03] border border-white/[0.06] rounded p-2">
                <p className="text-[11px] font-mono text-gray-200">{v}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          {result.sar && (
            <div className="bg-sky-400/5 border border-sky-400/20 rounded p-2 text-[10px]">
              <p className="text-sky-400 font-semibold mb-1">Sentinel-1 SAR</p>
              <p className="text-gray-400">Off-season VH: {result.sar.off_season_vh_mean ?? "N/A"} · Vegetation: {result.sar.vegetation_present ? "✓ Present" : "Not detected"}</p>
            </div>
          )}
        </div>
      )}

      {/* Compost Map */}
      {result && item === "Compost Application Map" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.detected?"bg-emerald-400/5 border-emerald-400/30":"bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-lg font-bold ${result.detected?"text-emerald-400":"text-gray-400"}`}>{result.detected?"Spring Uplift Detected":"No Organic Amendment Signal"}</p>
            <p className="text-[10px] text-gray-500 mt-1">Spring NDVI {result.spring_mean} · Uplift Δ{result.uplift}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[["Spring Mean", result.spring_mean],["Baseline Mean", result.baseline_mean],["Uplift", result.uplift],["Best Green-up", result.best_green_up]].map(([l,v])=>(
              <div key={l} className="bg-white/[0.03] border border-white/[0.06] rounded p-2">
                <p className="text-[11px] font-mono text-gray-200">{v ?? "—"}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soil Carbon */}
      {result && item === "Soil Carbon Trend" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.trend==="Accumulating"?"bg-emerald-400/5 border-emerald-400/30":result.trend==="Depleting"?"bg-red-400/5 border-red-400/30":"bg-white/[0.03] border-white/[0.06]"}`}>
            <p className={`text-xl font-bold ${result.trend==="Accumulating"?"text-emerald-400":result.trend==="Depleting"?"text-red-400":"text-gray-400"}`}>{result.trend}</p>
            <p className="text-[10px] text-gray-500 mt-1">~{result.carbon_proxy_t_ha} tC/ha · Mean NDVI {result.mean_ndvi}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[["Slope/month", result.slope_per_month],["Carbon proxy", `${result.carbon_proxy_t_ha} tC/ha`],["Mean NDVI", result.mean_ndvi],["Observations", result.scene_count]].map(([l,v])=>(
              <div key={l} className="bg-white/[0.03] border border-white/[0.06] rounded p-2">
                <p className="text-[11px] font-mono text-gray-200">{v ?? "—"}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chemical-Free */}
      {result && item === "Chemical-Free Verification" && (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 border text-center ${result.verified?"bg-emerald-400/5 border-emerald-400/30":"bg-red-400/5 border-red-400/30"}`}>
            <p className={`text-xl font-bold ${result.verified?"text-emerald-400":"text-red-400"}`}>{result.verified?"✓ Chemical-Free":"Anomalies Detected"}</p>
            <p className="text-[10px] text-gray-500 mt-1">Compliance score: {result.score}/100 · {result.dip_count} dip event(s)</p>
          </div>
          {result.dips?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">NDVI dip events</p>
              {result.dips.map((d,i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-red-400/5 border border-red-400/20 rounded px-2 py-1.5">
                  <span className="text-gray-400 font-mono">{d.from} → {d.date}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${d.severity==="High"?"bg-red-400/15 text-red-400":"bg-yellow-400/15 text-yellow-400"}`}>{d.severity}</span>
                  <span className="text-red-400 font-mono">−{d.drop}</span>
                </div>
              ))}
            </div>
          )}
          {result.chart_url && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">NDVI dip chart</p>
              <img
                src={`${API_BASE}/api/thumbnail-proxy?url=${encodeURIComponent(result.chart_url)}`}
                alt="NDVI dip analysis chart"
                className="w-full rounded-md border border-white/10"
              />
            </div>
          )}
          {result.sar_events?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">SAR disturbance events</p>
              {result.sar_events.map((e,i) => (
                <div key={i} className="flex justify-between text-xs bg-sky-400/5 border border-sky-400/20 rounded px-2 py-1">
                  <span className="text-gray-400">{e.date}</span>
                  <span className="text-sky-400 font-mono">VH −{e.vh_drop}</span>
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
            <p className="text-[10px] text-gray-500 mt-1">Mean NDVI: {result.mean_ndvi} · {result.buffer_failures} failure month(s)</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[["Mean NDVI", result.mean_ndvi],["Min NDVI", result.min_ndvi],["Std Dev", result.std_ndvi]].map(([l,v])=>(
              <div key={l} className="bg-white/[0.03] border border-white/[0.06] rounded p-2 text-center">
                <p className="text-[11px] font-mono text-gray-200">{v ?? "—"}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{l}</p>
              </div>
            ))}
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
