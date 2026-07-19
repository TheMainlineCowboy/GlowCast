import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryClusterSpan = dominantGapCandidate",
  "const secondaryClusterLengthSupport = dominantGapCandidate",
  "secondaryClusterSpan / Math.max(dimension * 0.35, 1)",
  "const secondaryIndexGaps = secondaryGapIndices",
  "const secondaryPatternRegularity = secondaryIndexGaps.length >= 3",
  "const secondaryClusterPatternPenalty = dominantGapCandidate",
  "1 - 0.4 * secondaryPatternRegularity",
  "Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Length-aware periodic-pattern resistance is incomplete: ${JSON.stringify(missing)}`);

function lengthSupport(dimension, span) {
  return Math.min(1, span / Math.max(dimension * 0.35, 1));
}

function patternPenalty(indices) {
  const indexGaps = indices.slice(1).map((index, gapIndex) => index - indices[gapIndex]);
  const mean = indexGaps.length ? indexGaps.reduce((sum, gap) => sum + gap, 0) / indexGaps.length : 0;
  const variance = indexGaps.length >= 3
    ? indexGaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / indexGaps.length
    : 0;
  const regularity = indexGaps.length >= 3
    ? Math.max(0, 1 - Math.sqrt(variance) / Math.max(mean * 0.45, 0.5))
    : 0;
  return 1 - 0.4 * regularity;
}

function authority({ lowerCount, upperCount, distribution, dimension, span, indices }) {
  const sampleSupport = Math.min(1, upperCount / Math.max(lowerCount, 1));
  return sampleSupport * Math.sqrt(distribution * lengthSupport(dimension, span)) * patternPenalty(indices);
}

const shortOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 80, span: 24, indices: [0, 1, 3, 6] });
const shortDecorativeRegionOnLargeOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 24, indices: [0, 1, 3, 6] });
const broadlyRepresentedLargeOpening = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 128, indices: [0, 1, 3, 6] });
const periodicDecorativePattern = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 128, indices: [0, 2, 4, 6] });
const irregularArchitecturalEvidence = authority({ lowerCount: 6, upperCount: 4, distribution: 0.8, dimension: 320, span: 128, indices: [0, 1, 3, 6] });

if (!(shortOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`The same sparse span must carry less authority on a larger architectural side: short=${shortOpening}, large=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(broadlyRepresentedLargeOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`Broadly represented sparse evidence must outrank a short decorative region: broad=${broadlyRepresentedLargeOpening}, decorative=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(irregularArchitecturalEvidence > periodicDecorativePattern)) {
  throw new Error(`Irregular architectural evidence must outrank a periodic decorative pattern: architectural=${irregularArchitecturalEvidence}, periodic=${periodicDecorativePattern}`);
}
if (!(broadlyRepresentedLargeOpening <= 1 && periodicDecorativePattern >= 0)) {
  throw new Error("Length-aware periodic-pattern authority must remain normalized.");
}

console.log("Cluster authority smoke passed: evidence is weighted by represented architectural length and repeated periodic decorative patterns are suppressed.");
