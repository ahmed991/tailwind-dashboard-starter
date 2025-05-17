export default function Panel({ title, options, style, onClick }) {
    return (
      <div
        className="absolute top-16 bg-panelBg rounded-lg p-4 shadow-lg z-10"
        style={style}
      >
        <h2 className="text-lg mb-2">{title}</h2>
        <ul className="space-y-1">
          {options.map((opt, i) => (
            <li key={i} className="text-sm">
              <button
                onClick={() => onClick(opt)}
                className="w-full text-left hover:underline"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  