import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const cornerTolerance = Math.max(3, Math.min(18, dimension * 0.08));",
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
  throw new Error(`Gap-tolerant corner-pair ranking is incomplete: ${JSON.stringify(missing)}`);
}

function boundedContinuation(distance, dimension) {
  const tolerance = Math.max(3, Math.min(18, dimension * 0.08));
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
const nearGap = boundedContinuation(4, dimension);
const distantGap = boundedContinuation(24, dimension);
if (!(nearGap > 0 && nearGap < 1)) {
  throw new Error(`A small glare or occlusion gap should retain partial continuation: ${nearGap}`);
}
if (distantGap !== 0) {
  throw new Error(`A distant unrelated edge must receive zero continuation: ${distantGap}`);
}

const nearCorner = cornerPairSupport([
  { start: nearGap, end: 0 },
  { start: 0, end: 0 },
  { start: nearGap, end: 0 },
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
  throw new Error(`Exact, near-gap, and disconnected corners must rank in geometric order: ${exactCorner}, ${nearCorner}, ${disconnectedEdges}`);
}

console.log("Strength-confidence smoke passed: small corner gaps retain bounded architectural support while distant unrelated edges receive none.");
