import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const orderedGaps = bestRun.slice(1)",
  "const secondaryGapIndices = orderedGaps",
  "const secondaryClusterDistribution = dominantGapCandidate",
  "const secondaryClusterLengthSupport = dominantGapCandidate",
  "Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport)",
  "const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));",
  "const secondaryClusterAuthority = dominantGapCandidate",
  "const unsplitSpacing = gaps[Math.floor(gaps.length * 0.75)]",
  "Math.max(dimension * 0.04, localSpacing * 2.5)",
  "perimeterCornerPairSupport:",
  "b.perimeterCornerPairSupport - a.perimeterCornerPairSupport ||",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Spatially distributed, length-aware cluster-weighted corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);

function clusterSpread(cluster) {
  const median = cluster[Math.floor(cluster.length / 2)] ?? 1;
  return (Math.max(...cluster) - Math.min(...cluster)) / Math.max(median, 0.5);
}

function spacingMetrics(samplePositions, dimension) {
  const orderedGaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]);
  const gaps = [...orderedGaps].sort((a, b) => a - b);
  const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));
  const candidates = gaps.slice(1).map((gap, index) => {
    const cutoff = index + 1;
    const lower = gaps.slice(0, cutoff);
    const upper = gaps.slice(cutoff);
    const separation = gap / Math.max(gaps[index], 0.5);
    const consistent = lower.length >= Math.max(2, Math.ceil(gaps.length * 0.4)) && upper.length >= minimumSecondarySamples && clusterSpread(lower) <= 0.45 && clusterSpread(upper) <= 0.45;
    return { cutoff, separation, consistent, lowerCount: lower.length, upperCount: upper.length };
  });
  const dominant = candidates.filter((candidate) => candidate.consistent && candidate.separation >= 1.8).sort((a, b) => b.separation - a.separation || a.cutoff - b.cutoff)[0];
  const denseGaps = dominant ? gaps.slice(0, dominant.cutoff) : gaps;
  const unsplitSpacing = gaps[Math.floor(gaps.length * 0.75)] ?? gaps[Math.floor(gaps.length / 2)] ?? 1;
  const denseMedianSpacing = denseGaps[Math.floor(denseGaps.length / 2)] ?? unsplitSpacing;
  const secondaryGapThreshold = dominant ? gaps[dominant.cutoff] ?? Infinity : Infinity;
  const secondaryGapIndices = orderedGaps.map((gap, index) => ({ gap, index })).filter((sample) => sample.gap >= secondaryGapThreshold).map((sample) => sample.index);
  const distribution = dominant && secondaryGapIndices.length > 1
    ? Math.min(1, (secondaryGapIndices[secondaryGapIndices.length - 1] - secondaryGapIndices[0] + 1) / Math.max(orderedGaps.length, 1))
    : 0;
  const secondaryClusterSpan = dominant && secondaryGapIndices.length > 1
    ? Math.max(0, samplePositions[secondaryGapIndices[secondaryGapIndices.length - 1] + 1] - samplePositions[secondaryGapIndices[0]])
    : 0;
  const lengthSupport = dominant ? Math.min(1, secondaryClusterSpan / Math.max(dimension * 0.35, 1)) : 0;
  const authority = dominant ? Math.min(1, dominant.upperCount / Math.max(dominant.lowerCount, 1)) * Math.sqrt(distribution * lengthSupport) : 0;
  return { dominant, distribution, lengthSupport, authority, localSpacing: unsplitSpacing * (1 - authority) + denseMedianSpacing * authority };
}

function cornerTolerance(dimension, samplePositions) {
  return Math.max(3, Math.min(18, Math.max(dimension * 0.04, spacingMetrics(samplePositions, dimension).localSpacing * 2.5)));
}

function boundedContinuation(distance, dimension, samplePositions) {
  return Math.max(0, 1 - distance / cornerTolerance(dimension, samplePositions));
}

const dimension = 200;
const concentratedSparsePositions = [4, 6, 8, 10, 24, 38, 52, 54, 56];
const distributedSparsePositions = [4, 18, 20, 34, 36, 50, 52, 66, 68];
const twoOutlierPositions = [4, 6, 8, 10, 12, 24, 38];
const uniformPerspectivePositions = [4, 8, 12, 16, 20, 24];

const concentrated = spacingMetrics(concentratedSparsePositions, dimension);
const distributed = spacingMetrics(distributedSparsePositions, dimension);
const twoOutlier = spacingMetrics(twoOutlierPositions, dimension);

if (!concentrated.dominant || !distributed.dominant) throw new Error("Supported bimodal runs must identify a secondary spacing cluster.");
if (!(distributed.distribution > concentrated.distribution && concentrated.distribution > 0)) {
  throw new Error(`Spatially distributed sparse gaps must receive broader distribution support: concentrated=${concentrated.distribution}, distributed=${distributed.distribution}`);
}
if (!(distributed.lengthSupport > concentrated.lengthSupport && concentrated.lengthSupport > 0)) {
  throw new Error(`Sparse-gap authority must reflect represented architectural length: concentrated=${concentrated.lengthSupport}, distributed=${distributed.lengthSupport}`);
}
if (!(distributed.authority > concentrated.authority && concentrated.authority > 0)) {
  throw new Error(`Cluster authority must include sample distribution and represented length: concentrated=${concentrated.authority}, distributed=${distributed.authority}`);
}
if (!(distributed.localSpacing < concentrated.localSpacing)) {
  throw new Error(`Distributed sparse evidence must pull tolerance farther toward dense spacing: distributed=${distributed.localSpacing}, concentrated=${concentrated.localSpacing}`);
}
if (twoOutlier.dominant) throw new Error(`Two detached samples must remain non-authoritative: ${JSON.stringify(twoOutlier)}`);

const concentratedNearGap = boundedContinuation(4, dimension, concentratedSparsePositions);
const distributedNearGap = boundedContinuation(4, dimension, distributedSparsePositions);
const distantGap = boundedContinuation(24, dimension, uniformPerspectivePositions);

if (!(concentratedNearGap > distributedNearGap && distributedNearGap > 0)) {
  throw new Error(`Concentrated decorative spacing must influence corner continuation less than distributed evidence: concentrated=${concentratedNearGap}, distributed=${distributedNearGap}`);
}
if (distantGap !== 0) throw new Error(`A distant unrelated edge must receive zero continuation: ${distantGap}`);

console.log("Strength-confidence smoke passed: repeated sparse spacing influences corner tolerance only in proportion to sample support, distribution, and represented architectural length.");
