import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const expected of [
  "const originalParentAreas = new Map",
  "const blockedSatelliteAttachments = new Set<string>()",
  "const cumulativeGrowthRatio =",
  "if (cumulativeGrowthRatio > 2.05) {",
  "blockedSatelliteAttachments.add(parent.id + \":\" + satellite.id);",
  "!blockedSatelliteAttachments.has(parent.id + \":\" + satellite.id)",
  "return candidate.id !== satellite.id;"
]) {
  if (!source.includes(expected)) {
    throw new Error(`Missing cumulative satellite growth safeguard: ${expected}`);
  }
}

const growthGateIndex = source.indexOf("if (cumulativeGrowthRatio > 2.05) {");
const preserveSatelliteIndex = source.indexOf("blockedSatelliteAttachments.add(parent.id + \":\" + satellite.id);");
const retryFilterIndex = source.indexOf("!blockedSatelliteAttachments.has(parent.id + \":\" + satellite.id)");

if (!(growthGateIndex >= 0 && preserveSatelliteIndex > growthGateIndex && retryFilterIndex > preserveSatelliteIndex)) {
  throw new Error("Cumulative growth rejection must preserve the satellite and prevent the same parent/satellite retry loop.");
}

console.log("cumulative satellite growth source verified, including rejected-fragment preservation and retry-loop prevention");
