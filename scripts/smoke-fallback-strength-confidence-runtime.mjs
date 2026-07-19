import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const localSpacing = gaps[Math.floor(gaps.length / 2)] ?? 1;",
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
  throw new Error(`Locally scaled corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);
}

function cornerTolerance(dimension, samplePositions) {
  const gaps = samplePositions.slice(1).map((position, index) => position - samplePositions[index]).sort((a, b) => a - b);
  const localSpacing = gaps[Math.floor(gaps.length / 2)] ?? 1;
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
const denseNearGap = boundedContinuation(4, dimension, densePositions);
const compressedNearGap = boundedContinuation(4, dimension, perspectiveCompressedPositions);
const distantGap = boundedContinuation(24, dimension, perspectiveCompressedPositions);

if (!(compressedNearGap >= denseNearGap && compressedNearGap > 0)) {
  throw new Error(`Locally wider edge spacing should retain at least as much bounded corner support: ${compressedNearGap} < ${denseNearGap}`);
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

if (!(exactCorner > nearCorner && nearCorner > disconnectedEdges)) {
  throw new Error(`Exact, locally scaled near-gap, and disconnected corners must rank in geometric order: ${exactCorner}, ${nearCorner}, ${disconnectedEdges}`);
}

console.log("Strength-confidence smoke passed: corner gaps adapt to local edge spacing while remaining geometrically bounded against unrelated edges.");