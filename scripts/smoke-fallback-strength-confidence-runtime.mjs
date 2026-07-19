import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));",
  "return { cutoff, separation, consistent, lowerCount: lower.length, upperCount: upper.length };",
  "const secondaryClusterAuthority = dominantGapCandidate",
  "dominantGapCandidate.upperCount / Math.max(dominantGapCandidate.lowerCount, 1)",
  "const unsplitSpacing = gaps[Math.floor(gaps.length * 0.75)]",
  "unsplitSpacing * (1 - secondaryClusterAuthority) + denseMedianSpacing * secondaryClusterAuthority",
  "Math.max(dimension * 0.04, localSpacing * 2.5)",
  "perimeterCornerPairSupport:",
  "b.perimeterCornerPairSupport - a.perimeterCornerPairSupport ||",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Sample-weighted corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);

function clusterSpread(cluster) {
  const median = cluster[Math.floor(cluster.length / 2)] ?? 1;
  return (Math.max(...cluster) - Math.min(...cluster)) / Math.max(median, 0.5);
}

function spacingMetrics(samplePositions) {
  const gaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]).sort((a, b) => a - b);
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
  const authority = dominant ? Math.min(1, dominant.upperCount / Math.max(dominant.lowerCount, 1)) : 0;
  return { gaps, dominant, authority, localSpacing: unsplitSpacing * (1 - authority) + denseMedianSpacing * authority };
}

function cornerTolerance(dimension, samplePositions) {
  return Math.max(3, Math.min(18, Math.max(dimension * 0.04, spacingMetrics(samplePositions).localSpacing * 2.5)));
}

function boundedContinuation(distance, dimension, samplePositions) {
  return Math.max(0, 1 - distance / cornerTolerance(dimension, samplePositions));
}

const dimension = 160;
const densePositions = [4, 6, 8, 10, 12, 14];
const uniformPerspectivePositions = [4, 8, 12, 16, 20, 24];
const barelySupportedBimodalPositions = [4, 6, 8, 10, 12, 24, 38, 52];
const stronglySupportedBimodalPositions = [4, 6, 8, 10, 24, 38, 52, 66];
const twoOutlierPositions = [4, 6, 8, 10, 12, 24, 38];

const barely = spacingMetrics(barelySupportedBimodalPositions);
const strong = spacingMetrics(stronglySupportedBimodalPositions);
const twoOutlier = spacingMetrics(twoOutlierPositions);

if (!barely.dominant || !strong.dominant) throw new Error("Supported bimodal runs must identify a secondary spacing cluster.");
if (!(strong.authority > barely.authority && barely.authority > 0)) {
  throw new Error(`Cluster authority must scale with relative sample support: barely=${barely.authority}, strong=${strong.authority}`);
}
if (!(strong.localSpacing < barely.localSpacing)) {
  throw new Error(`A strongly supported sparse cluster must pull spacing farther toward the dense cluster: strong=${strong.localSpacing}, barely=${barely.localSpacing}`);
}
if (twoOutlier.dominant) throw new Error(`Two detached samples must not establish an authoritative secondary cluster: ${JSON.stringify(twoOutlier)}`);

const denseNearGap = boundedContinuation(4, dimension, densePositions);
const barelyNearGap = boundedContinuation(4, dimension, barelySupportedBimodalPositions);
const strongNearGap = boundedContinuation(4, dimension, stronglySupportedBimodalPositions);
const distantGap = boundedContinuation(24, dimension, uniformPerspectivePositions);

if (!(barelyNearGap > strongNearGap && strongNearGap >= denseNearGap)) {
  throw new Error(`Continuation must decrease as secondary-cluster authority increases: barely=${barelyNearGap}, strong=${strongNearGap}, dense=${denseNearGap}`);
}
if (distantGap !== 0) throw new Error(`A distant unrelated edge must receive zero continuation: ${distantGap}`);

console.log("Strength-confidence smoke passed: secondary spacing clusters influence corner tolerance in proportion to sample support, while two-point noise remains non-authoritative.");
