import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const dominantGapCutoff = gaps.findIndex((gap, index) => index > 0 && gap / Math.max(gaps[index - 1], 0.5) >= 1.8);",
  "const stableGaps = dominantGapCutoff >= Math.max(2, Math.ceil(gaps.length * 0.4)) ? gaps.slice(0, dominantGapCutoff) : gaps;",
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
  throw new Error(`Adaptive-cluster corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);
}

function stableGapCluster(samplePositions) {
  const gaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]).sort((a, b) => a - b);
  const dominantGapCutoff = gaps.findIndex((gap, index) => index > 0 && gap / Math.max(gaps[index - 1], 0.5) >= 1.8);
  return dominantGapCutoff >= Math.max(2, Math.ceil(gaps.length * 0.4)) ? gaps.slice(0, dominantGapCutoff) : gaps;
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
const bimodalPositions = [4, 6, 8, 10, 22, 36];
const denseNearGap = boundedContinuation(4, dimension, densePositions);
const perspectiveNearGap = boundedContinuation(4, dimension, uniformPerspectivePositions);
const variableNearGap = boundedContinuation(4, dimension, mildlyVariablePositions);
const bimodalNearGap = boundedContinuation(4, dimension, bimodalPositions);
const distantGap = boundedContinuation(24, dimension, uniformPerspectivePositions);

if (stableGapCluster(uniformPerspectivePositions).length !== uniformPerspectivePositions.length - 1) {
  throw new Error("Uniform perspective spacing should retain the complete gap run.");
}
if (stableGapCluster(mildlyVariablePositions).length !== mildlyVariablePositions.length - 1) {
  throw new Error("Mild natural spacing variation must not be mistaken for a separate noise cluster.");
}
if (stableGapCluster(bimodalPositions).length !== 3) {
  throw new Error(`Bimodal spacing should isolate the dominant dense cluster: ${JSON.stringify(stableGapCluster(bimodalPositions))}`);
}
if (!(perspectiveNearGap >= denseNearGap && variableNearGap >= denseNearGap && perspectiveNearGap > 0)) {
  throw new Error(`Uniform or mildly variable perspective spacing should retain useful support: dense=${denseNearGap}, perspective=${perspectiveNearGap}, variable=${variableNearGap}`);
}
if (!(bimodalNearGap === denseNearGap && bimodalNearGap < perspectiveNearGap)) {
  throw new Error(`Sparse secondary gaps must not inflate tolerance above the dominant dense cluster: bimodal=${bimodalNearGap}, dense=${denseNearGap}, perspective=${perspectiveNearGap}`);
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
const bimodalCorner = cornerPairSupport([
  { start: bimodalNearGap, end: 0 },
  { start: 0, end: 0 },
  { start: bimodalNearGap, end: 0 },
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

if (!(exactCorner > nearCorner && nearCorner > bimodalCorner && bimodalCorner > disconnectedEdges)) {
  throw new Error(`Exact, uniform-perspective, bimodal, and disconnected corners must rank in geometric order: ${exactCorner}, ${nearCorner}, ${bimodalCorner}, ${disconnectedEdges}`);
}

console.log("Strength-confidence smoke passed: adaptive spacing clustering preserves uniform perspective evidence, tolerates mild variation, and isolates sparse secondary gaps.");
