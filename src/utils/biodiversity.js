export function countSpeciesFromGeoJSON(geojson) {
  const speciesCounts = {};
  geojson.features.forEach((feature) => {
    const species = feature.properties?.name;
    if (species) speciesCounts[species] = (speciesCounts[species] || 0) + 1;
  });
  return speciesCounts;
}

export function calculateDiversity(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const proportions = Object.values(counts).map(c => c / total);
  const shannon = -proportions.reduce((sum, p) => sum + p * Math.log(p), 0);
  const simpson = 1 - proportions.reduce((sum, p) => sum + p * p, 0);
  const richness = Object.keys(counts).length;
  const evenness = richness > 1 ? shannon / Math.log(richness) : 1;
  return {
    shannon: Number(shannon.toFixed(4)),
    simpson: Number(simpson.toFixed(4)),
    richness,
    evenness: Number(evenness.toFixed(4)),
  };
}
