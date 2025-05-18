export function useSpeciesFetch({
    setGbifSpeciesList,
    setInatSpeciesList,
    setEbirdSpeciesList,
    setEbirdHotspots
  }) {
    const fetchSpeciesFromGBIF = async (geometry) => {
      try {
        const res = await fetch("http://localhost:3001/api/gbif/species", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geometry })
        });
        const data = await res.json();
        const species = data?.results?.length
          ? data.results.map(d => d.species).filter(Boolean)
          : data.species || [];
  
        setGbifSpeciesList(Array.from(new Set(species)));
      } catch {
        setGbifSpeciesList([]);
      }
    };
  
    const fetchSpeciesFromINat = async (geometry) => {
      try {
        const res = await fetch("http://localhost:3001/api/inaturalist/species", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geometry })
        });
        const data = await res.json();
        setInatSpeciesList(data.species || []);
      } catch {
        setInatSpeciesList([]);
      }
    };
  
    const fetchSpeciesFromEBird = async (lat, lng) => {
      try {
        const res = await fetch("http://localhost:3001/api/ebird/species", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng })
        });
        const data = await res.json();
        setEbirdSpeciesList(data.species || []);
      } catch {
        setEbirdSpeciesList([]);
      }
    };
  
    const fetchHotspotsFromEBird = async (lat, lng) => {
      try {
        const res = await fetch("http://localhost:3001/api/ebird/hotspots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng })
        });
  
        const text = await res.json();
        const lines = text.hotspots.trim().split("\n");
        const hotspots = lines.slice(1).map(line => {
          const parts = line.split(",");
          return {
            lng: parseFloat(parts[4]),
            lat: parseFloat(parts[5]),
            locName: parts[6]?.trim() || "Unnamed Hotspot"
          };
        });
  
        setEbirdHotspots(hotspots);
      } catch {
        setEbirdHotspots([]);
      }
    };
  
    return {
      fetchSpeciesFromGBIF,
      fetchSpeciesFromINat,
      fetchSpeciesFromEBird,
      fetchHotspotsFromEBird
    };
  }
  