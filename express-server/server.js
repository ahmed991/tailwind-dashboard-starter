const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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
app.post("/api/gbif/species", async (req, res) => {
  const { geometry } = req.body;
  if (!geometry) return res.status(400).json({ error: "Missing geometry" });

  try {
    const url = `https://api.gbif.org/v1/occurrence/search`;
    const { data } = await axios.get(url, {
      params: {
        hasCoordinate: true,
        geometry,
        limit: 300,
      },
    });

    const speciesSet = new Set(data.results.map(r => r.species).filter(Boolean));
    res.json({ species: [...speciesSet], count: speciesSet.size });
  } catch (err) {
    console.error("❌ GBIF API error:", err);
    res.status(500).json({ error: "GBIF API call failed" });
  }
});

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
    const speciesSet = new Set(results.map(obs => obs.species_guess).filter(Boolean));
    res.json({ species: [...speciesSet], count: speciesSet.size });

  } catch (err) {
    console.error("❌ iNaturalist API error:", err);
    res.status(500).json({ error: "Failed to fetch from iNaturalist" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
