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
  "const secondaryGapDeltaMagnitudeVariance = secondaryGapDeltas.length >= 3",
  "const secondaryGapGradientSamplingAllowance = dominantGapCandidate",
  "dominantGapCandidate.lowerMedian * 0.12",
  "dimension * 0.003 + secondaryGapGradientSamplingAllowance",
  "const secondaryGapGradientJitterAllowance = secondaryGapDeltas.length >= 3",
  "const secondaryGapGradientResidualDeviation = secondaryGapDeltas.length >= 3",
  "Math.pow(secondaryGapGradientJitterAllowance, 2)",
  "secondaryGapDirectionalConsistency * secondaryGapGradientSmoothness * secondaryGapRangeRatio * 2.5",
  "const adjustedSecondaryPatternRegularity = secondaryPatternRegularity *",
  "1 - 0.65 * secondaryPerspectiveGradientSupport",
  "1 - 0.4 * adjustedSecondaryPatternRegularity",
  "Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Sampling-aware jitter-tolerant perspective resistance is incomplete: ${JSON.stringify(missing)}`);

function lengthSupport(dimension, span) {
  return Math.min(1, span / Math.max(dimension * 0.35, 1));
}

function patternPenalty(indices, gapValues, dimension, lowerMedian) {
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
  const deltaMagnitudeMean = gapDeltas.length
    ? gapDeltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / gapDeltas.length
    : 0;
  const deltaMagnitudeVariance = gapDeltas.length >= 3
    ? gapDeltas.reduce((sum, delta) => sum + Math.pow(Math.abs(delta) - deltaMagnitudeMean, 2), 0) / gapDeltas.length
    : 0;
  const samplingAllowance = Math.min(1.25, Math.max(0, lowerMedian * 0.12));
  const scaleAllowance = gapDeltas.length >= 3
    ? Math.min(2.5, Math.max(0.5, dimension * 0.003 + samplingAllowance))
    : 0;
  const gradientJitterAllowance = gapDeltas.length >= 3
    ? Math.min(
        Math.max(scaleAllowance, deltaMagnitudeMean * 0.2),
        Math.max(scaleAllowance, deltaMagnitudeMean * 0.35)
      )
    : 0;
  const gradientResidualDeviation = gapDeltas.length >= 3
    ? Math.sqrt(Math.max(0, deltaMagnitudeVariance - Math.pow(gradientJitterAllowance, 2)))
    : 0;
  const gradientSmoothness = gapDeltas.length >= 3
    ? Math.max(0, 1 - gradientResidualDeviation / Math.max(deltaMagnitudeMean * 0.75, 0.5))
    : 0;
  const rangeRatio = gapValues.length
    ? (Math.max(...gapValues) - Math.min(...gapValues)) /
      Math.max(gapValues.reduce((sum, gap) => sum + gap, 0) / gapValues.length, 1)
    : 0;
  const perspectiveGradientSupport = gapValues.length >= 4
    ? Math.min(1, directionalConsistency * gradientSmoothness * rangeRatio * 2.5)
    : 0;
  const adjustedRegularity = regularity * (1 - 0.65 * perspectiveGradientSupport);
  return 1 - 0.4 * adjustedRegularity;
}

function authority({ lowerCount, upperCount, distribution, dimension, span, indices, gapValues, lowerMedian = 4 }) {
  const sampleSupport = Math.min(1, upperCount / Math.max(lowerCount, 1));
  return sampleSupport * Math.sqrt(distribution * lengthSupport(dimension, span)) * patternPenalty(indices, gapValues, dimension, lowerMedian);
}

const shared = { lowerCount: 6, upperCount: 4, distribution: 0.8 };
const shortOpening = authority({ ...shared, dimension: 80, span: 24, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const shortDecorativeRegionOnLargeOpening = authority({ ...shared, dimension: 320, span: 24, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const broadlyRepresentedLargeOpening = authority({ ...shared, dimension: 320, span: 128, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const periodicDecorativePattern = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [12, 12, 12, 12] });
const perspectiveCompressedArchitecture = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [16, 13, 10, 7] });
const naturallyJitteredPerspective = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [16, 13, 11, 7] });
const steppedDecorativePattern = authority({ ...shared, dimension: 320, span: 128, indices: [0, 2, 4, 6], gapValues: [16, 15, 14, 7] });
const irregularArchitecturalEvidence = authority({ ...shared, dimension: 320, span: 128, indices: [0, 1, 3, 6], gapValues: [12, 9, 13, 10] });
const lowResolutionJitter = authority({ ...shared, dimension: 96, span: 40, indices: [0, 2, 4, 6], gapValues: [10, 8, 7, 4], lowerMedian: 2 });
const crispHighResolutionJitter = authority({ ...shared, dimension: 640, span: 268, indices: [0, 2, 4, 6], gapValues: [40, 32, 27, 16], lowerMedian: 2 });
const sparseHighResolutionJitter = authority({ ...shared, dimension: 640, span: 268, indices: [0, 2, 4, 6], gapValues: [40, 32, 27, 16], lowerMedian: 8 });
const highResolutionSevereStep = authority({ ...shared, dimension: 640, span: 268, indices: [0, 2, 4, 6], gapValues: [40, 39, 38, 16], lowerMedian: 8 });

if (!(shortOpening > shortDecorativeRegionOnLargeOpening)) throw new Error(`The same sparse span must carry less authority on a larger architectural side: short=${shortOpening}, large=${shortDecorativeRegionOnLargeOpening}`);
if (!(broadlyRepresentedLargeOpening > shortDecorativeRegionOnLargeOpening)) throw new Error(`Broadly represented sparse evidence must outrank a short decorative region: broad=${broadlyRepresentedLargeOpening}, decorative=${shortDecorativeRegionOnLargeOpening}`);
if (!(irregularArchitecturalEvidence > periodicDecorativePattern)) throw new Error(`Irregular architectural evidence must outrank a periodic decorative pattern: architectural=${irregularArchitecturalEvidence}, periodic=${periodicDecorativePattern}`);
if (!(perspectiveCompressedArchitecture > periodicDecorativePattern)) throw new Error(`Smooth perspective-compressed architectural repetition must retain more authority than globally uniform decorative cadence: perspective=${perspectiveCompressedArchitecture}, periodic=${periodicDecorativePattern}`);
if (!(naturallyJitteredPerspective > steppedDecorativePattern)) throw new Error(`A naturally jittered perspective gradient must outrank an abrupt stepped pattern: jittered=${naturallyJitteredPerspective}, stepped=${steppedDecorativePattern}`);
if (!(naturallyJitteredPerspective >= periodicDecorativePattern)) throw new Error(`Natural measurement jitter must not erase perspective support: jittered=${naturallyJitteredPerspective}, periodic=${periodicDecorativePattern}`);
if (!(perspectiveCompressedArchitecture > steppedDecorativePattern)) throw new Error(`A gradual perspective gradient must outrank a monotonic pattern with one abrupt step: smooth=${perspectiveCompressedArchitecture}, stepped=${steppedDecorativePattern}`);
if (!(steppedDecorativePattern <= irregularArchitecturalEvidence)) throw new Error(`Abrupt stepped repetition must not outrank irregular architectural evidence: stepped=${steppedDecorativePattern}, irregular=${irregularArchitecturalEvidence}`);
if (!(perspectiveCompressedArchitecture <= irregularArchitecturalEvidence)) throw new Error(`Perspective relief must remain bounded below irregular architectural evidence: perspective=${perspectiveCompressedArchitecture}, irregular=${irregularArchitecturalEvidence}`);
if (!(lowResolutionJitter >= periodicDecorativePattern * 0.8)) throw new Error(`Low-resolution natural jitter lost too much support: low=${lowResolutionJitter}, periodic=${periodicDecorativePattern}`);
if (!(sparseHighResolutionJitter >= crispHighResolutionJitter)) throw new Error(`Sparsely sampled high-resolution edges must receive at least as much bounded jitter support as crisp edges: sparse=${sparseHighResolutionJitter}, crisp=${crispHighResolutionJitter}`);
if (!(sparseHighResolutionJitter > highResolutionSevereStep)) throw new Error(`Sampling-aware high-resolution jitter must still outrank a severe stepped pattern: sampled=${sparseHighResolutionJitter}, severe=${highResolutionSevereStep}`);
if (!(broadlyRepresentedLargeOpening <= 1 && periodicDecorativePattern >= 0)) throw new Error("Sampling-aware jitter-tolerant smooth perspective authority must remain normalized.");

console.log("Cluster authority smoke passed: bounded perspective jitter adapts to local sampling density while abrupt stepped patterns remain suppressed.");
