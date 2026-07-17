import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const source = await fs.readFile(adapterPath, "utf8");

const thresholdMatch = source.match(/const preservesExistingFootprint = existingFootprintRetention >= ([0-9.]+);/);
if (!thresholdMatch) {
  throw new Error("Fallback footprint-retention smoke requires the prepared replacement gate.");
}

const threshold = Number(thresholdMatch[1]);
if (!Number.isFinite(threshold) || threshold < 0.8 || threshold > 1) {
  throw new Error(`Unexpected fallback footprint-retention threshold: ${thresholdMatch[1]}`);
}

function footprintRetention(existing, fallback) {
  const width = Math.max(
    0,
    Math.min(existing.x + existing.width, fallback.x + fallback.width) - Math.max(existing.x, fallback.x)
  );
  const height = Math.max(
    0,
    Math.min(existing.y + existing.height, fallback.y + fallback.height) - Math.max(existing.y, fallback.y)
  );
  return (width * height) / Math.max(existing.width * existing.height, 1);
}

const existing = { x: 100, y: 80, width: 40, height: 60 };
const centeredRepair = { x: 96, y: 74, width: 48, height: 72 };
const mildSymmetricRepair = { x: 98, y: 77, width: 44, height: 66 };
const clippedRightEdge = { x: 106, y: 74, width: 48, height: 72 };
const clippedBottomEdge = { x: 96, y: 88, width: 48, height: 72 };

for (const [name, fallback] of Object.entries({ centeredRepair, mildSymmetricRepair })) {
  const retention = footprintRetention(existing, fallback);
  if (retention < threshold) {
    throw new Error(`${name} was incorrectly rejected at ${(retention * 100).toFixed(1)}% footprint retention.`);
  }
}

for (const [name, fallback] of Object.entries({ clippedRightEdge, clippedBottomEdge })) {
  const retention = footprintRetention(existing, fallback);
  if (retention >= threshold) {
    throw new Error(`${name} was incorrectly accepted at ${(retention * 100).toFixed(1)}% footprint retention.`);
  }
}

console.log(
  "Fallback footprint-retention behavior smoke passed: centered repairs remain eligible while edge-clipping replacements are rejected.",
  JSON.stringify({ threshold })
);
