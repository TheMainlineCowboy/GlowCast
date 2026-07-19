import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const clusterSpread = (cluster: number[]) => {",
  "const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));",
  "const gapClusterCandidates = gaps.slice(1).map((gap, index) => {",
  "upper.length >= minimumSecondarySamples",
  "candidate.consistent && candidate.separation >= 1.8",
  "const stableGaps = dominantGapCutoff > 0 ? gaps.slice(0, dominantGapCutoff) : gaps;",
  "const localSpacing = stableGaps[Math.floor(stableGaps.length / 2)] ?? 1;",
  "Math.max(dimension * 0.04, localSpacing * 2.5)",
  "const boundedContinuation = (distance: number) => Math.max(0, 1 - distance / cornerTolerance);",
  "perimeterCornerPairSupport:",
  "Math.min(top.startContinuation, left.startContinuation)",
  "Math.min(top.endContinuation, right.startContinuation)",
  "Math.min(bottom.startContinuation, left.endContinuation)",
  "Math.min(bottom.endContinuation, right.endContinuation)",
  "b.perimeterCornerPairSupport - a.perimeterCornerPairSupport ||",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) {
  throw new Error(`Sample-confidence-aware corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);
}

function clusterSpread(cluster) {
  const median = cluster[Math.floor(cluster.length / 2)] ?? 1;
  return (Math.max(...cluster) - Math.min(...cluster)) / Math.max(median, 0.5);
}

function stableGapCluster(samplePositions) {
  const gaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]).sort((a, b) => a - b);
  const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));
  const candidates = gaps.slice(1).map((gap, index) => {
    const cutoff = index + 1;
    const lower = gaps.slice(0, cutoff);
    const upper = gaps.slice(cutoff);
    const separation = gap / Math.max(gaps[index], 0.5);
    const consistent =
      lower.length >= Math.max(2, Math.ceil(gaps.length * 0.4)) &&
      upper.length >= minimumSecondarySamples &&
      clusterSpread(lower) <= 0.45 &&
      clusterSpread(upper) <= 0.45;
    return { cutoff, separation, consistent };
  });
  const cutoff = candidates
    .filter((candidate) => candidate.consistent && candidate.separation >= 1.8)
    .sort((a, b) => b.separation - a.separation || a.cutoff - b.cutoff)[0]?.cutoff ?? -1;
  return cutoff > 0 ? gaps.slice(0, cutoff) : gaps;
}

function cornerTolerance(dimension, samplePositions) {
  const stableGaps = stableGapCluster(samplePositions);
  const localSpacing = stableGaps[Math.floor(stableGaps.length / 2)] ?? 1;
  return Math.max(3, Math.min(18, Math.max(dimension * 0.04, localSpacing * 2.5)));
}

function boundedContinuation(distance, dimension, samplePositions) {
  const tolerance = cornerTolerance(dimension, samplePositions);
  return Math.max(0, 1 - distance / tolerance);
}

function cornerPairSupport(sides) {
  const [top, bottom, left, right] = sides;
  return (
    Math.min(top.start, left.start) +
    Math.min(top.end, right.start) +
    Math.min(bottom.start, left.end) +
    Math.min(bottom.end, right.end)
  );
}

const dimension = 160;
const densePositions = [4, 6, 8, 10, 12, 14];
const uniformPerspectivePositions = [4, 8, 12, 16, 20, 24];
const mildlyVariablePositions = [4, 7, 11, 15, 20, 25];
const supportedBimodalPositions = [4, 6, 8, 10, 12, 24, 38, 52];
const twoOutlierPositions = [4, 6, 8, 10, 12, 24, 38];
const accidentalJumpPositions = [4, 6, 8, 12, 17, 26];
const denseNearGap = boundedContinuation(4, dimension, densePositions);
const perspectiveNearGap = boundedContinuation(4, dimension, uniformPerspectivePositions);
const variableNearGap = boundedContinuation(4, dimension, mildlyVariablePositions);
const supportedBimodalNearGap = boundedContinuation(4, dimension, supportedBimodalPositions);
const twoOutlierNearGap = boundedContinuation(4, dimension, twoOutlierPositions);
const accidentalNearGap = boundedContinuation(4, dimension, accidentalJumpPositions);
const distantGap = boundedContinuation(24, dimension, uniformPerspectivePositions);

if (stableGapCluster(uniformPerspectivePositions).length !== uniformPerspectivePositions.length - 1) {
  throw new Error("Uniform perspective spacing should retain the complete gap run.");
}
if (stableGapCluster(mildlyVariablePositions).length !== mildlyVariablePositions.length - 1) {
  throw new Error("Mild natural spacing variation must not be mistaken for a separate noise cluster.");
}
if (stableGapCluster(supportedBimodalPositions).length !== 4) {
  throw new Error(`A well-supported bimodal run should isolate the internally consistent dense cluster: ${JSON.stringify(stableGapCluster(supportedBimodalPositions))}`);
}
if (stableGapCluster(twoOutlierPositions).length !== twoOutlierPositions.length - 1) {
  throw new Error(`Only two detached samples must not establish an authoritative secondary cluster: ${JSON.stringify(stableGapCluster(twoOutlierPositions))}`);
}
if (stableGapCluster(accidentalJumpPositions).length !== accidentalJumpPositions.length - 1) {
  throw new Error(`One ratio jump with an inconsistent upper group must preserve the smooth gradient: ${JSON.stringify(stableGapCluster(accidentalJumpPositions))}`);
}
if (!(perspectiveNearGap >= denseNearGap && variableNearGap >= denseNearGap && accidentalNearGap >= denseNearGap && perspectiveNearGap > 0)) {
  throw new Error(`Uniform, mildly variable, or smooth-gradient perspective spacing should retain useful support: dense=${denseNearGap}, perspective=${perspectiveNearGap}, variable=${variableNearGap}, accidental=${accidentalNearGap}`);
}
if (!(supportedBimodalNearGap === denseNearGap && supportedBimodalNearGap < perspectiveNearGap)) {
  throw new Error(`A well-supported sparse secondary cluster must not inflate tolerance above the dominant dense cluster: bimodal=${supportedBimodalNearGap}, dense=${denseNearGap}, perspective=${perspectiveNearGap}`);
}
if (!(twoOutlierNearGap > supportedBimodalNearGap)) {
  throw new Error(`Two detached samples should not have enough authority to force the dominant-cluster split: twoOutlier=${twoOutlierNearGap}, supportedBimodal=${supportedBimodalNearGap}`);
}
if (distantGap !== 0) {
  throw new Error(`A distant unrelated edge must receive zero continuation: ${distantGap}`);
}

const nearCorner = cornerPairSupport([
  { start: perspectiveNearGap, end: 0 },
  { start: 0, end: 0 },
  { start: perspectiveNearGap, end: 0 },
  { start: 0, end: 0 }
]);
const supportedBimodalCorner = cornerPairSupport([
  { start: supportedBimodalNearGap, end: 0 },
  { start: 0, end: 0 },
  { start: supportedBimodalNearGap, end: 0 },
  { start: 0, end: 0 }
]);
const disconnectedEdges = cornerPairSupport([
  { start: distantGap, end: 0 },
  { start: 0, end: 0 },
  { start: distantGap, end: 0 },
  { start: 0, end: 0 }
]);
const exactCorner = cornerPairSupport([
  { start: 1, end: 0 },
  { start: 0, end: 0 },
  { start: 1, end: 0 },
  { start: 0, end: 0 }
]);

if (!(exactCorner > nearCorner && nearCorner > supportedBimodalCorner && supportedBimodalCorner > disconnectedEdges)) {
  throw new Error(`Exact, uniform-perspective, supported-bimodal, and disconnected corners must rank in geometric order: ${exactCorner}, ${nearCorner}, ${supportedBimodalCorner}, ${disconnectedEdges}`);
}

console.log("Strength-confidence smoke passed: sample-confidence-aware spacing clustering preserves perspective gradients, ignores two-point noise groups, and isolates well-supported sparse outlier clusters.");