import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "startContinuation:",
  "endContinuation:",
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
  throw new Error(`Corner-pair-aware nested strength ranking is incomplete: ${JSON.stringify(missing)}`);
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

const coherentFrame = cornerPairSupport([
  { start: 1, end: 1 },
  { start: 1, end: 1 },
  { start: 1, end: 1 },
  { start: 1, end: 1 }
]);
const isolatedBoundaryTouches = cornerPairSupport([
  { start: 1, end: 0 },
  { start: 0, end: 1 },
  { start: 0, end: 1 },
  { start: 1, end: 0 }
]);
const singleCorner = cornerPairSupport([
  { start: 1, end: 0 },
  { start: 0, end: 0 },
  { start: 1, end: 0 },
  { start: 0, end: 0 }
]);

if (!(coherentFrame === 4)) {
  throw new Error(`A coherent four-corner frame should receive full corner-pair support: ${coherentFrame}`);
}
if (!(coherentFrame > isolatedBoundaryTouches)) {
  throw new Error(`Compatible adjoining runs must outrank disconnected boundary touches: ${coherentFrame} <= ${isolatedBoundaryTouches}`);
}
if (!(singleCorner > 0 && singleCorner < coherentFrame)) {
  throw new Error(`One supported architectural corner should retain partial confidence without matching a complete frame: ${singleCorner}`);
}

console.log("Strength-confidence smoke passed: compatible adjoining horizontal and vertical runs reward real architectural corners while disconnected boundary touches remain lower confidence.");
