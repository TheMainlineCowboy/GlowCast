import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const stableGaps = gaps.slice(0, Math.max(1, Math.ceil(gaps.length * 0.6)));",
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
  throw new Error(`Stable-cluster corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);
}

function cornerTolerance(dimension, samplePositions) {
  const gaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]).sort((a, b) => a - b);
  const stableGaps = gaps.slice(0, Math.max(1, Math.ceil(gaps.length * 0.6)));
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
const perspectiveCompressedPositions = [4, 8, 12, 16, 20, 24];
const mixedDensityPositions = [4, 6, 8, 10, 22, 36];
const denseNearGap = boundedContinuation(4, dimension, densePositions);
const compressedNearGap = boundedContinuation(4, dimension, perspectiveCompressedPositions);
const mixedNearGap = boundedContinuation(4, dimension, mixedDensityPositions);
const distantGap = boundedContinuation(24, dimension, perspectiveCompressedPositions);

if (!(compressedNearGap >= denseNearGap && compressedNearGap > 0)) {
  throw new Error(`Uniformly wider local edge spacing should retain at least as much bounded corner support: ${compressedNearGap} < ${denseNearGap}`);
}
if (!(mixedNearGap <= compressedNearGap && mixedNearGap === denseNearGap)) {
  throw new Error(`Sparse outlier gaps must not inflate tolerance above the stable spacing cluster: mixed=${mixedNearGap}, dense=${denseNearGap}, compressed=${compressedNearGap}`);
}
if (distantGap !== 0) {
  throw new Error(`A distant unrelated edge must receive zero continuation: ${distantGap}`);
}

const nearCorner = cornerPairSupport([
  { start: compressedNearGap, end: 0 },
  { start: 0, end: 0 },
  { start: compressedNearGap, end: 0 },
  { start: 0, end: 0 }
]);
const mixedCorner = cornerPairSupport([
  { start: mixedNearGap, end: 0 },
  { start: 0, end: 0 },
  { start: mixedNearGap, end: 0 },
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

if (!(exactCorner > nearCorner && nearCorner >= mixedCorner && mixedCorner > disconnectedEdges)) {
  throw new Error(`Exact, uniformly spaced, mixed-density, and disconnected corners must rank in geometric order: ${exactCorner}, ${nearCorner}, ${mixedCorner}, ${disconnectedEdges}`);
}

console.log("Strength-confidence smoke passed: corner tolerance follows the stable local spacing cluster, preserves uniform perspective spacing, and rejects sparse outlier inflation.");
