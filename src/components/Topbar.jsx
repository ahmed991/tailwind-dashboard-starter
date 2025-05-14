export default function Topbar({ zoom, onZoom, onUploadClick }) {
  return (
    <header className="absolute top-0 left-0 right-0 flex justify-between items-center bg-black bg-opacity-60 text-white p-2 text-sm z-10">
      <div className="flex items-center gap-2">
        {/* Optional Zoom Controls */}
        {/* <button onClick={() => onZoom(zoom - 0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">–</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoom(zoom + 0.1)} className="px-2 py-1 bg-white bg-opacity-20 rounded">+</button> */}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onUploadClick} className="px-3 py-1 bg-white bg-opacity-20 rounded">
          Upload GeoJSON
        </button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">My Profile</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">Login ››</button>
        <button className="px-3 py-1 bg-white bg-opacity-20 rounded">☰</button>
      </div>
    </header>
  );
}
