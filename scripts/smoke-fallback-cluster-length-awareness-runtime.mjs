import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryClusterSpan = dominantGapCandidate",
  "const secondaryClusterLengthSupport = dominantGapCandidate",
  "secondaryClusterSpan / Math.max(dimension * 0.35, 1)",
  "const secondaryIndexGaps = secondaryGapIndices",
  "const secondaryPatternRegularity = secondaryIndexGaps.length >= 3",
  "const secondaryGapValues = secondaryGapIndices.map((index) => orderedGaps[index])",
  "const secondaryGapDirectionalConsistency = secondaryGapDeltas.length",
  "const secondaryPerspectiveGradientSupport = secondaryGapValues.length >= 4",
  "const adjustedSecondaryPatternRegularity = secondaryPatternRegularity *",
  "1 - 0.65 * secondaryPerspectiveGradientSupport",
  "1 - 0.4 * adjustedSecondaryPatternRegularity",
  "Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Perspective-aware periodic-pattern resistance is incomplete: ${JSON.stringify(missing)}`);

function lengthSupport(dimension, span) {
  return Math.min(1, span / Math.max(dimension * 0.35, 1));
}

function patternPenalty(indices, gapValues) {
  const indexGaps = indices.slice(1).map((index, gapIndex) => index - indices[gapIndex]);
  const mean = indexGaps.length ? indexGaps.reduce((sum, gap) => sum + gap, 0) / indexGaps.length : 0;
  const variance = indexGaps.length >= 3
    ? indexGaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / indexGaps.length
    : 0;
  const regularity = indexGaps.length >= 3
    ? Math.max(0, 1 - Math.sqrt(variance) / Math.max(mean * 0.45, 0.5))
    : 0;
  const gapDeltas = gapValues.slice(1).map((gap, gapIndex) => gap - gapValues[gapIndex]);
  const direction = gapDeltas.reduce((sum, delta) => sum + (Math.abs(delta) < 0.25 ? 0 : Math.sign(delta)), 0);
  const directionalConsistency = gapDeltas.length ? Math.abs(direction) / gapDeltas.length : 0;
  const rangeRatio = gapValues.length
    ? (Math.max(...gapValues) - Math.min(...gapValues)) /
      Math.max(gapValues.reduce((sum, gap) => sum + gap, 0) / gapValues.length, 1)
    : 0;
  const perspectiveGradientSupport = gapValues.length >= 4
    ? Math.min(1, directionalConsistency * rangeRatio * 2.5)
    : 0;
  const adjustedRegularity = regularity * (1 - 0.65 * perspectiveGradientSupport);
  return 1 - 0.4 * adjustedRegularity;
}

function authority({ lowerCount, upperCount, distribution, dimension, span, indices, gapValues }) {
  const sampleSupport = Math.min(1, upperCount / Math.max(lowerCount, 1));
  return sampleSupport * Math.sqrt(distribution * lengthSupport(dimension, span)) * patternPenalty(indices, gapValues);
}

const shared = { lowerCount: 6, upperCount: 4, distribution: 0.8 };
const shortOpening = authority({ ...shared, dimension: 80, span: 24, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const shortDecorativeRegionOnLargeOpening = authority({ ...shared, dimension: 320, span: 24, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const broadlyRepresentedLargeOpening = authority({ ...shared, dimension: 320, span: 128, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const periodicDecorativePattern = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [12, 12, 12, 12] });
const perspectiveCompressedArchitecture = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [16, 13, 10, 7] });
const irregularArchitecturalEvidence = authority({ ...shared, dimension: 320, span: 128, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });

if (!(shortOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`The same sparse span must carry less authority on a larger architectural side: short=${shortOpening}, large=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(broadlyRepresentedLargeOpening > shortDecorativeRegionOnLargeOpening)) {
  throw new Error(`Broadly represented sparse evidence must outrank a short decorative region: broad=${broadlyRepresentedLargeOpening}, decorative=${shortDecorativeRegionOnLargeOpening}`);
}
if (!(irregularArchitecturalEvidence > periodicDecorativePattern)) {
  throw new Error(`Irregular architectural evidence must outrank a periodic decorative pattern: architectural=${irregularArchitecturalEvidence}, periodic=${periodicDecorativePattern}`);
}
if (!(perspectiveCompressedArchitecture > periodicDecorativePattern)) {
  throw new Error(`Perspective-compressed architectural repetition must retain more authority than globally uniform decorative cadence: perspective=${perspectiveCompressedArchitecture}, periodic=${periodicDecorativePattern}`);
}
if (!(perspectiveCompressedArchitecture <= irregularArchitecturalEvidence)) {
  throw new Error(`Perspective relief must remain bounded below irregular architectural evidence: perspective=${perspectiveCompressedArchitecture}, irregular=${irregularArchitecturalEvidence}`);
}
if (!(broadlyRepresentedLargeOpening <= 1 && periodicDecorativePattern >= 0)) {
  throw new Error("Perspective-aware pattern authority must remain normalized.");
}

console.log("Cluster authority smoke passed: periodic decorative texture is suppressed while monotonic perspective-compressed architectural spacing retains confidence.");
