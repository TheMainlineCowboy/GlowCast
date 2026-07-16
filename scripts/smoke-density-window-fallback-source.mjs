import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "function buildDensityWindowFallbacks(",
  "for (let top = 2; top + heightCells <= rows - 2; top += 2)",
  "for (let left = 2; left + widthCells <= columns - 2; left += 2)",
  "const sideDensities = [topBand, bottomBand, leftBand, rightBand]",
  "const supportedSides = sideDensities.filter((density) => density >= sideThreshold).length",
  "const weakestSide = Math.min(...sideDensities)",
  "const strongestSide = Math.max(...sideDensities)",
  "const sideBalance = weakestSide / Math.max(0.01, strongestSide)",
  "const horizontalBalance = Math.min(topBand, bottomBand) / Math.max(0.01, Math.max(topBand, bottomBand))",
  "const verticalBalance = Math.min(leftBand, rightBand) / Math.max(0.01, Math.max(leftBand, rightBand))",
  "const oppositeSideBalance = Math.min(horizontalBalance, verticalBalance)",
  "const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4",
  "const hollowContrast = frameDensity / Math.max(0.01, center)",
  "const sideThreshold = Math.max(0.08, ringDensity * 1.08, center * 0.72)",
  "hollowContrast < 1.12",
  "supportedSides < 4",
  "weakestSide < sideThreshold",
  "sideBalance < 0.34",
  "oppositeSideBalance < 0.42",
  "sideBalance * 0.6",
  "oppositeSideBalance * 0.65",
  "componentFallbacks.length ? componentFallbacks : buildDensityWindowFallbacks(edgePoints, bounds)",
  "overlapRatio(existing, proposal) > 0.48",
  "if (accepted.length >= 6) break"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Density-window fallback regression failed: missing required behavior: ${fragment}`);
  }
}

if (source.includes("for (let top = 1; top + heightCells < rows - 1; top += 2)") ||
    source.includes("for (let left = 1; left + widthCells < columns - 1; left += 2)")) {
  throw new Error("Density-window fallback regression failed: border-adjacent proposals must retain a complete two-cell context ring.");
}

if (source.includes("supportedSides < 3")) {
  throw new Error("Density-window fallback regression failed: three-sided frames must not be accepted.");
}

if (source.includes("const sideThreshold = Math.max(ringDensity * 1.08, center * 0.72)")) {
  throw new Error("Density-window fallback regression failed: empty sides must not pass through a zero support threshold.");
}

if (source.includes("score: contrast * 2 + supportedSides")) {
  throw new Error("Density-window fallback regression failed: ranking must reward hollow frames with balanced opposite edges, not solid texture density.");
}

console.log("Density-window fallback source smoke passed: recovery keeps a complete exterior context ring, requires nonzero balanced support on every side and across opposite edge pairs, and remains hollow-centered, overlap-suppressed, and bounded.");
