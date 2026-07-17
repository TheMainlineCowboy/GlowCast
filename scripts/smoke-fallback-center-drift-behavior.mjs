import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const source = await fs.readFile(adapterPath, "utf8");

const thresholdMatch = source.match(/const centerConsistentFallback = normalizedCenterDrift <= ([0-9.]+);/);
if (!thresholdMatch) {
  throw new Error("Fallback center-drift behavior smoke requires the prepared center-consistency gate.");
}

const centerDriftThreshold = Number(thresholdMatch[1]);
if (!Number.isFinite(centerDriftThreshold) || centerDriftThreshold <= 0 || centerDriftThreshold >= 0.5) {
  throw new Error(`Unexpected fallback center-drift threshold: ${thresholdMatch[1]}`);
}

function normalizedCenterDrift(existing, fallback) {
  const existingCenterX = existing.x + existing.width / 2;
  const existingCenterY = existing.y + existing.height / 2;
  const fallbackCenterX = fallback.x + fallback.width / 2;
  const fallbackCenterY = fallback.y + fallback.height / 2;
  return Math.hypot(
    (fallbackCenterX - existingCenterX) / Math.max(existing.width, 0.01),
    (fallbackCenterY - existingCenterY) / Math.max(existing.height, 0.01)
  );
}

function centerConsistent(existing, fallback) {
  return normalizedCenterDrift(existing, fallback) <= centerDriftThreshold;
}

const existing = { x: 100, y: 80, width: 40, height: 60 };
const centeredRepair = { x: 96, y: 74, width: 48, height: 72 };
const sidewaysTrimCapture = { x: 112, y: 74, width: 48, height: 72 };
const verticalSeamCapture = { x: 96, y: 94, width: 48, height: 72 };
const diagonalNeighborCapture = { x: 108, y: 90, width: 48, height: 72 };

const results = {
  centeredRepair: normalizedCenterDrift(existing, centeredRepair),
  sidewaysTrimCapture: normalizedCenterDrift(existing, sidewaysTrimCapture),
  verticalSeamCapture: normalizedCenterDrift(existing, verticalSeamCapture),
  diagonalNeighborCapture: normalizedCenterDrift(existing, diagonalNeighborCapture)
};

if (!centerConsistent(existing, centeredRepair)) {
  throw new Error(`Centered same-opening repair was rejected at drift ${results.centeredRepair.toFixed(3)}.`);
}

for (const [name, fallback] of Object.entries({ sidewaysTrimCapture, verticalSeamCapture, diagonalNeighborCapture })) {
  if (centerConsistent(existing, fallback)) {
    throw new Error(`${name} was incorrectly accepted at drift ${results[name].toFixed(3)}.`);
  }
}

console.log(
  "Fallback center-drift behavior smoke passed: centered repairs remain eligible while sideways, vertical, and diagonal captures are rejected.",
  JSON.stringify({ threshold: centerDriftThreshold, results })
);
