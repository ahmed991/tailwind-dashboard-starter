import { useState } from "react";

export default function Sidebar({ onSelect }) {
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
      id: 2,
      title: "Organic Assessment",
      accent: "accent2",
      items: ["Soil Health Map", "Crop Health Analysis", "Pest and Disease Alerts", "Crop Rotation Planner", "Water Resource Mapping", "Fertilizer Application Map", "Compost Heatmap", "Biodiv. Hotspot Viewer", "Pollinator Activity Zones", "Buffer Zone Assessment", "Wildlife Corridor Mapping", "Carbon Sequestration", "Green Cover Changes", "Deforestation Monitoring", "Organic Zone Boundaries", "Adjacent Land Use", "Pesticide Drift Risk Map", "Extra Tools", "Add IoT Ground Truth Data", "Add Hyperspectral"]
    },
    {
      id: 3,
      title: "Carbon & GHG Metrics",
      accent: "accent3",
      items: ["CO₂ Capture Data", "GHG Emission Tracker", "Carbon Credit Mgmt.", "Emission Comparison"]
    },
    {
      id: 4,
      title: "Biodiversity Assessment",
      accent: "accent4",
      items: ["Biodiversity Index Score", "Soil Microbes & Biodiv.", "Wildlife Data", "Bird Species Data", "Pollinator Data", "Tree Species Data", "Invasive Species Data", "Endangered Species Data", "Aquatic Biodiversity Data", "Species Observation Log", "Impact Heatmap"]
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
    }
  ];

  const accentColors = {
    accent1: "bg-lime-300 text-black",
    accent2: "bg-cyan-300 text-black",
    accent3: "bg-pink-300 text-black",
    accent4: "bg-yellow-300 text-black",
    accent5: "bg-purple-300 text-black",
    accent6: "bg-blue-300 text-black"
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
