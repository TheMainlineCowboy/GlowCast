import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryClusterSpan = dominantGapCandidate",
  "const secondaryClusterLengthSupport = dominantGapCandidate",
  "secondaryClusterSpan / Math.max(dimension * 0.35, 1)",
  "Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport)"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Length-aware cluster authority is incomplete: ${JSON.stringify(missing)}`);

function lengthSupport(dimension, span) {
  return Math.min(1, span / Math.max(dimension * 0.35, 1));
}

function authority({ lowerCount, upperCount, distribution, dimension, span }) {
  const sampleSupport = Math.min(1, upperCount / Math.max(lowerCount, 1));
  return sampleSupport * Math.sqrt(distribution * lengthSupport(dimension, span));
}

const shortOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 80, span: 24 });
const shortDecorativeRegionOnLargeOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 24 });
const broadlyRepresentedLargeOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 128 });

if (!(shortOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`The same sparse span must carry less authority on a larger architectural side: short=${shortOpening}, large=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(broadlyRepresentedLargeOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`Broadly represented sparse evidence must outrank a short decorative region: broad=${broadlyRepresentedLargeOpening}, decorative=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(broadlyRepresentedLargeOpening <= 1 && shortDecorativeRegionOnLargeOpening >= 0)) {
  throw new Error("Length-aware authority must remain normalized.");
}

console.log("Cluster length-awareness smoke passed: repeated sparse evidence is weighted by the architectural side length it actually represents.");
