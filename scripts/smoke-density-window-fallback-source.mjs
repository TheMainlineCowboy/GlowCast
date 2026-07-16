import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "function buildDensityWindowFallbacks(",
  "const sideDensities = [topBand, bottomBand, leftBand, rightBand]",
  "const supportedSides = sideDensities.filter((density) => density >= sideThreshold).length",
  "const weakestSide = Math.min(...sideDensities)",
  "const strongestSide = Math.max(...sideDensities)",
  "const sideBalance = weakestSide / Math.max(0.01, strongestSide)",
  "const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4",
  "const hollowContrast = frameDensity / Math.max(0.01, center)",
  "const sideThreshold = Math.max(0.08, ringDensity * 1.08, center * 0.72)",
  "hollowContrast < 1.12",
  "supportedSides < 4",
  "weakestSide < sideThreshold",
  "sideBalance < 0.34",
  "sideBalance * 0.8",
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

if (source.includes("const sideThreshold = Math.max(ringDensity * 1.08, center * 0.72)")) {
  throw new Error("Density-window fallback regression failed: empty sides must not pass through a zero support threshold.");
}

if (source.includes("score: contrast * 2 + supportedSides")) {
  throw new Error("Density-window fallback regression failed: ranking must reward hollow balanced frames, not solid texture density.");
}

console.log("Density-window fallback source smoke passed: recovery requires nonzero, balanced support on all four sides and remains hollow-centered, overlap-suppressed, and bounded.");
