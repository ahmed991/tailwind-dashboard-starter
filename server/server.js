require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const axios = require("axios");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// CDSE constants
const CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const CDSE_CATALOG_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1";

async function getCdseToken() {
  const params = new URLSearchParams({
    client_id: "cdse-public",
    username: process.env.CDSE_USER || "",
    password: process.env.CDSE_PASSWORD || "",
    grant_type: "password",
  });
  const res = await axios.post(CDSE_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });
  return res.data.access_token;
}

function wktToBbox(wkt) {
  // Extract all coordinate pairs from WKT polygon
  const matches = wkt.match(/-?\d+\.?\d*\s+-?\d+\.?\d*/g) || [];
  const coords = matches.map(pair => pair.trim().split(/\s+/).map(Number));
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}


const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, "uploads");
const GEOJSON_DIR = path.join(UPLOAD_DIR, "geojson");
fs.mkdirSync(GEOJSON_DIR, { recursive: true });

// Serve static files
app.use('/uploads', express.static(UPLOAD_DIR));

// Setup multer storage for general uploads
const generalStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const generalUpload = multer({ storage: generalStorage });

// Setup multer storage for GeoJSON files
const geojsonStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GEOJSON_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const geojsonUpload = multer({
  storage: geojsonStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".geojson" || ext === ".json") cb(null, true);
    else cb(new Error("Only .geojson or .json files are allowed"));
  }
});

// ✅ Upload GeoJSON → save and return file + contents
app.post('/api/upload-geojson', geojsonUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const savedPath = path.join(GEOJSON_DIR, req.file.filename);
  const filePath = `/uploads/geojson/${req.file.filename}`;

  try {
    const raw = fs.readFileSync(savedPath, "utf-8");
    const geojson = JSON.parse(raw);
    res.json({ filePath, geojson });
  } catch (err) {
    console.error("❌ Invalid GeoJSON file:", err);
    res.status(400).json({ error: "Invalid GeoJSON format" });
  }
});

// Optional: General file upload route
app.post('/api/upload', generalUpload.single('file'), (req, res) => {
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ filePath });
});

// 🔵 GBIF Species API
// TODO add date filter front end and here backend
app.post("/api/gbif/species", async (req, res) => {
  const { geometry } = req.body;
  if (!geometry) return res.status(400).json({ error: "Missing geometry" });

  try {
    const url = `https://api.gbif.org/v1/occurrence/search`;
    const { data } = await axios.get(url, {
      params: {
        hasCoordinate: true,
        geometry,
        limit: 1000,
      },
    });


    const speciesSet = new Set(data.results.map(r => r.species).filter(Boolean));

    const features = data.results
      .filter(r => r.decimalLatitude && r.decimalLongitude && r.genericName)
      .map(r => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [r.decimalLongitude, r.decimalLatitude],
        },
        properties: {
          name: r.genericName,
          date: r.eventDate || r.dateIdentified || null,
          kingdom: r.kingdom || "Unknown",
          classification:
            r.kingdom === "Plantae"
              ? "flora"
              : r.kingdom === "Animalia"
              ? "fauna"
              : "other",
        },
      }));

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    res.json({
      species: [...speciesSet],
      count: speciesSet.size,
      geojson,
    });

    console.log(features.length, "valid geo-observations returned");
  } catch (err) {
    console.error("❌ GBIF API error:", err);
    res.status(500).json({ error: "GBIF API call failed" });
  }
});


// 🟢 iNaturalist Species API
// TODO add date filter front end and here backend
// 🟢 iNaturalist Species API
app.post("/api/inaturalist/species", async (req, res) => {
  const { geometry } = req.body;
  if (!geometry) return res.status(400).json({ error: "Missing geometry" });

  try {
    // Convert WKT POLYGON to bounding box
    const coords = geometry
      .replace("POLYGON((", "")
      .replace("))", "")
      .split(",")
      .map(p => p.trim().split(" ").map(Number));

    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    const minLng = Math.min(...lons);
    const maxLng = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const url = `https://api.inaturalist.org/v1/observations`;
    const { data } = await axios.get(url, {
      params: {
        nelat: maxLat,
        nelng: maxLng,
        swlat: minLat,
        swlng: minLng,
        per_page: 200,
        verifiable: true,
        order_by: "observed_on",
        order: "desc"
      }
    });

    const results = data.results || [];

    // Unique species list
    const speciesSet = new Set(results.map(obs => obs.species_guess).filter(Boolean));

    // Build GeoJSON
    const geojson = {
      type: "FeatureCollection",
      features: results
        .filter(obs => obs.geojson && obs.species_guess)
        .map(obs => ({
          type: "Feature",
          geometry: obs.geojson, // already GeoJSON Point
          properties: {
            name: obs.species_guess,
            date: obs.observed_on || "",
            observer: obs.user?.login || "Unknown"
          }
        }))
    };

    res.json({
      species: [...speciesSet],
      count: speciesSet.size,
      geojson
    });

  } catch (err) {
    console.error("❌ iNaturalist API error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to fetch from iNaturalist" });
    }
  }
});


// 🖼️ Thumbnail proxy — strips CORS restrictions so Mapbox can load satellite thumbnails
app.get('/api/thumbnail-proxy', async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send("Missing url param");
  // Relative paths or localhost:8000 URLs — resolve against internal FASTAPI_URL
  if (url.startsWith("/")) url = `${FASTAPI_URL}${url}`;
  url = url.replace(/http:\/\/localhost:8000/g, FASTAPI_URL);
  try {
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.set("Content-Type", contentType);
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(response.data);
  } catch (err) {
    console.error("❌ Thumbnail proxy error:", url, "→", err.message);
    res.status(502).send("Failed to fetch thumbnail");
  }
});

// 🛰️ Proxy to FastAPI historical viewer (multi-sensor)
app.post('/api/preview/historical-preview', async (req, res) => {
  const { geojson, start_date, end_date, sensors, cloud_cover } = req.body;

  if (!geojson || !start_date || !end_date) {
    return res.status(400).json({ error: "Missing geojson or date range" });
  }

  try {
    const { data } = await axios.post(`${FASTAPI_URL}/historical-viewer`, {
      geojson,
      start_date,
      end_date,
      sensors: sensors || ["sentinel-2"],
      cloud_cover: cloud_cover ?? 30,
    });

    // Normalise: older API wraps in {status, result}, new one doesn't need to
    const thumbnails = data.thumbnails ?? data.result?.thumbnails ?? [];
    const count = data.count ?? data.result?.count ?? thumbnails.length;
    res.json({ thumbnails, count });
  } catch (err) {
    console.error("❌ FastAPI proxy error:", err.message);
    res.status(500).json({ error: "Failed to fetch from historical viewer API" });
  }
});


// 🌿 Proxy to FastAPI organic endpoints
const ORGANIC_ENDPOINTS = new Set([
  "crop-rotation", "cover-crop", "compost-map",
  "soil-carbon", "chemical-free", "buffer-zone"
]);

app.post("/api/organic/:endpoint", async (req, res) => {
  const { endpoint } = req.params;
  if (!ORGANIC_ENDPOINTS.has(endpoint)) {
    return res.status(404).json({ error: `Unknown organic endpoint: ${endpoint}` });
  }
  try {
    const { data } = await axios.post(`${FASTAPI_URL}/organic/${endpoint}`, req.body);
    res.json(data);
  } catch (err) {
    console.error(`❌ Organic proxy error [${endpoint}]:`, err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

// 🟢 Proxy to FastAPI process_indicator (NDVI/NDWI/etc.)
app.post("/api/indicator/process", async (req, res) => {
  const {
    geojson,
    start_date,
    end_date,
    satellite_sensor,
    indicator,
    cloud_cover,
    resample
  } = req.body;

  if (!geojson || !start_date || !end_date || !satellite_sensor || !indicator || cloud_cover === undefined || !resample) {
    return res.status(400).json({ error: "Missing one or more required fields" });
  }

  try {
    const { data } = await axios.post(`${FASTAPI_URL}/compute-index`, {
      geojson,
      start_date,
      end_date,
      satellite_sensor,
      indicator,
      cloud_cover,
      resample
    });

    // Rewrite FastAPI-internal URLs to go through Express proxy
    const rewrite = (str) =>
      typeof str === "string"
        ? str.replace(new RegExp(FASTAPI_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").replace(/http:\/\/localhost:8000/g, "").replace(/http:\/\/3\.121\.112\.193:8000/g, "")
        : str;

    const rewriteProducts = (d) => {
      if (!d) return d;
      const obj = JSON.parse(JSON.stringify(d));
      const walk = (node) => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === "object") {
          Object.keys(node).forEach(k => {
            if (["png_url","legend_url","tif_url"].includes(k)) node[k] = rewrite(node[k]);
            else node[k] = walk(node[k]);
          });
        }
        return node;
      };
      return walk(obj);
    };

    res.json(rewriteProducts(data));
  } catch (err) {
    console.error("❌ FastAPI indicator processing error:", err.message);
    res.status(500).json({ error: "Failed to process indicator in backend" });
  }
});

// 🗺️ Proxy raster PNG/legend files from FastAPI
// Accept all HTTP statuses so axios never throws — we relay the real response.
// Without this, a FastAPI 404 would cause axios to throw, and the catch block
// would return text/html which Mapbox GL cannot decode as an image.
app.get("/raster/:id", async (req, res) => {
  try {
    const response = await axios.get(`${FASTAPI_URL}/raster/${req.params.id}`, {
      responseType: "arraybuffer",
      params: req.query,
      validateStatus: () => true,          // never throw on HTTP errors
    });
    res.set("Access-Control-Allow-Origin", "*");
    if (response.status === 200) {
      res.set("Content-Type", response.headers["content-type"] || "image/png");
      res.set("Cache-Control", "no-cache"); // don't cache — files are rebuilt on each run
      res.status(200).send(response.data);
    } else {
      // Forward the error status; send an empty body so Mapbox gets a clear
      // HTTP error rather than a text payload it tries (and fails) to decode.
      console.warn(`⚠️ Raster not found: ${req.params.id} → ${response.status}`);
      res.status(response.status).end();
    }
  } catch (err) {
    // Network-level failure (FastAPI unreachable)
    console.error("❌ Raster proxy error:", req.params.id, err.message);
    res.status(502).end();
  }
});

// 🌍 Proxy ESA Landcover tile request to FastAPI backend
app.post('/api/landcover/esa', async (req, res) => {
  const { geojson, year } = req.body;

  if (!geojson || !year) {
    return res.status(400).json({ error: "Missing geojson or year" });
  }

  try {
    const response = await axios.post(`${FASTAPI_URL}/esa-landcover`, {
      geojson,
      year
    });

    res.json(response.data); // Expecting tilejson or tile URL from FastAPI
  } catch (err) {
    console.error("❌ ESA landcover FastAPI proxy error:", err.message);
    res.status(500).json({ error: "Failed to fetch from ESA landcover backend." });
  }
});
app.post("/api/ebird/hotspots", async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });

  try {
    const url = `https://api.ebird.org/v2/ref/hotspot/geo?lat=${lat}&lng=${lng}&dist=20&fmt=csv`;
    const { data } = await axios.get(url, {
      headers: {
        "X-eBirdApiToken": '297kofu4lrf1',
      },
      responseType: "text",
    });

    const lines = data.trim().split("\n");

    // No header; parse directly
    const features = lines.map((line, i) => {
      const cols = line.split(",");
      const lat = parseFloat(cols[4]);
      const lng = parseFloat(cols[5]);
      const name = cols[6]?.trim() || `Hotspot ${i + 1}`;

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          id: cols[0],
          name,
        }
      };
    });

    const geojson = {
      type: "FeatureCollection",
      features
    };

    res.json({ geojson, count: features.length });
  } catch (err) {
    console.error("❌ eBird hotspot API error:", err.message);
    res.status(500).json({ error: "Failed to fetch or parse eBird hotspot data." });
  }
});

app.post("/api/ebird/species", async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });

  try {
    const url = `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}&sort=species`;
    const { data } = await axios.get(url, {
      headers: {
        "X-eBirdApiToken": '297kofu4lrf1',
      },
    });
console.log(data, "eBird species data");
    const geojson = {
      type: "FeatureCollection",
      features: data.map(obs => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [obs.lng, obs.lat]
        },
        properties: {
          speciesCode: obs.speciesCode,
          comName: obs.comName,
          sciName: obs.sciName,
          locName: obs.locName,
          obsDt: obs.obsDt,
          howMany: obs.howMany || 1
        }
      }))
    };

    const speciesSet = new Set(data.map(d => d.comName).filter(Boolean));
    const speciesList = [...speciesSet];
    // console.log("Species list:", geojson);
    return res.json({ geojson, speciesList }); // ✅ Only one response
  } catch (err) {
    console.error("❌ eBird species API error:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to fetch eBird species data." });
    }
  }
});


// ---------------------------------------------------------------------------
// Case Study — Khargone Organic Cotton Pilot (local drone/shapefile data)
// ---------------------------------------------------------------------------
const shapefile = require("shapefile");

const CS_DATA = path.resolve(__dirname, "../ffbs-backend-api/case_study_data");
const CASE_STUDY_PATHS = {
  lulc:              `${CS_DATA}/lulc/Merged_shapfile1.shp`,
  lulcUnmerged:      `${CS_DATA}/lulc/Unmerged_shapfile.shp`,
  chmVector:         `${CS_DATA}/chm/merged_chm.geojson`,
  chmUnmerged:       `${CS_DATA}/chm/Umerged_chm.shp`,
  farmBoundary:      `${CS_DATA}/farm_boundary/Khategoan project_index_ndvi___wholemap__.shp`,
  ghaziabadChromium: `${CS_DATA}/ghaziabad.geojson`,
};

function roundCoords(coords, precision = 6) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === "number") {
    return coords.map(v => Math.round(v * 10 ** precision) / 10 ** precision);
  }
  return coords.map(c => roundCoords(c, precision));
}

function simplifyGeometry(geometry) {
  if (!geometry) return geometry;
  return { ...geometry, coordinates: roundCoords(geometry.coordinates, 5) };
}

async function readShapefileAsGeoJSON(shpPath, { maxFeatures = 2000 } = {}) {
  const features = [];
  const source = await shapefile.open(shpPath);
  while (features.length < maxFeatures) {
    const result = await source.read();
    if (result.done) break;
    if (result.value) {
      features.push({
        ...result.value,
        geometry: simplifyGeometry(result.value.geometry),
      });
    }
  }
  return { type: "FeatureCollection", features };
}

app.get("/api/case-study/lulc", async (req, res) => {
  try {
    const geojson = await readShapefileAsGeoJSON(CASE_STUDY_PATHS.lulc);
    res.json(geojson);
  } catch (err) {
    console.error("❌ LULC shapefile error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/case-study/chm-vector", (_req, res) => {
  try {
    const geojson = JSON.parse(fs.readFileSync(CASE_STUDY_PATHS.chmVector, "utf8"));
    res.json(geojson);
  } catch (err) {
    console.error("❌ CHM GeoJSON error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/case-study/farm-boundary", async (req, res) => {
  try {
    const geojson = await readShapefileAsGeoJSON(CASE_STUDY_PATHS.farmBoundary);
    res.json(geojson);
  } catch (err) {
    console.error("❌ Farm boundary shapefile error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GHG — Sentinel-5P TROPOMI via CDSE
app.post("/api/ghg/search", async (req, res) => {
  const { wkt, product_type = "L2__CO____", start_date, end_date, max_results = 10 } = req.body;

  if (!process.env.CDSE_USER || !process.env.CDSE_PASSWORD) {
    return res.status(503).json({ status: "no_credentials", message: "CDSE credentials not configured." });
  }
  if (!wkt || !start_date || !end_date) {
    return res.status(400).json({ error: "wkt, start_date, and end_date are required." });
  }

  try {
    const token = await getCdseToken();
    const [minLon, minLat, maxLon, maxLat] = wktToBbox(wkt);
    const bboxWkt = `POLYGON((${minLon} ${minLat},${maxLon} ${minLat},${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))`;

    const filter = [
      `Collection/Name eq 'SENTINEL-5P'`,
      `Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq '${product_type}')`,
      `OData.CSC.Intersects(area=geography'SRID=4326;${bboxWkt}')`,
      `ContentDate/Start gt ${start_date}T00:00:00.000Z`,
      `ContentDate/Start lt ${end_date}T23:59:59.999Z`,
    ].join(" and ");

    const { data } = await axios.get(`${CDSE_CATALOG_URL}/Products`, {
      params: { $filter: filter, $orderby: "ContentDate/Start desc", $top: max_results },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });

    const products = (data.value || []).map(item => {
      // Extract bbox from GeoFootprint geometry
      let bbox = null;
      const geo = item.GeoFootprint;
      if (geo?.coordinates) {
        const flat = geo.coordinates.flat(Infinity);
        const lons = flat.filter((_, i) => i % 2 === 0);
        const lats = flat.filter((_, i) => i % 2 === 1);
        bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      }
      return {
        id: item.Id,
        name: item.Name,
        datetime: item.ContentDate?.Start,
        size_mb: Math.round(item.ContentLength / 1e6),
        online: item.Online,
        bbox,
      };
    });

    res.json({ status: "success", product_type, count: products.length, products });
  } catch (err) {
    console.error("❌ GHG/CDSE error:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GHG quicklook proxy — fetches preview JPEG from CDSE and returns it
app.get("/api/ghg/quicklook/:id", async (req, res) => {
  if (!process.env.CDSE_USER || !process.env.CDSE_PASSWORD) {
    return res.status(503).json({ message: "CDSE credentials not configured." });
  }
  try {
    const token = await getCdseToken();
    const response = await axios.get(
      `${CDSE_CATALOG_URL}/Products(${req.params.id})/quicklook`,
      { headers: { Authorization: `Bearer ${token}` }, responseType: "arraybuffer", timeout: 30000 }
    );
    res.set("Content-Type", response.headers["content-type"] || "image/jpeg");
    res.send(response.data);
  } catch (err) {
    console.error("❌ GHG quicklook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/case-study/ghaziabad-chromium", (_req, res) => {
  try {
    const geojson = JSON.parse(fs.readFileSync(CASE_STUDY_PATHS.ghaziabadChromium, "utf8"));
    res.json(geojson);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// /fastapi/* wildcard proxy — forwards to FastAPI, strips the /fastapi prefix.
// In dev, Vite handles this rewrite; in production Express is the only entry point.
// ---------------------------------------------------------------------------
app.use("/fastapi", async (req, res) => {
  const target = `${FASTAPI_URL}${req.url}`;
  const contentType = req.headers["content-type"] || "application/json";
  // Re-serialize form data so FastAPI OAuth2 login works correctly
  const data = contentType.includes("application/x-www-form-urlencoded")
    ? new URLSearchParams(req.body).toString()
    : req.body;
  try {
    const response = await axios({
      method: req.method,
      url: target,
      data,
      headers: {
        "Content-Type": contentType,
        ...(req.headers["authorization"] && { "Authorization": req.headers["authorization"] }),
      },
      responseType: "arraybuffer",
      timeout: 120_000,
    });
    res.set("Content-Type", response.headers["content-type"] || "application/json");
    res.set("Access-Control-Allow-Origin", "*");
    res.status(response.status).send(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const body = err.response?.data || Buffer.from(JSON.stringify({ error: err.message }));
    res.status(status).send(body);
  }
});

// Proxy /auth/* directly to FastAPI (used by approval email links)
app.use("/auth", async (req, res) => {
  const target = `${FASTAPI_URL}/auth${req.url}`;
  try {
    const response = await axios({
      method: req.method,
      url: target,
      data: req.body,
      headers: { "Content-Type": req.headers["content-type"] || "application/json" },
      timeout: 15_000,
    });
    res.set("Content-Type", response.headers["content-type"] || "application/json");
    res.status(response.status).send(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const body = err.response?.data || Buffer.from(JSON.stringify({ error: err.message }));
    res.status(status).send(body);
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
