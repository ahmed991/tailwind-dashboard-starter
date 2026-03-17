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
      { label: "Historical Imagery" },
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
      { label: "Sentinel-2 (Multispectral)" },
      { label: "Sentinel-1 (SAR)" },
      { label: "Sentinel-3 (Water/LST)" },
      { label: "Landsat Archive" },
      { label: "PlanetScope (3m)", disabled: true, note: "API key needed" },
      { label: "EnMAP Hyperspectral", disabled: true, note: "Sub-Task 2" },
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
      { label: "NDVI Time-Series Trend", disabled: true },
      { label: "Forest to Ag Detection", disabled: true },
      { label: "Risk Zones (Low/Med/High)", disabled: true },
      { label: "Deforestation Alerts", disabled: true },
    ],
  },
  {
    id: "organic-compliance",
    title: "Organic & Regenerative",
    accent: "orange",
    badge: "Sub-Task 4",
    items: [
      { label: "Crop Rotation Detection", disabled: true },
      { label: "Cover Crop Verification", disabled: true },
      { label: "Compost Application Map", disabled: true },
      { label: "Soil Carbon Trend", disabled: true },
      { label: "Chemical-Free Verification", disabled: true },
      { label: "Buffer Zone & Drift Risk", disabled: true },
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
      { label: "Biodiversity Index Score", disabled: true },
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
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.disabled ? "bg-gray-700" : colors.bar}`} />
        <span className={item.disabled ? "line-through" : ""}>{item.label}</span>
        {item.note && <span className="ml-auto text-[10px] text-gray-600 font-normal">{item.note}</span>}
      </button>
    </li>
  );
}


export default function Sidebar({ onSelect, activeItem }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [openSection, setOpenSection] = useState("farm-monitoring");

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
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wide flex-shrink-0 ${colors.badge}`}>
                    {section.badge}
                  </span>
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
