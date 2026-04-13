import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", organisation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <img src="/ffbs-logo.png" alt="FFBS" className="h-14 w-auto mx-auto mb-4"
            onError={e => { e.target.style.display = "none"; }} />
          <h1 className="text-2xl font-bold text-white">FFBS Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">EO-Based Organic & Biodiversity Assessment</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "login" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "register" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Full Name</label>
                  <input type="text" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Dr. Jane Smith"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lime-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Organisation</label>
                  <input type="text" value={form.organisation}
                    onChange={e => setForm({ ...form, organisation: e.target.value })}
                    placeholder="FFBS / Research Institute"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lime-400" />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@organisation.com" required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lime-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" required minLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-lime-400" />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-gray-900 font-semibold rounded-lg py-2.5 text-sm transition-colors">
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          FFBS · EO Certification Intelligence Platform · v2.0
        </p>
      </div>
    </div>
  );
}
