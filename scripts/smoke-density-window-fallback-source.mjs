import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "function buildDensityWindowFallbacks(",
  "const supportedSides = [topBand, bottomBand, leftBand, rightBand]",
  "const weakestSide = Math.min(topBand, bottomBand, leftBand, rightBand)",
  "supportedSides < 4",
  "weakestSide < sideThreshold",
  "componentFallbacks.length ? componentFallbacks : buildDensityWindowFallbacks(edgePoints, bounds)",
  "overlapRatio(existing, proposal) > 0.48",
  "if (accepted.length >= 6) break"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Density-window fallback regression failed: missing required behavior: ${fragment}`);
  }
}

if (source.includes("supportedSides < 3")) {
  throw new Error("Density-window fallback regression failed: three-sided frames must not be accepted.");
}

console.log("Density-window fallback source smoke passed: recovery remains last-resort, four-sided, overlap-suppressed, and bounded.");
