const express = require("express");
const multer = require('multer');

const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const upload = multer();  // for multipart/form-data
const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// 🔵 GBIF Species API
app.post("/api/gbif/species", async (req, res) => {
  const { geometry } = req.body;

  if (!geometry) {
    return res.status(400).json({ error: "Missing geometry" });
  }

  try {
    const url = `https://api.gbif.org/v1/occurrence/search`;
    const { data } = await axios.get(url, {
      params: {
        hasCoordinate: true,
        geometry,
        limit: 300
      }
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

    // iNaturalist bounding box API
    const url = `https://api.inaturalist.org/v1/observations`;
    const response = await axios.get(url, {
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

    const results = response.data.results || [];

    const speciesSet = new Set(
      results.map(obs => obs.species_guess).filter(Boolean)
    );

    res.json({
      species: [...speciesSet],
      count: speciesSet.size
    });

  } catch (err) {
    console.error("❌ iNaturalist API error:", err);
    res.status(500).json({ error: "Failed to fetch from iNaturalist" });
  }
});
app.post('/api/upload-geojson', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const geojson = JSON.parse(req.file.buffer.toString());
    res.json({ geojson });
  } catch (err) {
    res.status(400).json({ error: 'Invalid GeoJSON' });
  }
});
app.listen(port, () => {
  console.log(`🚀 Express server running at http://localhost:${port}`);
});
