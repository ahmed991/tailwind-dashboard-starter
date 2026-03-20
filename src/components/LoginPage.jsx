import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: "🌿",
    title: "Organic Assessment",
    color: "lime",
    items: ["Crop Rotation Detection", "Cover Crop Verification", "Chemical-Free Mapping", "Buffer Zone Analysis", "Soil Carbon Trends"],
  },
  {
    icon: "🦋",
    title: "Biodiversity Assessment",
    color: "cyan",
    items: ["GBIF Species Mapping", "iNaturalist Observations", "eBird Hotspot Analysis", "Habitat Classification", "Species Richness Index"],
  },
  {
    icon: "🛰️",
    title: "EO Satellite Intelligence",
    color: "teal",
    items: ["Sentinel-2 Multispectral", "NDVI · NDRE · EVI · ETa", "Multi-sensor Historical Viewer", "EUDR Deforestation Alerts", "GHG / Sentinel-5P TROPOMI"],
  },
];

const STATS = [
  { value: "10m", label: "Resolution" },
  { value: "5+", label: "Indices" },
  { value: "2", label: "Pilots" },
  { value: "EU", label: "Compliant" },
];

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", organisation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.full_name, form.organisation);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const feat = FEATURES[activeFeature];
  const accentMap = { lime: "#a3e635", cyan: "#22d3ee", teal: "#2dd4bf" };
  const accent = accentMap[feat.color];

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[58%] relative overflow-hidden bg-gradient-to-br from-[#050d0a] via-[#071410] to-[#060c14] p-10">

        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

        {/* Radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, transition: "background 0.6s" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 mb-12">
          <img src="/ffbs-logo.png" alt="FFBS" className="h-10 w-auto"
            onError={e => { e.target.style.display = "none"; }} />
          <div>
            <p className="text-white font-bold text-lg leading-none">FFBS</p>
            <p className="text-gray-500 text-[11px] tracking-widest uppercase">EO Certification Intelligence</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 mb-8">
          <h2 className="text-4xl font-bold text-white leading-tight mb-3">
            Earth Observation<br />
            <span style={{ color: accent }}>for Sustainable Farming</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md">
            Satellite-powered organic assessment, biodiversity monitoring and EUDR compliance — built for the next generation of regenerative agriculture certification.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10 flex gap-4 mb-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Feature tabs */}
        <div className="relative z-10 flex gap-2 mb-4">
          {FEATURES.map((f, i) => (
            <button key={f.title} onClick={() => setActiveFeature(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                i === activeFeature
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-gray-300"
              }`}>
              <span>{f.icon}</span>
              <span>{f.title}</span>
            </button>
          ))}
        </div>

        {/* Feature card */}
        <div className="relative z-10 flex-1 rounded-2xl border p-5"
          style={{ borderColor: `${accent}22`, background: `${accent}08` }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{feat.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm">{feat.title}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Capabilities</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {feat.items.map((item, i) => (
              <div key={item} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent, opacity: 0.5 + i * 0.1 }} />
                <span className="text-gray-300 text-[11px]">{item}</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-gray-500">Active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tag */}
        <p className="relative z-10 mt-5 text-[10px] text-gray-600 tracking-widest uppercase">
          EU Organic · EUDR · ISO 14064 · Sentinel-2 · Open-Meteo
        </p>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <img src="/ffbs-logo.png" alt="FFBS" className="h-12 w-auto mb-3"
            onError={e => { e.target.style.display = "none"; }} />
          <h1 className="text-xl font-bold text-white">FFBS Dashboard</h1>
          <p className="text-gray-400 text-xs mt-1">EO-Based Organic & Biodiversity Assessment</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h3 className="text-white text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h3>
            <p className="text-gray-500 text-sm mt-1">{mode === "login" ? "Sign in to access your dashboard" : "Join the FFBS platform"}</p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1 mb-6">
            <button onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "login" ? "bg-lime-400 text-gray-900" : "text-gray-400 hover:text-white"}`}>
              Sign In
            </button>
            <button onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "register" ? "bg-lime-400 text-gray-900" : "text-gray-400 hover:text-white"}`}>
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                  <input type="text" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Dr. Jane Smith"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-lime-400/60 focus:bg-gray-800 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Organisation</label>
                  <input type="text" value={form.organisation}
                    onChange={e => setForm({ ...form, organisation: e.target.value })}
                    placeholder="FFBS / Research Institute"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-lime-400/60 focus:bg-gray-800 transition-colors" />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@organisation.com" required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-lime-400/60 focus:bg-gray-800 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" required minLength={8}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-lime-400/60 focus:bg-gray-800 transition-colors" />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-lime-400 hover:bg-lime-300 active:bg-lime-500 disabled:opacity-50 text-gray-900 font-bold rounded-xl py-3 text-sm transition-colors mt-2">
              {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>
          </form>

          <p className="text-center text-gray-700 text-[11px] mt-8">
            FFBS · EO Certification Intelligence Platform · v2.0
          </p>
        </div>
      </div>

    </div>
  );
}
