/**
 * FFBS API Client
 * Central axios instance — all backend calls go through here.
 * Token is read from localStorage and injected automatically.
 */
import axios from "axios";

/**
 * Base URL for all backend calls.
 * - Dev:  "" (empty) — Vite proxy rewrites /api → Express, /fastapi → FastAPI
 * - Prod: set VITE_API_BASE_URL to the Lightsail container service public URL
 *         e.g. https://container-service-1.abc123.us-east-1.cs.amazonlightsail.com
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const BASE_URL = `${API_BASE}/fastapi`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000, // EO processing can be slow
});

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ffbs_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ffbs_token");
      localStorage.removeItem("ffbs_user");
      window.dispatchEvent(new Event("ffbs:logout"));
    }
    return Promise.reject(err);
  }
);

export default api;


// ---------- Auth ----------
export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (email, password) =>
    api.post(
      "/auth/login",
      new URLSearchParams({ username: email, password }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    ),
  me: () => api.get("/auth/me"),
};


// ---------- Farms ----------
export const farmsApi = {
  list: () => api.get("/farms/"),
  get: (id) => api.get(`/farms/${id}`),
  create: (data) => api.post("/farms/", data),
  update: (id, data) => api.put(`/farms/${id}`, data),
  delete: (id) => api.delete(`/farms/${id}`),
  geojson: (id) => api.get(`/farms/${id}/geojson`),
};


// ---------- Sensors ----------
export const sensorsApi = {
  list: () => api.get("/sensors/"),
  get: (name) => api.get(`/sensors/${name}`),

  process: (data) => api.post("/sensors/process", data),

  searchSentinel3: (data) => api.post("/sensors/sentinel-3/search", data),
  sentinel3ProductTypes: () => api.get("/sensors/sentinel-3/product-types"),

  listJobs: (farmId) =>
    api.get("/sensors/jobs/", farmId ? { params: { farm_id: farmId } } : {}),
  getJob: (id) => api.get(`/sensors/jobs/${id}`),
};


// ---------- Legacy endpoints (existing proxy) ----------
const LEGACY_BASE = `${API_BASE}/api`;
const legacy = axios.create({ baseURL: LEGACY_BASE, timeout: 120_000 });

export const legacyApi = {
  computeIndex: (data) => legacy.post("/indicator/process", data),
  landcoverEsa: (data) => legacy.post("/landcover/esa", data),
  gbifSpecies: (data) => legacy.post("/gbif/species", data),
  inatSpecies: (data) => legacy.post("/inaturalist/species", data),
  ebirdSpecies: (data) => legacy.post("/ebird/species", data),
  ebirdHotspots: (data) => legacy.post("/ebird/hotspots", data),
  historicalPreview: (data) => legacy.post("/preview/historical-preview", data),
  uploadGeojson: (formData) => legacy.post("/upload-geojson", formData),
};
