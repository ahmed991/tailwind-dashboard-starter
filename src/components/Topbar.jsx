import { useAuth } from "../context/AuthContext";
import { useFarms } from "../context/FarmContext";

export default function Topbar({ onUploadClick, onSidebarToggle, selectedFarmName }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { farms, selectedFarm, setSelectedFarm } = useFarms();

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2">
      {/* Left: farm selector */}
      <div className="flex items-center gap-3">
        {isAuthenticated && farms.length > 0 && (
          <select
            value={selectedFarm?.id || ""}
            onChange={(e) => {
              const farm = farms.find((f) => f.id === Number(e.target.value));
              if (farm) setSelectedFarm(farm);
            }}
            className="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-lime-400 cursor-pointer"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id} className="bg-gray-900">
                {f.name}
              </option>
            ))}
          </select>
        )}

        {isAuthenticated && (
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm text-white/80 hover:text-white text-xs rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload ROI
          </button>
        )}
      </div>

      {/* Center: breadcrumb */}
      <div className="text-white/40 text-xs">
        {selectedFarm?.name && (
          <span className="text-white/70 font-medium">{selectedFarm.name}</span>
        )}
        {selectedFarm?.geojson?.properties?.area_ha && (
          <span className="ml-2 text-white/40">{selectedFarm.geojson.properties.area_ha} ha</span>
        )}
      </div>

      {/* Right: user */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <span className="text-white/70 text-xs hidden sm:block drop-shadow">
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={logout}
              className="bg-black/30 backdrop-blur-sm text-white/80 hover:text-red-400 text-xs rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <span className="text-white/40 text-xs">Not signed in</span>
        )}
      </div>
    </header>
  );
}
