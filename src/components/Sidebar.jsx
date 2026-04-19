import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const Ico = {
  home:      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  chart:     <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  satellite: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>,
  leaf:      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3s14 2 14 12c0 5-5 7-9 7M5 3c0 6 3 10 5 16M5 3L3 21" /></svg>,
  recycle:   <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  bug:       <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v1m0 14v1M4.22 4.22l.707.707m13.86 13.86l.707.707M1 12h1m20 0h1M4.22 19.78l.707-.707M18.364 5.636l.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" /></svg>,
  cloud:     <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
  flask:     <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3h6m-5 0v6l-4 9a1 1 0 001 1h10a1 1 0 001-1l-4-9V3M10 3h4" /></svg>,
  pin:       <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  globe:     <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  alert:     <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  clipboard: <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  upload:    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
};

// ── Section icon lookup ───────────────────────────────────────────────────────
const SECTION_ICONS = {
  "my-farms":           Ico.home,
  "farm-monitoring":    Ico.chart,
  "multi-sensor":       Ico.satellite,
  "organic-assessment": Ico.leaf,
  "organic-compliance": Ico.recycle,
  "biodiversity":       Ico.bug,
  "carbon-ghg":         Ico.cloud,
  "heavy-metals":       Ico.flask,
  "pilot-1":            Ico.pin,
  "pilot-2":            Ico.globe,
  "eudr":               Ico.alert,
  "compliance":         Ico.clipboard,
};

// ── Data ──────────────────────────────────────────────────────────────────────
const GROUPS = [
  {
    id: "farm-monitoring-group",
    title: "Farm Monitoring",
    accent: "lime",
    sections: [
      { id: "my-farms", title: "My Farms", special: "farms", accent: "lime" },
      { id: "farm-monitoring", title: "Farm Monitoring", accent: "lime",
        items: [
          { label: "View Farm Overview" },
          { label: "Live Satellite View" },
        ],
      },
      { id: "multi-sensor", title: "Satellite Data", accent: "sky",
        items: [
          { label: "Open-source Data", groupHeader: true },
          { label: "Sentinel-2 (Multispectral)", note: "10–60m · optical" },
          { label: "Sentinel-1 (SAR)",           note: "20m · radar/backscatter" },
          { label: "Sentinel-3 (Water/LST)",     note: "300m · thermal/ocean" },
          { label: "Sentinel-5P (Atmosphere)",   note: "3.5km · NO₂, SO₂, CO, O₃" },
          { label: "Landsat Archive",            note: "30m · optical archive" },
          { label: "CopDEM (30m Terrain)",       note: "30m · elevation/slope" },
          { label: "EnMAP Hyperspectral",        note: "30m · hyperspectral · DLR STAC" },
          { label: "Planet Open Data",           note: "SkySat · open CC license" },
          { label: "Commercial Data", groupHeader: true },
          { label: "PlanetScope (3m)",    disabled: true, note: "API key needed" },
          { label: "PIXXEL Hyperspectral", disabled: true, note: "Coming soon" },
          { label: "BIOMASS Mission",     disabled: true, note: "TBD 2025" },
          { label: "Processing Jobs" },
        ],
      },
    ],
  },
  {
    id: "organic-bio-group",
    title: "Organic and Biodiversity Assessment",
    accent: "cyan",
    sections: [
      { id: "organic-assessment", title: "Organic Assessment", accent: "cyan",
        items: [
          { label: "Crop Health Analysis", children: [
              { label: "NDVI" },
              { label: "SAVI" },
              { label: "PVI" },
              { label: "EVI" },
              { label: "LAI" },
            ],
          },
          { label: "Soil Health Map", children: [
              { label: "Soil Fertility Map" },
              { label: "Soil Nutrients and Chemicals" },
            ],
          },
          { label: "Water Resource Mapping", children: [
              { label: "NDWI" },
              { label: "NDMI" },
              { label: "MSI" },
              { label: "Evapotranspiration" },
            ],
          },
          { label: "Buffer Zone Assessment" },
        ],
      },
      { id: "organic-compliance", title: "Organic & Regenerative", accent: "orange",
        items: [
          { label: "Forest Cover Change" },
          { label: "Carbon Sequestration" },
          { label: "Crop Rotation Detection" },
          { label: "Cover Crop Verification" },
          { label: "Organic Fertilizer Application" },
          { label: "Soil Carbon Trend" },
          { label: "Chemical-Free Verification" },
          { label: "Buffer Zone & Drift Risk" },
          { label: "Crop Details", children: [
              { label: "Land Use & Landscape ID" },
              { label: "Main Crop Identification" },
              { label: "Green Cover Changes" },
              { label: "Adjacent Land Use",            disabled: true },
              { label: "Mixed Crop & Crop Cycle",      disabled: true },
              { label: "Rotation Crop Identification", disabled: true },
              { label: "Crop Yield Estimation",        disabled: true },
              { label: "Crop Rotation Planner",        disabled: true },
              { label: "No-Till Farming Zones",        disabled: true },
              { label: "Agroforestry Integration", children: [
                  { label: "Tracks Tree Planting & Maintenance", disabled: true },
                  { label: "Deforestation Monitoring",           disabled: true },
                ],
              },
              { label: "Soil Info", children: [
                  { label: "Soil Erosion Risk Zones",      disabled: true },
                  { label: "Soil Carbon Content Tracking", disabled: true },
                  { label: "Nutrient Balance Maps",        disabled: true },
                ],
              },
            ],
          },
        ],
      },
      { id: "biodiversity", title: "Biodiversity Assessment", accent: "yellow",
        items: [
          { label: "Terrestrial Biodiversity", children: [
              { label: "Bird Species Data" },
              { label: "Species Observation Log" },
              { label: "Wildlife Corridor Mapping" },
              { label: "Endangered Species Data" },
              { label: "Tree Species Data" },
              { label: "Pollinator Data" },
            ],
          },
          { label: "Biodiversity Hotspot Viewer" },
          { label: "Biodiversity Index Score" },
          { label: "Habitat Fragmentation", disabled: true },
          { label: "Aquatic Biodiversity",  disabled: true },
        ],
      },
      { id: "carbon-ghg", title: "Carbon & GHG Metrics", accent: "pink",
        items: [
          { label: "GHG Emission Tracker" },
          { label: "CO2 Capture Data",       disabled: true, note: "In Development" },
          { label: "Carbon Stock Modeling",  disabled: true, note: "In Development" },
          { label: "Carbon MRV Output",      disabled: true, note: "In Development" },
          { label: "Carbon Credit Mgmt.",    disabled: true, note: "In Development" },
        ],
      },
      { id: "heavy-metals", title: "Agricultural Chemical Traces", accent: "red",
        items: [
          { label: "Heavy Metals", children: [
              { label: "Lead (Pb)", note: "Phosphate fertilizers, pesticides" },
              { label: "Cadmium (Cd)", note: "Superphosphate fertilizers" },
              { label: "Arsenic (As)", note: "Pesticides, wood preservatives" },
              { label: "Mercury (Hg)", note: "Fungicides, industrial runoff" },
              { label: "Chromium (Cr)", note: "Sewage sludge, tannery waste" },
              { label: "Nickel (Ni)", note: "Phosphate fertilizers, sludge" },
              { label: "Copper (Cu)", note: "Fungicides (Bordeaux mix), manure" },
              { label: "Zinc (Zn)", note: "Micronutrient fertilizers, manure" },
            ],
          },
          { label: "Agrochemical Residues", children: [
              { label: "Organophosphates", note: "Insecticides — nerve agent class" },
              { label: "Glyphosate", note: "Herbicide — soil & water persistence" },
              { label: "Nitrates (NO₃⁻)", note: "N-fertilizer over-application" },
              { label: "Phosphates", note: "P-fertilizer runoff, eutrophication" },
            ],
          },
          { label: "Source / Origin Mapping", children: [
              { label: "Fertilizer Application Zones" },
              { label: "Pesticide Spray History" },
              { label: "Industrial Proximity Risk" },
              { label: "Irrigation Water Quality" },
            ],
          },
          { label: "Ghaziabad Case Study", note: "Industrial" },
        ],
      },
    ],
  },
  {
    id: "pilot-1-group",
    title: "Pilot Project I",
    subheading: "Organic Cotton Compliance & Digital Twin Validation for Khargone",
    accent: "violet",
    sections: [
      { id: "pilot-1", title: "Case Study", accent: "violet",
        items: [
          { label: "Pilot Overview" },
          { label: "Digital Twin (LULC)" },
          { label: "Canopy Height Model" },
          { label: "Vegetation Indices" },
          { label: "Organic Assessment" },
          { label: "Toxic Risk Screening",     disabled: true, note: "Coming soon" },
          { label: "Compliance Evidence Pack", disabled: true, note: "Coming soon" },
        ],
      },
    ],
  },
  {
    id: "pilot-2-group",
    title: "Pilot Project II",
    subheading: "Monitoring Regenerative Forestry for Viscose Textiles — Czech Republic",
    accent: "teal",
    sections: [
      { id: "pilot-2", title: "Pilot 2 — Czech Republic", accent: "teal",
        items: [
          { label: "Pilot Overview" },
          { label: "Land Cover Change", children: [
              { label: "Land Cover 2017" },
              { label: "Land Cover 2024" },
              { label: "Change Detection Map" },
              { label: "Change by Class Chart" },
            ],
          },
          { label: "Vegetation Indices", children: [
              { label: "NDVI" },
              { label: "NDRE" },
              { label: "EVI" },
              { label: "NDVI Autumn" },
              { label: "Combined View" },
            ],
          },
          { label: "Tree Species Classification", children: [
              { label: "Species Overview" },
              { label: "Eucalyptus Mapping" },
              { label: "Beech Tree Mapping" },
              { label: "Red Edge Classification" },
              { label: "Seasonal NDVI Profile" },
            ],
          },
          { label: "Forest Site Profiles", children: [
              { label: "Šumava — Beech Forest" },
              { label: "Křivoklátsko — Eucalyptus Plot" },
              { label: "Jeseníky — Conifer Stand" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "eudr-group",
    title: "EUDR",
    accent: "emerald",
    sections: [
      { id: "eudr", title: "EUDR Deforestation", accent: "emerald",
        items: [
          { label: "NDVI Time-Series Trend" },
          { label: "Forest to Ag Detection" },
          { label: "Risk Zones (Low/Med/High)" },
          { label: "Deforestation Alerts" },
        ],
      },
    ],
  },
  {
    id: "compliance-group",
    title: "Compliance and Reporting",
    accent: "purple",
    sections: [
      { id: "compliance", title: "Compliance & Reporting", accent: "purple",
        items: [
          { label: "Compliance Dashboard",      disabled: true },
          { label: "Generate Compliance Report" },
          { label: "EUDR Risk Report" },
          { label: "Carbon MRV Report",         disabled: true },
          { label: "Biodiversity Report",       disabled: true },
          { label: "Submit to Regulators",      disabled: true },
        ],
      },
    ],
  },
];

// ── Accent tokens ─────────────────────────────────────────────────────────────
const ACCENT = {
  lime:    { bar: "bg-lime-400",    text: "text-lime-400",    hover: "hover:bg-lime-400/10",    active: "bg-lime-400/[0.12]",    ring: "ring-lime-400/25"    },
  cyan:    { bar: "bg-cyan-400",    text: "text-cyan-400",    hover: "hover:bg-cyan-400/10",    active: "bg-cyan-400/[0.12]",    ring: "ring-cyan-400/25"    },
  sky:     { bar: "bg-sky-400",     text: "text-sky-400",     hover: "hover:bg-sky-400/10",     active: "bg-sky-400/[0.12]",     ring: "ring-sky-400/25"     },
  emerald: { bar: "bg-emerald-400", text: "text-emerald-400", hover: "hover:bg-emerald-400/10", active: "bg-emerald-400/[0.12]", ring: "ring-emerald-400/25" },
  orange:  { bar: "bg-orange-400",  text: "text-orange-400",  hover: "hover:bg-orange-400/10",  active: "bg-orange-400/[0.12]",  ring: "ring-orange-400/25"  },
  pink:    { bar: "bg-pink-400",    text: "text-pink-400",    hover: "hover:bg-pink-400/10",    active: "bg-pink-400/[0.12]",    ring: "ring-pink-400/25"    },
  yellow:  { bar: "bg-yellow-400",  text: "text-yellow-400",  hover: "hover:bg-yellow-400/10",  active: "bg-yellow-400/[0.12]",  ring: "ring-yellow-400/25"  },
  red:     { bar: "bg-red-400",     text: "text-red-400",     hover: "hover:bg-red-400/10",     active: "bg-red-400/[0.12]",     ring: "ring-red-400/25"     },
  amber:   { bar: "bg-amber-400",   text: "text-amber-400",   hover: "hover:bg-amber-400/10",   active: "bg-amber-400/[0.12]",   ring: "ring-amber-400/25"   },
  purple:  { bar: "bg-purple-400",  text: "text-purple-400",  hover: "hover:bg-purple-400/10",  active: "bg-purple-400/[0.12]",  ring: "ring-purple-400/25"  },
  violet:  { bar: "bg-violet-400",  text: "text-violet-400",  hover: "hover:bg-violet-400/10",  active: "bg-violet-400/[0.12]",  ring: "ring-violet-400/25"  },
  teal:    { bar: "bg-teal-400",    text: "text-teal-400",    hover: "hover:bg-teal-400/10",    active: "bg-teal-400/[0.12]",    ring: "ring-teal-400/25"    },
};

// ── SidebarItem — leaf node or collapsible parent ─────────────────────────────
function SidebarItem({ item, colors, onSelect, sectionTitle }) {
  const [open, setOpen] = useState(false);

  // Category header (e.g. "Open-source Data")
  if (item.groupHeader) {
    return (
      <li className="pt-2.5 pb-0.5 first:pt-1">
        <span className="flex items-center gap-1.5 px-2">
          <span className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[8.5px] uppercase tracking-widest font-semibold text-gray-600 whitespace-nowrap select-none">
            {item.label}
          </span>
          <span className="flex-1 h-px bg-white/[0.06]" />
        </span>
      </li>
    );
  }

  const hasChildren = item.children?.length > 0;
  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setOpen(p => !p)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-[11px] font-medium text-gray-400 hover:text-gray-100 hover:bg-white/[0.06] transition-colors"
        >
          <span className={item.disabled ? "line-through opacity-30" : ""}>{item.label}</span>
          <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""} ${colors.text} opacity-70`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {open && (
          <ul className="ml-3 mt-0.5 space-y-px border-l border-white/[0.06] pl-2">
            {item.children.map((child, i) => (
              <SidebarItem key={i} item={child} colors={colors} onSelect={onSelect} sectionTitle={sectionTitle} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        disabled={item.disabled}
        onClick={() => !item.disabled && onSelect(sectionTitle, item.label)}
        title={item.note || ""}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] transition-colors
          ${item.disabled
            ? "text-gray-600 cursor-not-allowed"
            : `text-gray-400 hover:text-gray-100 ${colors.hover}`}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${item.disabled ? "bg-gray-700" : colors.bar}`} />
        <span className="flex-1 min-w-0">
          <span className={`block ${item.disabled ? "line-through" : ""}`}>{item.label}</span>
          {item.note && (
            <span className="block text-[9px] text-gray-600 leading-tight mt-0.5">{item.note}</span>
          )}
        </span>
      </button>
    </li>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar({ onSelect, farms = {}, selectedFarm, onFarmSelect, onUploadClick }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [openGroup, setOpenGroup]   = useState("farm-monitoring-group");
  // Single open section per hover interaction
  const [openSection, setOpenSection] = useState("my-farms");
  const closeTimer = useRef(null);

  const farmNames    = Object.keys(farms);
  const visibleGroups = isAuthenticated ? GROUPS : GROUPS.slice(0, 1);

  // Debounced hover handlers — 180 ms grace window to move mouse between header and content
  const handleSectionEnter = (id) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSection(id);
  };
  const handleSectionLeave = () => {
    closeTimer.current = setTimeout(() => setOpenSection(null), 180);
  };

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[#161619] border-r border-white/[0.06]">

      {/* ── Logo ── */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
        <img src="/ffbs-logo.png" alt="FFBS" className="w-7 h-7 object-contain flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-white text-[10px] font-semibold leading-tight">Organic & Biodiversity</p>
          <p className="text-white text-[10px] font-semibold leading-tight">Assessment</p>
          <p className="text-gray-500 text-[9px] mt-0.5 leading-none">EO Intelligence Platform</p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-px scrollbar-hide">
        {visibleGroups.map((group) => {
          const gc         = ACCENT[group.accent] || ACCENT.lime;
          const isGroupOpen = openGroup === group.id;

          return (
            <div key={group.id} className="px-2">

              {/* Group header — click to toggle, prominent hover */}
              <button
                onClick={() => setOpenGroup(isGroupOpen ? null : group.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-all group
                  ${isGroupOpen
                    ? `bg-white/[0.08] text-white ring-1 ${gc.ring}`
                    : "text-gray-400 hover:text-white hover:bg-white/[0.07] hover:ring-1 hover:ring-white/[0.06]"}`}
              >
                <span className={`w-0.5 rounded-full flex-shrink-0 transition-all duration-200
                  ${isGroupOpen
                    ? `${group.subheading ? "h-7" : "h-4"} ${gc.bar}`
                    : "h-4 bg-white/10 group-hover:bg-white/25"}`}
                />
                <span className="flex-1 min-w-0">
                  <span className={`block text-[11.5px] font-bold tracking-wide uppercase truncate transition-colors
                    ${isGroupOpen ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                    {group.title}
                  </span>
                  {group.subheading && isGroupOpen && (
                    <span className="block text-[9px] text-gray-500 leading-tight mt-0.5 normal-case tracking-normal font-normal whitespace-normal">
                      {group.subheading}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-150
                  ${isGroupOpen ? `rotate-90 ${gc.text}` : "text-gray-600 group-hover:text-gray-300"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Sections — hover-expand, single open at a time */}
              {isGroupOpen && (
                <div className="mt-1 ml-1.5 space-y-px border-l border-white/[0.05] pl-2">
                  {group.sections.map((section) => {
                    const sc          = ACCENT[section.accent] || gc;
                    const isSectionOpen = openSection === section.id;
                    const icon        = SECTION_ICONS[section.id] ?? null;

                    /* ── My Farms ── */
                    if (section.special === "farms") {
                      return (
                        <div
                          key={section.id}
                          onMouseEnter={() => handleSectionEnter(section.id)}
                          onMouseLeave={handleSectionLeave}
                        >
                          <button
                            onClick={() => setOpenSection(isSectionOpen ? null : section.id)}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left transition-all
                              ${isSectionOpen
                                ? `${sc.active} ring-1 ${sc.ring}`
                                : "hover:bg-white/[0.05] hover:ring-1 hover:ring-white/[0.04]"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`transition-colors ${isSectionOpen ? sc.text : "text-gray-500"}`}>
                                {Ico.home}
                              </span>
                              <span className={`text-[11px] font-bold uppercase tracking-wider
                                ${isSectionOpen ? sc.text : "text-gray-400"}`}>
                                My Farms
                              </span>
                              {farmNames.length > 0 && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                                  ${isSectionOpen ? `${sc.bar} text-black` : "bg-white/10 text-gray-500"}`}>
                                  {farmNames.length}
                                </span>
                              )}
                            </div>
                            <svg className={`w-3 h-3 text-gray-600 transition-transform duration-150 ${isSectionOpen ? "rotate-90" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {isSectionOpen && (
                            <div className="pb-1.5">
                              {farmNames.length > 0 ? (
                                <ul className="px-1 mt-0.5 space-y-0.5">
                                  {farmNames.map(name => (
                                    <li key={name}>
                                      <button
                                        onClick={() => onFarmSelect(name)}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] transition-colors ${
                                          selectedFarm === name
                                            ? "bg-lime-400/10 text-lime-300 border border-lime-400/20"
                                            : "text-gray-400 hover:text-gray-100 hover:bg-white/[0.05]"
                                        }`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedFarm === name ? "bg-lime-400" : "bg-white/20"}`} />
                                        <span className="truncate">{name}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="px-2 py-1 text-[10px] text-gray-600 italic">No farms added yet</p>
                              )}

                              {/* Upload button — centered */}
                              <div className="flex justify-center mt-2">
                                <button
                                  onClick={onUploadClick}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                                    bg-lime-400/10 border border-lime-400/25 text-lime-400
                                    text-[10px] font-semibold hover:bg-lime-400/18 transition-colors"
                                >
                                  {Ico.upload}
                                  Upload Farm
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    /* ── Regular section ── */
                    return (
                      <div
                        key={section.id}
                        onMouseEnter={() => handleSectionEnter(section.id)}
                        onMouseLeave={handleSectionLeave}
                      >
                        <button
                          onClick={() => setOpenSection(isSectionOpen ? null : section.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left transition-all
                            ${isSectionOpen
                              ? `${sc.active} ring-1 ${sc.ring}`
                              : "hover:bg-white/[0.05] hover:ring-1 hover:ring-white/[0.04]"}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`transition-colors flex-shrink-0 ${isSectionOpen ? sc.text : "text-gray-500"}`}>
                              {icon}
                            </span>
                            <span className={`text-[10.5px] font-semibold uppercase tracking-wider truncate
                              ${isSectionOpen ? sc.text : "text-gray-400"}`}>
                              {section.title}
                            </span>
                          </div>
                          <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-150
                            ${isSectionOpen ? `rotate-90 ${sc.text}` : "text-gray-600"}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        {isSectionOpen && section.items?.length > 0 && (
                          <ul className="mt-0.5 mb-1.5 ml-2 space-y-px">
                            {section.items.map((itm, i) => (
                              <SidebarItem key={i} item={itm} colors={sc} onSelect={onSelect} sectionTitle={section.title} />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!isAuthenticated && (
          <div className="mx-3 mt-2 p-3 rounded-lg border border-lime-400/20 bg-lime-400/5">
            <p className="text-lime-400 text-[11px] font-medium">Sign in to unlock all modules</p>
            <p className="text-gray-500 text-[10px] mt-0.5">Sub-Tasks 1–8 require authentication</p>
          </div>
        )}
      </nav>

      {/* ── User footer ── */}
      {isAuthenticated && (
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-lime-400/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lime-400 text-[10px] font-bold">
                {(user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-200 text-[11px] font-medium truncate leading-none">{user?.full_name || user?.email}</p>
              <p className="text-gray-500 text-[10px] truncate mt-0.5 leading-none">{user?.email}</p>
            </div>
            <button onClick={logout} title="Sign out"
              className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
