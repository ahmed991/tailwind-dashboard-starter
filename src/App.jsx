import { useState } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
function Sidebar({ onSelect }) {
  const sections = [
    {
      id: 1,
      title: "Farm Monitoring",
      accent: "accent1",
      items: ["View Farm Overview", "Crop Details", "Live Satellite View", "Historical Data"],
    },
    {
      id: 2,
      title: "Organic Assessment",
      accent: "accent2",
      items: [
        "Soil Health Map", "Crop Health Analysis", "Pest and Disease Alerts",
        "Crop Rotation Planner", "Water Resource Mapping", "Fertilizer Application Map",
        "Compost Heatmap", "Biodiv. Hotspot Viewer", "Pollinator Activity Zones",
        "Buffer Zone Assessment", "Wildlife Corridor Mapping", "Carbon Sequestration",
        "Green Cover Changes", "Deforestation Monitoring", "Organic Zone Boundaries",
        "Adjacent Land Use", "Pesticide Drift Risk Map", "Extra Tools",
        "Add IoT Ground Truth Data", "Add Hyperspectral"
      ]
    },
    {
      id: 3,
      title: "Carbon & GHG Metrics",
      accent: "accent3",
      items: ["CO₂ Capture Data", "GHG Emission Tracker", "Carbon Credit Mgmt.", "Emission Comparison"],
    },
    {
      id: 4,
      title: "Biodiversity Assessment",
      accent: "accent4",
      items: [
        "Biodiversity Index Score", "Soil Microbes & Biodiv.", "Wildlife Data", "Bird Species Data",
        "Pollinator Data", "Tree Species Data", "Invasive Species Data",
        "Endangered Species Data", "Aquatic Biodiversity Data", "Species Observation Log", "Impact Heatmap"
      ]
    },
    {
      id: 5,
      title: "Compliance & Regulatory",
      accent: "accent5",
      items: ["Compliance Dashboard", "Generate Compl. Reports", "Submit Data to Regulators"]
    },
    {
      id: 6,
      title: "SDGs",
      accent: "accent6",
      items: []
    },
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
              className={`w-full text-left px-3 py-2 border rounded-lg flex justify-between items-center font-semibold transition 
                ${openId === sec.id ? "border-white bg-white bg-opacity-10" : "border-gray-600"}`}
              onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            >
              <span>{sec.title}</span>
              <span className="transform transition">{openId === sec.id ? "˅" : "›"}</span>
            </button>

            {openId === sec.id && sec.items.length > 0 && (
              <ul className={`mt-1 ml-2 rounded px-2 py-2 text-sm ${accentColors[sec.accent]}`}>
                {sec.items.map((item, i) => (
                  <li
                    key={i}
                    className="cursor-pointer hover:underline"
                    onClick={() => onSelect(sec.title, item)}
                  >
                    » {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Logo at the bottom right */}
      <div className="mt-auto pt-4 flex justify-end">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
          {/* Replace with your actual logo */}
          <img src="/ffbs-logo.png" alt="Logo" className="w-12 h-12 object-contain" />
        </div>
      </div>
    </nav>
  );
}

function Topbar({ zoom, onZoom }) {
  return (
    <header className="absolute top-0 left-0 right-0 flex justify-between items-center bg-black bg-opacity-60 text-white p-2 text-sm z-10">
      <div className="flex items-center gap-2">
        <button onClick={() => onZoom(-0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">–</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoom(+0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">+</button>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">My Profile</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">Login ››</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">☰</button>
      </div>
    </header>
  );
}

function Panel({ title, options, style }) {
  return (
    <div className="absolute top-16 bg-panelBg rounded-lg p-4 shadow-lg z-10" style={style}>
      <h2 className="text-lg mb-2">{title}</h2>
      <ul className="space-y-1">
        {options.map((opt, i) => (
          <li key={i} className="text-sm">
            <label>
              <input type="checkbox" className="mr-2" />
              {opt}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailPanel({ open, onClose, section, item }) {
  const [dateRange, setDateRange] = useState([new Date(), new Date()]);
  const [showCalendar, setShowCalendar] = useState(false); // 👈 new state

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
      <p className="text-sm">You selected: <strong>{item}</strong></p>

      {/* ✅ Only show toggle and calendar for Farm Monitoring */}
      {section === "Farm Monitoring" && (
        <div className="mt-4">
          <button
            onClick={() => setShowCalendar(prev => !prev)}
            className="text-sm mb-2 px-3 py-1 rounded bg-black bg-opacity-20 hover:bg-opacity-40 transition"
          >
            {showCalendar ? "Hide Calendar" : "Show Calendar"}
          </button>

          {showCalendar && (
            <div className="bg-white p-2 rounded shadow text-black transition">
              <Calendar
                onChange={setDateRange}
                value={dateRange}
                selectRange={true}
              />
              <div className="text-xs mt-2">
                <p><strong>Start:</strong> {dateRange[0]?.toLocaleDateString()}</p>
                <p><strong>End:</strong> {dateRange[1]?.toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [detailOpen, setDetail] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [activeSection, setActiveSection] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

const handleSelect = (section, item) => {
  setActiveSection(section);
  setActiveItem(item);
  setDetail(false); // force close first
  setTimeout(() => setDetail(true), 50); // reopen after short delay
};


  return (
    <div className="flex h-full overflow-hidden font-body">
      <Sidebar onSelect={handleSelect} />
      <div className="relative flex-1 bg-black overflow-hidden">
        <Topbar zoom={zoom} onZoom={(delta) => setZoom((z) => Math.max(0.5, z + delta))} />
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1563850485541-3b1e9a22e7c1?auto=format&fit=crop&w=1950&q=80')",
            transform: `scale(${zoom})`,
            transformOrigin: "center center"
          }}
        />
        <Panel title="My Farms" options={["Farm A", "Farm B", "Farm C"]} style={{ left: "1rem" }} />
        <Panel title="Search Material Type" options={["Cotton", "Linen", "Hemp"]} style={{ left: "20rem" }} />
        <DetailPanel open={detailOpen} onClose={() => setDetail(false)} section={activeSection} item={activeItem} />
      </div>
    </div>
  );
}
