import { useState } from "react";
import { useAuth } from "../context/AuthContext";

// ── Icons ────────────────────────────────────────────────────────────────────
const IconEmail = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const IconLock = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
const IconArrow = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);
const IconBuilding = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);
const IconShield = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const IconLeaf = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);

// ── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    id: "brand",
    title: "Fashion Brand",
    subtitle: "/ Retailer",
    Icon: IconBuilding,
    features: ["Compliance & supply chain transparency", "DPP & EUDR readiness", "Multi-supplier monitoring"],
    // Tailwind-compatible classes
    cardBg: "from-emerald-500/[0.07] to-emerald-900/[0.02]",
    border: "border-emerald-500/25",
    hoverBorder: "hover:border-emerald-400/60",
    hoverShadow: "hover:shadow-[0_0_40px_rgba(52,211,153,0.14),0_0_0_1px_rgba(52,211,153,0.08)]",
    iconBg: "bg-emerald-400/10 text-emerald-400",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    accent: "text-emerald-400",
    bar: "bg-emerald-400",
    btn: "from-emerald-400 to-teal-400",
    btnShadow: "shadow-[0_0_24px_rgba(52,211,153,0.4)]",
    btnHoverShadow: "hover:shadow-[0_0_36px_rgba(52,211,153,0.6)]",
    inputFocus: "focus:border-emerald-400/50 focus:ring-emerald-400/10",
  },
  {
    id: "regulatory",
    title: "Regulatory Body",
    subtitle: "/ Certification Authority",
    Icon: IconShield,
    features: ["Audit & verification tools", "Risk-based compliance workflows", "Evidence-based reporting"],
    cardBg: "from-sky-500/[0.07] to-sky-900/[0.02]",
    border: "border-sky-500/25",
    hoverBorder: "hover:border-sky-400/60",
    hoverShadow: "hover:shadow-[0_0_40px_rgba(56,189,248,0.14),0_0_0_1px_rgba(56,189,248,0.08)]",
    iconBg: "bg-sky-400/10 text-sky-400",
    dot: "bg-sky-400",
    badge: "bg-sky-400/10 text-sky-300 border-sky-400/25",
    accent: "text-sky-400",
    bar: "bg-sky-400",
    btn: "from-sky-400 to-blue-500",
    btnShadow: "shadow-[0_0_24px_rgba(56,189,248,0.4)]",
    btnHoverShadow: "hover:shadow-[0_0_36px_rgba(56,189,248,0.6)]",
    inputFocus: "focus:border-sky-400/50 focus:ring-sky-400/10",
  },
  {
    id: "farmer",
    title: "Farmer",
    subtitle: "/ Producer",
    Icon: IconLeaf,
    features: ["Farm monitoring & productivity tools", "Organic/regenerative tracking", "Market access"],
    cardBg: "from-amber-500/[0.07] to-amber-900/[0.02]",
    border: "border-amber-500/25",
    hoverBorder: "hover:border-amber-400/60",
    hoverShadow: "hover:shadow-[0_0_40px_rgba(251,191,36,0.14),0_0_0_1px_rgba(251,191,36,0.08)]",
    iconBg: "bg-amber-400/10 text-amber-400",
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-300 border-amber-400/25",
    accent: "text-amber-400",
    bar: "bg-amber-400",
    btn: "from-amber-400 to-orange-400",
    btnShadow: "shadow-[0_0_24px_rgba(251,191,36,0.4)]",
    btnHoverShadow: "hover:shadow-[0_0_36px_rgba(251,191,36,0.6)]",
    inputFocus: "focus:border-amber-400/50 focus:ring-amber-400/10",
  },
];

const ROLE_STEPS = {
  brand:      ["Organization Info", "Compliance Needs", "Supply Chain", "Dashboard Preferences", "Finalize"],
  regulatory: ["Institution Details", "Role Selection", "Compliance Modules", "Audit Configuration", "Data Integration", "Finalize"],
  farmer:     ["Farm Profile", "Farm Mapping", "Farming Practices", "Activate Tools", "Verification", "Finalize"],
};

// ── Background ────────────────────────────────────────────────────────────────
const BG = {
  backgroundImage: "url('/Dashboard-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

// ── Shared card glass style ───────────────────────────────────────────────────
const GLASS = {
  background: "rgba(6, 16, 26, 0.82)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.055), inset 0 -1px 0 rgba(0,0,0,0.3)",
};

// ── Form primitives ───────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-semibold tracking-wider uppercase text-white/35">{label}</label>
    {children}
  </div>
);

const makeInputCls = (focusCls = "focus:border-emerald-400/50 focus:ring-emerald-400/10") =>
  `w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 transition-all ${focusCls}`;

const Inp = ({ value, onChange, placeholder, type = "text", required = false, focusCls, icon }) => {
  const cls = makeInputCls(focusCls);
  if (!icon) return <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={cls} />;
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">{icon}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`${cls} pl-10`} />
    </div>
  );
};

const Sel = ({ value, onChange, options, focusCls }) => (
  <select value={value} onChange={onChange} className={makeInputCls(focusCls)}>
    <option value="">Select…</option>
    {options.map(o => <option key={o} value={o} className="bg-[#0a1628]">{o}</option>)}
  </select>
);

const CheckItem = ({ label, checked, onChange, accentDot = "bg-emerald-400" }) => (
  <label className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.12] transition-all group">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
      checked ? "border-transparent" : "border-white/20 bg-white/[0.03]"
    }`}
      style={checked ? { background: accentDot.includes("emerald") ? "#34d399" : accentDot.includes("sky") ? "#38bdf8" : "#fbbf24" } : {}}
    >
      {checked && <IconCheck />}
    </div>
    <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
  </label>
);

const RadioItem = ({ label, value, current, onChange, accentColor }) => {
  const active = current === value;
  return (
    <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
      active ? "bg-white/[0.07] border-white/20" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
    }`}>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        active ? "border-transparent" : "border-white/25"
      }`}
        style={active ? { background: accentColor || "#34d399" } : {}}
      >
        {active && <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
      </div>
      <span className="text-sm text-white/75">{label}</span>
    </label>
  );
};

const Toggle = ({ label, description, checked, onChange, accentHex = "#34d399" }) => (
  <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
    <div className="mr-4">
      <p className="text-sm text-white/75">{label}</p>
      {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
    </div>
    <button type="button" onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
      style={{ background: checked ? accentHex : "rgba(255,255,255,0.12)" }}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  </div>
);

// ── Initial form state ────────────────────────────────────────────────────────
const INIT = {
  email: "", password: "",
  brandName: "", hqCountry: "", contactPerson: "", teamSize: "",
  eudr: false, organicRegen: false, biodiversity: false, dpp: false,
  suppliers: "", connectApis: false,
  riskHigh: true, riskMedium: true, riskLow: false,
  dataVisibility: "Private", esgFrequency: "Quarterly",
  orgName: "", authorityType: "", jurisdiction: "", accreditation: "",
  regRole: "Inspector",
  eudrMod: true, organicMod: true, carbonMod: false, biodiversityMod: true,
  inspectionThreshold: "Medium", geoFrequency: "Weekly", evidenceReq: "",
  farmerName: "", farmName: "", location: "", farmSize: "", cropType: "",
  farmingPractice: "Conventional",
  regenAgroforestry: false, regenCoverCrop: false, regenNoTill: false,
  inputFertilizer: false, inputPesticides: false,
  toolSoil: false, toolYield: false, toolPest: false,
  toolIrrigation: false, toolCarbon: false, toolMarket: false,
  acceptMonitoring: false, dataConsent: false,
  gdprConsent: false,
};

// ── Shared page wrapper (must be at module level to avoid remount on every render) ──
const Page = ({ children, wide = false }) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden" style={BG}>
    <div className="pointer-events-none absolute inset-0 bg-black/30" />
    <div className={`relative z-10 w-full flex flex-col items-center ${wide ? "max-w-3xl" : "max-w-sm"}`}>
      {children}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, register } = useAuth();

  const [view, setView]   = useState("login");
  const [role, setRole]   = useState(null);
  const [step, setStep]   = useState(0);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [form, setForm]   = useState(INIT);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const roleInfo = ROLES.find(r => r.id === role);
  const steps = role ? ROLE_STEPS[role] : [];
  const totalSteps = steps.length;
  const isFinalStep = step === totalSteps - 1;

  // Accent color hex for JS-driven styles
  const accentHex = role === "regulatory" ? "#38bdf8" : role === "farmer" ? "#fbbf24" : "#34d399";

  // ── Submit handlers ─────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try { await login(loginForm.email, loginForm.password); }
    catch (err) { setError(err.response?.data?.detail || "Invalid credentials."); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!form.gdprConsent) return;
    setError(""); setLoading(true);
    try {
      const fullName = form.contactPerson || form.farmerName || form.orgName || form.email;
      const organisation = form.brandName || form.orgName || form.farmName || "";
      await register(form.email, form.password, fullName, organisation, role, form);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  // ── Step renderers ──────────────────────────────────────────────────────────
  const fc = roleInfo?.inputFocus;
  const ac = accentHex;

  const renderBrandStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <Field label="Brand Name"><Inp focusCls={fc} value={form.brandName} onChange={e => set("brandName", e.target.value)} placeholder="Acme Fashion Group" /></Field>
          <Field label="Headquarters Country"><Inp focusCls={fc} value={form.hqCountry} onChange={e => set("hqCountry", e.target.value)} placeholder="Germany" /></Field>
          <Field label="Contact Person"><Inp focusCls={fc} value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)} placeholder="Dr. Jane Smith" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Inp focusCls={fc} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@brand.com" required /></Field>
            <Field label="Password"><Inp focusCls={fc} type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" required /></Field>
          </div>
          <Field label="Team Size"><Sel focusCls={fc} value={form.teamSize} onChange={e => set("teamSize", e.target.value)} options={["1–10", "11–50", "51–200", "201–1000", "1000+"]} /></Field>
        </div>
      );
      case 1: return (
        <div className="space-y-3">
          <p className="text-xs text-white/35 pb-1">Select the compliance modules your organisation needs</p>
          <CheckItem label="EUDR Monitoring" accentDot="bg-emerald-400" checked={form.eudr} onChange={e => set("eudr", e.target.checked)} />
          <CheckItem label="Organic / Regenerative Verification" accentDot="bg-emerald-400" checked={form.organicRegen} onChange={e => set("organicRegen", e.target.checked)} />
          <CheckItem label="Biodiversity Reporting" accentDot="bg-emerald-400" checked={form.biodiversity} onChange={e => set("biodiversity", e.target.checked)} />
          <CheckItem label="Digital Product Passport (DPP) T4" accentDot="bg-emerald-400" checked={form.dpp} onChange={e => set("dpp", e.target.checked)} />
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          <Field label="Add Suppliers / Farms">
            <textarea value={form.suppliers} onChange={e => set("suppliers", e.target.value)} placeholder="Supplier A — Brazil&#10;Supplier B — India&#10;…" rows={3}
              className={`${makeInputCls(fc)} resize-none`} />
          </Field>
          <Field label="Upload Sourcing Regions (Optional)">
            <div className="w-full bg-white/[0.02] border border-dashed border-white/15 rounded-xl px-3 py-5 text-center cursor-pointer hover:border-white/30 hover:bg-white/[0.04] transition-all">
              <p className="text-xs text-white/30">Drop GeoJSON or Shapefile here · or click to browse</p>
            </div>
          </Field>
          <Toggle label="Connect APIs" description="Link third-party supply chain data sources" checked={form.connectApis} onChange={v => set("connectApis", v)} accentHex={ac} />
        </div>
      );
      case 3: return (
        <div className="space-y-5">
          <Field label="Risk Alerts">
            <div className="space-y-2 mt-1">
              <Toggle label="High Risk" checked={form.riskHigh} onChange={v => set("riskHigh", v)} accentHex={ac} />
              <Toggle label="Medium Risk" checked={form.riskMedium} onChange={v => set("riskMedium", v)} accentHex={ac} />
              <Toggle label="Low Risk" checked={form.riskLow} onChange={v => set("riskLow", v)} accentHex={ac} />
            </div>
          </Field>
          <Field label="Data Visibility">
            <div className="space-y-2 mt-1">
              {["Private", "Shared", "Public"].map(v => (
                <RadioItem key={v} label={v} value={v} current={form.dataVisibility} onChange={val => set("dataVisibility", val)} accentColor={ac} />
              ))}
            </div>
          </Field>
          <Field label="ESG Reporting Frequency">
            <Sel focusCls={fc} value={form.esgFrequency} onChange={e => set("esgFrequency", e.target.value)} options={["Monthly", "Quarterly", "Bi-annually", "Annually"]} />
          </Field>
        </div>
      );
      default: return null;
    }
  };

  const renderRegulatoryStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <Field label="Organization Name"><Inp focusCls={fc} value={form.orgName} onChange={e => set("orgName", e.target.value)} placeholder="EU Certification Authority" /></Field>
          <Field label="Authority Type"><Sel focusCls={fc} value={form.authorityType} onChange={e => set("authorityType", e.target.value)} options={["EU Competent Authority", "Certification Body", "NGO", "National Authority", "International Body"]} /></Field>
          <Field label="Country / Jurisdiction"><Inp focusCls={fc} value={form.jurisdiction} onChange={e => set("jurisdiction", e.target.value)} placeholder="Austria" /></Field>
          <Field label="Accreditation Type"><Inp focusCls={fc} value={form.accreditation} onChange={e => set("accreditation", e.target.value)} placeholder="ISO 17065, EUDR Art. 10…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Inp focusCls={fc} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@authority.eu" required /></Field>
            <Field label="Password"><Inp focusCls={fc} type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" required /></Field>
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-3">
          <p className="text-xs text-white/35 pb-1">Select your primary role within the organisation</p>
          {["Inspector", "Auditor", "Reviewer", "Admin"].map(r => (
            <RadioItem key={r} label={r} value={r} current={form.regRole} onChange={val => set("regRole", val)} accentColor={ac} />
          ))}
        </div>
      );
      case 2: return (
        <div className="space-y-3">
          <p className="text-xs text-white/35 pb-1">Enable compliance modules for your authority</p>
          <CheckItem label="EUDR Monitoring" accentDot="bg-sky-400" checked={form.eudrMod} onChange={e => set("eudrMod", e.target.checked)} />
          <CheckItem label="Organic Regulation (EU 2018/848)" accentDot="bg-sky-400" checked={form.organicMod} onChange={e => set("organicMod", e.target.checked)} />
          <CheckItem label="Carbon & GHG Tracking" accentDot="bg-sky-400" checked={form.carbonMod} onChange={e => set("carbonMod", e.target.checked)} />
          <CheckItem label="Biodiversity Assessment" accentDot="bg-sky-400" checked={form.biodiversityMod} onChange={e => set("biodiversityMod", e.target.checked)} />
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <Field label="Risk-Based Inspection Threshold"><Sel focusCls={fc} value={form.inspectionThreshold} onChange={e => set("inspectionThreshold", e.target.value)} options={["Low", "Medium", "High", "Critical"]} /></Field>
          <Field label="Geo-Monitoring Frequency"><Sel focusCls={fc} value={form.geoFrequency} onChange={e => set("geoFrequency", e.target.value)} options={["Daily", "Weekly", "Bi-weekly", "Monthly"]} /></Field>
          <Field label="Evidence Requirements">
            <textarea value={form.evidenceReq} onChange={e => set("evidenceReq", e.target.value)} placeholder="Describe required audit evidence…" rows={3}
              className={`${makeInputCls(fc)} resize-none`} />
          </Field>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <Field label="Upload Audit Datasets">
            <div className="w-full bg-white/[0.02] border border-dashed border-white/15 rounded-xl px-3 py-5 text-center cursor-pointer hover:border-white/30 hover:bg-white/[0.04] transition-all">
              <p className="text-xs text-white/30">Drop CSV / Excel / GeoJSON here · or click to browse</p>
            </div>
          </Field>
          <Toggle label="Connect EO / Satellite Feeds" description="Sentinel-2, Landsat or custom EO sources" checked={form.connectApis} onChange={v => set("connectApis", v)} accentHex={ac} />
          <Field label="API Integration Key (optional)"><Inp focusCls={fc} value={form.suppliers} onChange={e => set("suppliers", e.target.value)} placeholder="Enter API endpoint or key…" /></Field>
        </div>
      );
      default: return null;
    }
  };

  const renderFarmerStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Farmer Name"><Inp focusCls={fc} value={form.farmerName} onChange={e => set("farmerName", e.target.value)} placeholder="John Müller" /></Field>
            <Field label="Farm Name"><Inp focusCls={fc} value={form.farmName} onChange={e => set("farmName", e.target.value)} placeholder="Sunny Meadow Farm" /></Field>
          </div>
          <Field label="Location (GPS / address)"><Inp focusCls={fc} value={form.location} onChange={e => set("location", e.target.value)} placeholder="48.2082° N, 16.3738° E" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Farm Size (ha)"><Inp focusCls={fc} type="number" value={form.farmSize} onChange={e => set("farmSize", e.target.value)} placeholder="12.5" /></Field>
            <Field label="Crop Type"><Inp focusCls={fc} value={form.cropType} onChange={e => set("cropType", e.target.value)} placeholder="Cotton, Coffee…" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Inp focusCls={fc} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@farm.com" required /></Field>
            <Field label="Password"><Inp focusCls={fc} type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" required /></Field>
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-3">
          {[
            { title: "Draw Farm Boundary", color: "#34d399", desc: "Use the map drawing tool on the dashboard after login to define your exact farm area." },
            { title: "Auto Satellite Validation", color: "#38bdf8", desc: "Sentinel-2 imagery validates your boundary within 24 hours automatically." },
          ].map(({ title, color, desc }) => (
            <div key={title} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <p className="text-sm text-white font-medium">{title}</p>
              </div>
              <p className="text-xs text-white/35 pl-4">{desc}</p>
            </div>
          ))}
          <div className="flex items-start gap-2.5 bg-amber-400/[0.07] border border-amber-400/20 rounded-xl p-3.5">
            <span className="text-amber-400 text-sm">&#9432;</span>
            <p className="text-xs text-amber-300/80">Your unique Farm ID is auto-generated upon boundary confirmation.</p>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-5">
          <Field label="Farming Practice">
            <div className="space-y-2 mt-1">
              {["Organic", "In Conversion", "Conventional"].map(p => (
                <RadioItem key={p} label={p} value={p} current={form.farmingPractice} onChange={val => set("farmingPractice", val)} accentColor={ac} />
              ))}
            </div>
          </Field>
          <Field label="Regenerative Practices">
            <div className="space-y-2 mt-1">
              <CheckItem label="Agroforestry" accentDot="bg-amber-400" checked={form.regenAgroforestry} onChange={e => set("regenAgroforestry", e.target.checked)} />
              <CheckItem label="Cover Cropping" accentDot="bg-amber-400" checked={form.regenCoverCrop} onChange={e => set("regenCoverCrop", e.target.checked)} />
              <CheckItem label="No-Till / Reduced Tillage" accentDot="bg-amber-400" checked={form.regenNoTill} onChange={e => set("regenNoTill", e.target.checked)} />
            </div>
          </Field>
          <Field label="Input Usage">
            <div className="space-y-2 mt-1">
              <CheckItem label="Synthetic Fertilizers" accentDot="bg-amber-400" checked={form.inputFertilizer} onChange={e => set("inputFertilizer", e.target.checked)} />
              <CheckItem label="Pesticides" accentDot="bg-amber-400" checked={form.inputPesticides} onChange={e => set("inputPesticides", e.target.checked)} />
            </div>
          </Field>
        </div>
      );
      case 3: return (
        <div className="space-y-2.5">
          <p className="text-xs text-white/35 pb-1">Toggle tools to pre-activate on your dashboard</p>
          {[
            { k: "toolSoil",       label: "Soil Health Monitor" },
            { k: "toolYield",      label: "Crop Yield Predictor" },
            { k: "toolPest",       label: "Pest & Disease Alerts" },
            { k: "toolIrrigation", label: "Irrigation Planner" },
            { k: "toolCarbon",     label: "Carbon Capture Calculator" },
            { k: "toolMarket",     label: "Market Access Hub" },
          ].map(({ k, label }) => (
            <Toggle key={k} label={label} checked={form[k]} onChange={v => set(k, v)} accentHex={ac} />
          ))}
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <Field label="Supporting Documents (optional)">
            <div className="w-full bg-white/[0.02] border border-dashed border-white/15 rounded-xl px-3 py-5 text-center cursor-pointer hover:border-white/30 hover:bg-white/[0.04] transition-all">
              <p className="text-xs text-white/30">Upload organic certificates, land titles, etc.</p>
            </div>
          </Field>
          <CheckItem label="I accept satellite & IoT monitoring of my farm" accentDot="bg-amber-400" checked={form.acceptMonitoring} onChange={e => set("acceptMonitoring", e.target.checked)} />
          <CheckItem label="I consent to data sharing for compliance purposes" accentDot="bg-amber-400" checked={form.dataConsent} onChange={e => set("dataConsent", e.target.checked)} />
        </div>
      );
      default: return null;
    }
  };

  const renderFinalStep = () => {
    const org = form.brandName || form.orgName || form.farmName;
    const roleLabel = role === "brand" ? "Fashion Brand / Retailer" : role === "regulatory" ? "Regulatory Body" : "Farmer / Producer";
    return (
      <div className="space-y-4">
        {/* Summary card */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-2.5">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-white/30 mb-3">Account Summary</p>
          {[
            ["Role", roleLabel],
            form.email && ["Email", form.email],
            org && ["Organisation", org],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-sm">
              <span className="text-white/35">{k}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}
        </div>
        <CheckItem
          label="I agree to the FFBS Terms of Service and Privacy Policy (GDPR)"
          accentDot={role === "regulatory" ? "bg-sky-400" : role === "farmer" ? "bg-amber-400" : "bg-emerald-400"}
          checked={form.gdprConsent}
          onChange={e => set("gdprConsent", e.target.checked)}
        />
        {error && (
          <div className="text-red-400 text-sm bg-red-400/[0.08] border border-red-400/20 rounded-xl px-4 py-3">{error}</div>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (isFinalStep) return renderFinalStep();
    if (role === "brand")      return renderBrandStep();
    if (role === "regulatory") return renderRegulatoryStep();
    if (role === "farmer")     return renderFarmerStep();
    return null;
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (view === "login") return (
    <Page>
      {/* Logo + brand */}
      <div className="text-center mb-10">
        <img src="/ffbs_monotone.png" alt="FFBS" className="h-14 w-auto mx-auto mb-3"
          style={{ filter: " opacity(0.5)" }}
          onError={e => { e.target.style.display = "none"; }} />
        <p className="text-[9px] tracking-[0.35em] uppercase text-white/25 font-semibold">Fashion for Bio-Diversity</p>
      </div>

      <h1 className="text-[2rem] font-bold text-white text-center leading-tight tracking-tight mb-2">
        Welcome to the<br />
        <span className="text-transparent bg-clip-text"
          style={{ backgroundImage: "linear-gradient(90deg, #34d399, #5eead4)" }}>
          FFBS Dashboard
        </span>
      </h1>
      <p className="text-white/40 text-sm text-center mb-8">Connecting Fashion to Earth's Biodiversity</p>

      {/* Card */}
      <div className="w-full rounded-2xl border border-white/[0.07] overflow-hidden" style={GLASS}>
        {/* Top accent line */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #34d399, #5eead4, transparent)" }} />

        <div className="p-6">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-white/[0.05] p-1 mb-6 gap-1">
            <button className="flex-1 py-2 text-sm font-semibold rounded-lg text-white transition-all"
              style={{ background: "rgba(255,255,255,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              Sign In
            </button>
            <button onClick={() => { setView("role-select"); setError(""); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-white/40 hover:text-white/70 transition-all">
              Create Account
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email">
              <Inp type="email" value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@organisation.com" required
                focusCls="focus:border-emerald-400/50 focus:ring-emerald-400/10"
                icon={<IconEmail />} />
            </Field>
            <Field label="Password">
              <Inp type="password" value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" required
                focusCls="focus:border-emerald-400/50 focus:ring-emerald-400/10"
                icon={<IconLock />} />
            </Field>

            {error && (
              <div className="text-red-400 text-xs bg-red-400/[0.08] border border-red-400/20 rounded-xl px-4 py-3">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full font-bold rounded-xl py-3 text-sm text-gray-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #34d399, #2dd4bf)",
                boxShadow: "0 0 24px rgba(52,211,153,0.35), 0 2px 8px rgba(0,0,0,0.3)"
              }}>
              {loading ? "Signing in…" : <><span>Sign In</span><IconArrow /></>}
            </button>
          </form>
        </div>
      </div>

      <p className="text-white/20 text-[11px] mt-8 tracking-wide">FFBS · EO Certification Intelligence Platform · v2.0</p>
    </Page>
  );

  // ── ROLE SELECT ───────────────────────────────────────────────────────────
  if (view === "role-select") return (
    <Page wide>
      <div className="text-center mb-10">
        <img src="/ffbs-logo.png" alt="FFBS" className="h-11 w-auto mx-auto mb-3"
          style={{ filter: "grayscale(1) brightness(0) invert(1) opacity(0.85)" }}
          onError={e => { e.target.style.display = "none"; }} />
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Create Your FFBS Account</h1>
        <p className="text-white/40 text-sm">Choose your role to unlock tailored sustainability intelligence</p>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {ROLES.map(r => {
          const RoleIcon = r.Icon;
          return (
            <button key={r.id}
              onClick={() => { setRole(r.id); setStep(0); setForm(INIT); setView("register"); }}
              className={`text-left rounded-2xl border transition-all duration-200 hover:scale-[1.02] group ${r.border} ${r.hoverBorder} ${r.hoverShadow}`}
              style={{ background: `linear-gradient(145deg, ${r.cardBg.includes("emerald") ? "rgba(52,211,153,0.06)" : r.cardBg.includes("sky") ? "rgba(56,189,248,0.06)" : "rgba(251,191,36,0.06)"} 0%, rgba(6,16,26,0.4) 100%)`, backdropFilter: "blur(16px)" }}>
              <div className="p-5">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${r.iconBg}`}>
                  <RoleIcon />
                </div>
                {/* Title */}
                <p className="text-white font-bold text-base leading-tight mb-0.5">{r.title}</p>
                <p className={`text-xs font-medium mb-4 ${r.accent}`}>{r.subtitle}</p>
                {/* Features */}
                <ul className="space-y-2">
                  {r.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                      <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Bottom CTA bar */}
              <div className={`px-5 py-3 border-t border-white/[0.05] flex items-center justify-between`}>
                <span className="text-xs text-white/30 group-hover:text-white/60 transition-colors">Get started</span>
                <span className={`text-xs font-semibold ${r.accent} opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-0.5`}>→</span>
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={() => { setView("login"); setError(""); }}
        className="text-sm text-white/25 hover:text-white/55 transition-colors">
        ← Back to Sign In
      </button>
      <p className="text-white/15 text-[11px] mt-8">FFBS · EO Certification Intelligence Platform · v2.0</p>
    </Page>
  );

  // ── REGISTER (multi-step) ────────────────────────────────────────────────
  return (
    <Page>
      {/* Back + role badge */}
      <div className="flex items-center gap-3 mb-5 self-start w-full">
        <button
          onClick={() => step === 0 ? setView("role-select") : setStep(s => s - 1)}
          className="text-white/35 hover:text-white/70 transition-colors text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
        {roleInfo && (
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${roleInfo.badge}`}>
            {roleInfo.title}{roleInfo.subtitle}
          </span>
        )}
      </div>

      {/* Card */}
      <div className="w-full rounded-2xl border border-white/[0.07] overflow-hidden" style={GLASS}>
        {/* Top accent line in role color */}
        <div className="h-px w-full" style={{
          background: `linear-gradient(90deg, transparent, ${accentHex}, transparent)`
        }} />

        <div className="p-6">
          {/* Step header */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-white/30">
                Step {step + 1} of {totalSteps}
              </p>
              <p className="text-[11px] text-white/25">{Math.round(((step + 1) / totalSteps) * 100)}%</p>
            </div>
            <h2 className="text-lg font-bold text-white">{steps[step]}</h2>

            {/* Progress bar */}
            <div className="flex gap-1 mt-3">
              {steps.map((_, i) => (
                <div key={i} className="h-0.5 flex-1 rounded-full overflow-hidden bg-white/[0.08]">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: i < step ? "100%" : i === step ? "100%" : "0%",
                      background: i <= step ? accentHex : "transparent",
                      opacity: i < step ? 0.5 : 1,
                    }} />
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="max-h-[52vh] overflow-y-auto pr-0.5 scrollbar-hide">
            {renderCurrentStep()}
          </div>

          {/* CTA */}
          <div className="mt-5">
            {isFinalStep ? (
              <button type="button" onClick={handleRegister}
                disabled={loading || !form.gdprConsent}
                className="w-full font-bold rounded-xl py-3 text-sm text-gray-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${accentHex}, ${role === "farmer" ? "#fb923c" : role === "regulatory" ? "#3b82f6" : "#2dd4bf"})`,
                  boxShadow: `0 0 24px ${accentHex}55, 0 2px 8px rgba(0,0,0,0.3)`
                }}>
                {loading ? "Creating account…" : <><span>Create Account & Enter Dashboard</span><IconCheck /></>}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(s => s + 1)}
                className="w-full font-bold rounded-xl py-3 text-sm text-gray-950 transition-all flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${accentHex}, ${role === "farmer" ? "#fb923c" : role === "regulatory" ? "#3b82f6" : "#2dd4bf"})`,
                  boxShadow: `0 0 20px ${accentHex}44, 0 2px 8px rgba(0,0,0,0.3)`
                }}>
                <span>Continue</span><IconArrow />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-white/15 text-[11px] mt-8">FFBS · EO Certification Intelligence Platform · v2.0</p>
    </Page>
  );
}
