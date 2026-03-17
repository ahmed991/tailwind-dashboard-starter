import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const SECTIONS = [
  {
    id: "farm-monitoring",
    title: "Farm Monitoring",
    accent: "lime",
    items: [
      { label: "View Farm Overview" },
      { label: "Live Satellite View" },
    ],
  },
  {
    id: "organic-assessment",
    title: "Organic Assessment",
    accent: "cyan",
    items: [
      {
        label: "Crop Health Analysis",
        children: [
          { label: "NDVI" },
          { label: "SAVI" },
          { label: "PVI" },
          { label: "EVI" },
          { label: "LAI" },
        ],
      },
      {
        label: "Soil Health Map",
        children: [
          { label: "Soil Fertility Map" },
          { label: "Soil Nutrients and Chemicals", disabled: true },
        ],
      },
      {
        label: "Water Resource Mapping",
        children: [
          { label: "NDWI" },
          { label: "NDMI" },
          { label: "MSI" },
          { label: "Evapotranspiration" },
        ],
      },
      { label: "Forest Cover Change" },
      { label: "Pollinator Activity Zones", disabled: true },
      { label: "Buffer Zone Assessment", disabled: true },
      { label: "Carbon Sequestration", disabled: true },
    ],
  },
  {
    id: "multi-sensor",
    title: "Multi-Sensor Data",
    accent: "sky",
    badge: "Sub-Task 1",
    items: [
      { label: "Sentinel-2 (Multispectral)", note: "10–60m · optical" },
      { label: "Sentinel-1 (SAR)", note: "20m · radar/backscatter" },
      { label: "Sentinel-3 (Water/LST)", note: "300m · thermal/ocean" },
      { label: "Landsat Archive", note: "30m · optical archive" },
      { label: "CopDEM (30m Terrain)", note: "30m · elevation/slope" },
      { label: "EnMAP Hyperspectral", note: "30m · hyperspectral · DLR STAC" },
      { label: "Planet Open Data", note: "SkySat · open CC license" },
      { label: "PlanetScope (3m)", disabled: true, note: "API key needed" },
      { label: "PIXXEL Hyperspectral", disabled: true, note: "Sub-Task 2" },
      { label: "BIOMASS Mission", disabled: true, note: "TBD 2025" },
      { label: "Processing Jobs" },
    ],
  },
  {
    id: "eudr",
    title: "EUDR Deforestation",
    accent: "emerald",
    badge: "Sub-Task 3",
    items: [
      { label: "NDVI Time-Series Trend" },
      { label: "Forest to Ag Detection" },
      { label: "Risk Zones (Low/Med/High)" },
      { label: "Deforestation Alerts" },
    ],
  },
  {
    id: "organic-compliance",
    title: "Organic & Regenerative",
    accent: "orange",
    badge: "Sub-Task 4",
    items: [
      { label: "Crop Rotation Detection" },
      { label: "Cover Crop Verification" },
      { label: "Compost Application Map" },
      { label: "Soil Carbon Trend" },
      { label: "Chemical-Free Verification" },
      { label: "Buffer Zone & Drift Risk" },
    ],
  },
  {
    id: "carbon-ghg",
    title: "Carbon & GHG Metrics",
    accent: "pink",
    badge: "Sub-Task 5",
    items: [
      { label: "GHG Emission Tracker" },
      { label: "CO2 Capture Data", disabled: true },
      { label: "Carbon Stock Modeling", disabled: true },
      { label: "Carbon MRV Output", disabled: true },
      { label: "Carbon Credit Mgmt.", disabled: true },
    ],
  },
  {
    id: "biodiversity",
    title: "Biodiversity Assessment",
    accent: "yellow",
    badge: "Sub-Task 6",
    items: [
      {
        label: "Terrestrial Biodiversity",
        children: [
          { label: "Bird Species Data" },
          { label: "Species Observation Log" },
          { label: "Wildlife Corridor Mapping", disabled: true },
          { label: "Invasive Species Data", disabled: true },
          { label: "Endangered Species Data", disabled: true },
          { label: "Tree Species Data", disabled: true },
          { label: "Pollinator Data", disabled: true },
        ],
      },
      { label: "Biodiversity Hotspot Viewer" },
      { label: "Biodiversity Index Score" },
      { label: "Habitat Fragmentation", disabled: true },
      { label: "Aquatic Biodiversity", disabled: true },
    ],
  },
  {
    id: "heavy-metals",
    title: "Contamination",
    accent: "red",
    items: [
      { label: "Heavy Metal Contamination" },
      { label: "Ghaziabad Case Study", note: "Industrial" },
    ],
  },
  {
    id: "crop-details",
    title: "Crop Details",
    accent: "amber",
    items: [
      { label: "Land Use & Landscape ID" },
      { label: "Main Crop Identification" },
      { label: "Green Cover Changes" },
      { label: "Adjacent Land Use", disabled: true },
      { label: "Mixed Crop & Crop Cycle", disabled: true },
      { label: "Rotation Crop Identification", disabled: true },
      { label: "Crop Yield Estimation", disabled: true },
      { label: "Crop Rotation Planner", disabled: true },
      { label: "No-Till Farming Zones", disabled: true },
      {
        label: "Agroforestry Integration",
        children: [
          { label: "Tracks Tree Planting & Maintenance", disabled: true },
          { label: "Deforestation Monitoring", disabled: true },
        ],
      },
      {
        label: "Soil Info",
        children: [
          { label: "Soil Erosion Risk Zones", disabled: true },
          { label: "Soil Carbon Content Tracking", disabled: true },
          { label: "Nutrient Balance Maps", disabled: true },
        ],
      },
    ],
  },
  {
    id: "case-study",
    title: "Case Study",
    accent: "violet",
    badge: "Pilot",
    items: [
      { label: "Pilot Overview" },
      { label: "Digital Twin (LULC)" },
      { label: "Canopy Height Model" },
      { label: "Vegetation Indices" },
      { label: "Toxic Risk Screening", disabled: true, note: "Coming soon" },
      { label: "Compliance Evidence Pack", disabled: true, note: "Coming soon" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Reporting",
    accent: "purple",
    badge: "Sub-Task 8",
    items: [
      { label: "Compliance Dashboard", disabled: true },
      { label: "Generate Compliance Report" },
      { label: "EUDR Risk Report", disabled: true },
      { label: "Carbon MRV Report", disabled: true },
      { label: "Biodiversity Report", disabled: true },
      { label: "Submit to Regulators", disabled: true },
    ],
  },
];

const ACCENT = {
  lime:    { bar: "bg-lime-400",    text: "text-lime-400",    badge: "bg-lime-400/15 text-lime-400",    hover: "hover:bg-lime-400/10" },
  cyan:    { bar: "bg-cyan-400",    text: "text-cyan-400",    badge: "bg-cyan-400/15 text-cyan-400",    hover: "hover:bg-cyan-400/10" },
  sky:     { bar: "bg-sky-400",     text: "text-sky-400",     badge: "bg-sky-400/15 text-sky-400",      hover: "hover:bg-sky-400/10" },
  emerald: { bar: "bg-emerald-400", text: "text-emerald-400", badge: "bg-emerald-400/15 text-emerald-400", hover: "hover:bg-emerald-400/10" },
  orange:  { bar: "bg-orange-400",  text: "text-orange-400",  badge: "bg-orange-400/15 text-orange-400",  hover: "hover:bg-orange-400/10" },
  pink:    { bar: "bg-pink-400",    text: "text-pink-400",    badge: "bg-pink-400/15 text-pink-400",    hover: "hover:bg-pink-400/10" },
  yellow:  { bar: "bg-yellow-400",  text: "text-yellow-400",  badge: "bg-yellow-400/15 text-yellow-400",  hover: "hover:bg-yellow-400/10" },
  red:     { bar: "bg-red-400",     text: "text-red-400",     badge: "bg-red-400/15 text-red-400",      hover: "hover:bg-red-400/10" },
  amber:   { bar: "bg-amber-400",   text: "text-amber-400",   badge: "bg-amber-400/15 text-amber-400",  hover: "hover:bg-amber-400/10" },
  purple:  { bar: "bg-purple-400",  text: "text-purple-400",  badge: "bg-purple-400/15 text-purple-400",  hover: "hover:bg-purple-400/10" },
  violet:  { bar: "bg-violet-400",  text: "text-violet-400",  badge: "bg-violet-400/15 text-violet-400",  hover: "hover:bg-violet-400/10" },
};


function SidebarItem({ item, colors, onSelect, sectionTitle }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children?.length > 0;

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-[11px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
        >
          <span className={item.disabled ? "line-through opacity-30" : ""}>{item.label}</span>
          <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""} ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {open && (
          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-white/8 pl-2">
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
            : `text-gray-400 hover:text-gray-100 ${colors.hover}`
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${item.disabled ? "bg-gray-700" : colors.bar}`} />
        <span className="flex-1 min-w-0">
          <span className={`block ${item.disabled ? "line-through" : ""}`}>{item.label}</span>
          {item.note && <span className="block text-[9px] text-gray-600 leading-tight mt-0.5">{item.note}</span>}
        </span>
      </button>
    </li>
  );
}


export default function Sidebar({ onSelect, farms = {}, selectedFarm, onFarmSelect }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [openSection, setOpenSection] = useState("farm-monitoring");
  const [farmsOpen, setFarmsOpen] = useState(true);

  const farmNames = Object.keys(farms);

  const visibleSections = isAuthenticated ? SECTIONS : SECTIONS.slice(0, 1);

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[#161619] border-r border-white/[0.06]">

      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-lime-400 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-black text-gray-900 tracking-tight">FF</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-[11px] font-semibold leading-none">FFBS Platform</p>
          <p className="text-gray-500 text-[10px] mt-0.5 leading-none">EO Intelligence</p>
        </div>
      </div>

      {/* Farm selector */}
      {isAuthenticated && farmNames.length > 0 && (
        <div className="border-b border-white/[0.06]">
          <button
            onClick={() => setFarmsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <svg className="w-3 h-3 text-lime-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">My Farms</span>
            <span className="text-[9px] text-gray-600 mr-1">{farmNames.length}</span>
            <svg className={`w-3 h-3 text-gray-600 transition-transform ${farmsOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {farmsOpen && (
            <ul className="pb-2 px-2 space-y-0.5">
              {farmNames.map(name => (
                <li key={name}>
                  <button
                    onClick={() => onFarmSelect(name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      selectedFarm === name
                        ? "bg-lime-400/10 text-lime-300"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedFarm === name ? "bg-lime-400" : "bg-white/20"}`} />
                    <span className="text-[11px] truncate">{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-px">
        {visibleSections.map((section) => {
          const colors = ACCENT[section.accent] || ACCENT.lime;
          const isOpen = openSection === section.id;

          return (
            <div key={section.id} className="px-2">
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-all
                  ${isOpen
                    ? "bg-white/[0.07] text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                  }`}
              >
                {/* Accent bar */}
                <span className={`w-0.5 h-3.5 rounded-full flex-shrink-0 ${isOpen ? colors.bar : "bg-white/10"}`} />

                <span className="flex-1 text-[11px] font-semibold tracking-wide uppercase truncate">
                  {section.title}
                </span>

                {section.badge && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.bar}`} title={section.badge} />
                )}

                <svg
                  className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? `rotate-90 ${colors.text}` : "text-gray-600"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {isOpen && section.items.length > 0 && (
                <ul className="mt-1 mb-1.5 ml-3 space-y-px">
                  {section.items.map((item, i) => (
                    <SidebarItem
                      key={i}
                      item={item}
                      colors={colors}
                      onSelect={onSelect}
                      sectionTitle={section.title}
                    />
                  ))}
                </ul>
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

      {/* User footer */}
      {isAuthenticated && (
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-lime-400/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lime-400 text-[10px] font-bold">
                {(user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-200 text-[11px] font-medium truncate leading-none">
                {user?.full_name || user?.email}
              </p>
              <p className="text-gray-500 text-[10px] truncate mt-0.5 leading-none">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
            >
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
