import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function DetailPanel({
  open,
  onClose,
  section,
  item,
  gbifSpecies = [],
  inatSpecies = [],
  farms = {},
  onFarmSelect,
  onUploadClick,
  satProvider,
  setSatProvider,
  selectedFarm,
  setSelectedFarm,
  selectedRangeRef,
  selectedGHG,
  setSelectedGHG,
  ebirdSpecies = [],
  ebirdHotspots = [],
}) {
  const sectionBgMap = {
    "Farm Monitoring": "bg-lime-300",
    "Organic Assessment": "bg-cyan-300",
    "Carbon & GHG Metrics": "bg-pink-300",
    "Biodiversity Assessment": "bg-yellow-300",
    "Compliance & Regulatory": "bg-purple-300",
    SDGs: "bg-blue-300",
    "Crop Details": "bg-orange-300",
  };
  const panelClass = section ? sectionBgMap[section] : "bg-gray-300";

  const renderBiodiversityContent = () => {
    if (item === "Species Observation Log") {
      return (
        <div className="bg-white text-black p-2 text-sm rounded space-y-4">
          <div>
            <h3 className="font-semibold">GBIF Species ({gbifSpecies.length})</h3>
            <ul className="list-disc list-inside">
              {gbifSpecies.length ? gbifSpecies.map((name, i) => <li key={i}>{name}</li>) : <li>No data</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">iNaturalist Species ({inatSpecies.length})</h3>
            <ul className="list-disc list-inside">
              {inatSpecies.length ? inatSpecies.map((name, i) => <li key={i}>{name}</li>) : <li>No data</li>}
            </ul>
          </div>
        </div>
      );
    }

    if (item === "Bird Species Data") {
      return (
        <div className="bg-white text-black p-2 text-sm rounded space-y-2">
          <h3 className="font-semibold">eBird Species ({ebirdSpecies.length})</h3>
          <ul className="list-disc list-inside">
            {ebirdSpecies.length ? ebirdSpecies.map((s, i) => <li key={i}>{s}</li>) : <li>No data</li>}
          </ul>
        </div>
      );
    }

    if (item === "Biodiv. Hotspot Viewer") {
      return (
        <div className="bg-white text-black p-2 text-sm rounded space-y-4">
          <div>
            <h3 className="font-semibold">My Farms</h3>
            <ul className="space-y-1">
              {Object.keys(farms).map((farm) => (
                <li key={farm}>
                  <button
                    onClick={() => {
                      onFarmSelect(farm);
                      setSelectedFarm(farm);
                    }}
                    className="hover:underline"
                  >
                    {farm}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button onClick={onUploadClick} className="bg-gray-200 px-2 py-1 rounded">
            Upload Region
          </button>

          <div>
            <h3 className="font-semibold mt-2">Nearby Hotspots ({ebirdHotspots.length})</h3>
            <ul className="list-disc list-inside">
              {ebirdHotspots.length ? ebirdHotspots.map((spot, i) => (
                <li key={i}>
                  {spot.locName} ({spot.lat.toFixed(2)}, {spot.lng.toFixed(2)})
                </li>
              )) : <li>No hotspots</li>}
            </ul>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderGHGContent = () => {
    if (item !== "GHG Emission Tracker") return null;

    const gases = [
      { code: "CO", name: "Carbon monoxide" },
      { code: "CH₄", name: "Methane" },
      { code: "HCHO", name: "Formaldehyde" },
      { code: "NO₂", name: "Nitrogen dioxide" },
      { code: "O₃", name: "Ozone" },
      { code: "SO₂", name: "Sulfur dioxide" }
    ];

    return (
      <div className="bg-white text-black p-2 text-sm rounded space-y-2">
        <h3 className="font-semibold">GHG Indicators</h3>
        {gases.map((gas, i) => (
          <button
            key={i}
            onClick={() => setSelectedGHG(gas.code)}
            className={`block w-full text-left px-2 py-1 rounded ${
              selectedGHG === gas.code ? "bg-blue-200 font-bold" : "hover:bg-gray-100"
            }`}
          >
            {gas.code} — {gas.name}
          </button>
        ))}
        {selectedGHG && (
          <div className="text-blue-700 font-medium">
            Selected: {selectedGHG}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 ${panelClass} p-4 transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      } z-20`}
    >
      <button onClick={onClose} className="absolute left-0 top-1/2 -translate-x-full bg-gray-300 p-2 rounded-l">
        ‹‹
      </button>

      <h2 className="text-xl font-semibold mb-2">{section}</h2>
      <p className="text-sm mb-4">You selected: <strong>{item}</strong></p>

      {section === "Biodiversity Assessment" && renderBiodiversityContent()}
      {section === "Carbon & GHG Metrics" && renderGHGContent()}
    </div>
  );
}
