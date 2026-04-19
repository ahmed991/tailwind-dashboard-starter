import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const GROUPS = [
  {
    id: "farm-monitoring-group",
    title: "Farm Monitoring",
    accent: "lime",
    sections: [
      { id: "my-farms",        title: "My Farms",          special: "farms", accent: "lime" },
      { id: "farm-monitoring", title: "Farm Monitoring",   accent: "lime",
        items: [
          { label: "View Farm Overview" },
          { label: "Live Satellite View" },
        ],
      },
      { id: "multi-sensor",   title: "Multi-Sensor Data", accent: "sky",
        items: [
          { label: "Sentinel-2 (Multispectral)", note: "10–60m · optical" },
          { label: "Sentinel-1 (SAR)",           note: "20m · radar/backscatter" },
          { label: "Sentinel-3 (Water/LST)",     note: "300m · thermal/ocean" },
          { label: "Landsat Archive",            note: "30m · optical archive" },
          { label: "CopDEM (30m Terrain)",       note: "30m · elevation/slope" },
          { label: "EnMAP Hyperspectral",        note: "30m · hyperspectral · DLR STAC" },
          { label: "Planet Open Data",           note: "SkySat · open CC license" },
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
          { label: "Forest Cover Change" },
          { label: "Buffer Zone Assessment" },
          { label: "Carbon Sequestration" },
        ],
      },
      { id: "organic-compliance", title: "Organic & Regenerative", accent: "orange",
        items: [
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
          { label: "Toxic Risk Screening",    disabled: true, note: "Coming soon" },
          { label: "Compliance Evidence Pack", disabled: true, note: "Coming soon" },
        ],
      },
    ],
  },
  {
    id: "pilot-2-group",
    title: "Pilot Project II",
    subheading: "Monitoring Regenerative Forestry for Viscose Textiles for Czech Republic",
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

const ACCENT = {
  lime:    { bar: "bg-lime-400",    text: "text-lime-400",    hover: "hover:bg-lime-400/10",    dot: "bg-lime-400" },
  cyan:    { bar: "bg-cyan-400",    text: "text-cyan-400",    hover: "hover:bg-cyan-400/10",    dot: "bg-cyan-400" },
  sky:     { bar: "bg-sky-400",     text: "text-sky-400",     hover: "hover:bg-sky-400/10",     dot: "bg-sky-400" },
  emerald: { bar: "bg-emerald-400", text: "text-emerald-400", hover: "hover:bg-emerald-400/10", dot: "bg-emerald-400" },
  orange:  { bar: "bg-orange-400",  text: "text-orange-400",  hover: "hover:bg-orange-400/10",  dot: "bg-orange-400" },
  pink:    { bar: "bg-pink-400",    text: "text-pink-400",    hover: "hover:bg-pink-400/10",    dot: "bg-pink-400" },
  yellow:  { bar: "bg-yellow-400",  text: "text-yellow-400",  hover: "hover:bg-yellow-400/10",  dot: "bg-yellow-400" },
  red:     { bar: "bg-red-400",     text: "text-red-400",     hover: "hover:bg-red-400/10",     dot: "bg-red-400" },
  amber:   { bar: "bg-amber-400",   text: "text-amber-400",   hover: "hover:bg-amber-400/10",   dot: "bg-amber-400" },
  purple:  { bar: "bg-purple-400",  text: "text-purple-400",  hover: "hover:bg-purple-400/10",  dot: "bg-purple-400" },
  violet:  { bar: "bg-violet-400",  text: "text-violet-400",  hover: "hover:bg-violet-400/10",  dot: "bg-violet-400" },
  teal:    { bar: "bg-teal-400",    text: "text-teal-400",    hover: "hover:bg-teal-400/10",    dot: "bg-teal-400" },
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
          ${item.disabled ? "text-gray-600 cursor-not-allowed" : `text-gray-400 hover:text-gray-100 ${colors.hover}`}`}
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
  const [openGroup, setOpenGroup] = useState("farm-monitoring-group");
  const [openSections, setOpenSections] = useState({ "my-farms": true, "farm-monitoring": true });

  const farmNames = Object.keys(farms);
  const visibleGroups = isAuthenticated ? GROUPS : GROUPS.slice(0, 1);
  const toggleSection = (id) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[#161619] border-r border-white/[0.06]">

      {/* Logo */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
        <img src="/ffbs-logo.png" alt="FFBS" className="w-7 h-7 object-contain flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-white text-[10px] font-semibold leading-tight">Organic & Biodiversity</p>
          <p className="text-white text-[10px] font-semibold leading-tight">Assessment</p>
          <p className="text-gray-500 text-[9px] mt-0.5 leading-none">EO Intelligence Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-px">
        {visibleGroups.map((group) => {
          const groupColors = ACCENT[group.accent] || ACCENT.lime;
          const isGroupOpen = openGroup === group.id;

          return (
            <div key={group.id} className="px-2">
              {/* Group header */}
              <button
                onClick={() => setOpenGroup(isGroupOpen ? null : group.id)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-all
                  ${isGroupOpen ? "bg-white/[0.07] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"}`}
              >
                <span className={`w-0.5 ${group.subheading && isGroupOpen ? "h-6" : "h-3.5"} rounded-full flex-shrink-0 transition-all ${isGroupOpen ? groupColors.bar : "bg-white/10"}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold tracking-wide uppercase truncate">{group.title}</span>
                  {group.subheading && isGroupOpen && (
                    <span className="block text-[9px] text-gray-500 leading-tight mt-0.5 normal-case tracking-normal font-normal whitespace-normal">
                      {group.subheading}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${isGroupOpen ? `rotate-90 ${groupColors.text}` : "text-gray-600"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Sections */}
              {isGroupOpen && (
                <div className="mt-1 ml-2 space-y-px border-l border-white/[0.06] pl-2">
                  {group.sections.map((section) => {
                    const sc = ACCENT[section.accent] || groupColors;
                    const isSectionOpen = !!openSections[section.id];

                    /* ── My Farms ── */
                    if (section.special === "farms") {
                      return (
                        <div key={section.id}>
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-3 h-3 flex-shrink-0 ${sc.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isSectionOpen ? sc.text : "text-gray-400"}`}>My Farms</span>
                              {farmNames.length > 0 && <span className="text-[9px] text-gray-600">{farmNames.length}</span>}
                            </div>
                            <svg className={`w-3 h-3 text-gray-600 transition-transform ${isSectionOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          {isSectionOpen && (
                            farmNames.length > 0 ? (
                              <ul className="pb-1 px-1 space-y-0.5">
                                {farmNames.map(name => (
                                  <li key={name}>
                                    <button
                                      onClick={() => onFarmSelect(name)}
                                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                                        selectedFarm === name ? "bg-lime-400/10 text-lime-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedFarm === name ? "bg-lime-400" : "bg-white/20"}`} />
                                      <span className="text-[11px] truncate">{name}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="px-2 py-1 text-[10px] text-gray-600 italic">No farms added yet</p>
                            )
                          )}
                        </div>
                      );
                    }

                    /* ── Regular section ── */
                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.bar}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${isSectionOpen ? sc.text : "text-gray-400"}`}>
                              {section.title}
                            </span>
                          </div>
                          <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${isSectionOpen ? `rotate-90 ${sc.text}` : "text-gray-600"}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {isSectionOpen && section.items?.length > 0 && (
                          <ul className="mt-0.5 mb-1 ml-2 space-y-px">
                            {section.items.map((item, i) => (
                              <SidebarItem key={i} item={item} colors={sc} onSelect={onSelect} sectionTitle={section.title} />
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
