import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const expected of [
  "const originalParentAreas = new Map",
  "const blockedSatelliteAttachments = new Set<string>()",
  "const cumulativeGrowthRatio =",
  "if (cumulativeGrowthRatio > 2.05) {",
  "blockedSatelliteAttachments.add(parent.id + \":\" + satellite.id);"
]) {
  if (!source.includes(expected)) {
    throw new Error(`Missing cumulative satellite growth safeguard: ${expected}`);
  }
}

console.log("cumulative satellite growth source verified");
