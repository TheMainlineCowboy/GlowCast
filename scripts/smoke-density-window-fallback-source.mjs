import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "function buildDensityWindowFallbacks(",
  "const widths = [5, 7, 9, 11, 13]",
  "const heights = [6, 8, 10, 12, 14, 16]",
  "for (let top = 2; top + heightCells <= rows - 2; top += 2)",
  "for (let left = 2; left + widthCells <= columns - 2; left += 2)",
  "const horizontalMid = left + Math.floor(widthCells / 2)",
  "const verticalMid = top + Math.floor(heightCells / 2)",
  "const halfSideDensities = [",
  "const cornerDensities = [",
  "const halfSideThreshold = Math.max(0.05, sideThreshold * 0.58)",
  "const cornerThreshold = Math.max(0.045, halfSideThreshold * 0.72)",
  "const distributedHalfSides = halfSideDensities.filter((density) => density >= halfSideThreshold).length",
  "const supportedCorners = cornerDensities.filter((density) => density >= cornerThreshold).length",
  "const sideDensities = [topBand, bottomBand, leftBand, rightBand]",
  "const supportedSides = sideDensities.filter((density) => density >= sideThreshold).length",
  "const weakestSide = Math.min(...sideDensities)",
  "const strongestSide = Math.max(...sideDensities)",
  "const sideBalance = weakestSide / Math.max(0.01, strongestSide)",
  "const horizontalBalance = Math.min(topBand, bottomBand) / Math.max(0.01, Math.max(topBand, bottomBand))",
  "const verticalBalance = Math.min(leftBand, rightBand) / Math.max(0.01, Math.max(leftBand, rightBand))",
  "const oppositeSideBalance = Math.min(horizontalBalance, verticalBalance)",
  "const frameDensity = (topBand + bottomBand + leftBand + rightBand) / 4",
  "const verticalMullionClearDensity = (leftInterior + rightInterior) / 2",
  "const horizontalMullionClearDensity = (topInterior + bottomInterior) / 2",
  "const mullionTolerantInteriorDensity = Math.min(center, verticalMullionClearDensity, horizontalMullionClearDensity)",
  "const hollowContrast = frameDensity / Math.max(0.01, mullionTolerantInteriorDensity)",
  "const sideThreshold = Math.max(0.08, ringDensity * 1.08, center * 0.72)",
  "hollowContrast < 1.12",
  "supportedSides < 4",
  "distributedHalfSides < 7",
  "supportedCorners < 3",
  "weakestSide < sideThreshold",
  "sideBalance < 0.34",
  "oppositeSideBalance < 0.42",
  "const isSlimVertical = aspect < 0.35",
  "if (aspect < 0.22 || aspect > 2.8) continue",
  "heightCells < 10",
  "hollowContrast < 1.28",
  "oppositeSideBalance < 0.5",
  "supportedCorners < 4",
  "distributedHalfSides * 0.12",
  "supportedCorners * 0.16",
  "sideBalance * 0.6",
  "oppositeSideBalance * 0.65",
  "componentFallbacks.length ? componentFallbacks : buildDensityWindowFallbacks(edgePoints, bounds)",
  "const nearDuplicate = accepted.some((existing) => {",
  "const horizontalOffset = Math.abs(proposalCenterX - existingCenterX) / Math.max(1, Math.min(existing.width, proposal.width))",
  "const verticalOffset = Math.abs(proposalCenterY - existingCenterY) / Math.max(1, Math.min(existing.height, proposal.height))",
  "horizontalOffset <= 0.18 && verticalOffset <= 0.18",
  "areaRatio >= 0.52",
  "if (nearDuplicate) continue",
  "if (accepted.length >= 6) break"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Density-window fallback regression failed: missing required behavior: ${fragment}`);
  }
}

if (source.includes("const widths = [7, 9, 11, 13]")) {
  throw new Error("Density-window fallback regression failed: slim vertical architectural openings must remain in the recovery search range.");
}

if (source.includes("const heights = [6, 8, 10, 12]")) {
  throw new Error("Density-window fallback regression failed: tall door-shaped openings must remain in the recovery search range.");
}

if (source.includes("if (aspect < 0.35 || aspect > 2.8) continue")) {
  throw new Error("Density-window fallback regression failed: slim door recovery must not be disabled by the previous minimum aspect ratio.");
}

if (source.includes("for (let top = 1; top + heightCells < rows - 1; top += 2)") ||
    source.includes("for (let left = 1; left + widthCells < columns - 1; left += 2)")) {
  throw new Error("Density-window fallback regression failed: border-adjacent proposals must retain a complete two-cell context ring.");
}

if (source.includes("supportedSides < 3")) {
  throw new Error("Density-window fallback regression failed: three-sided frames must not be accepted.");
}

if (source.includes("distributedHalfSides < 6")) {
  throw new Error("Density-window fallback regression failed: frame evidence must be distributed across nearly every half-side segment.");
}

if (source.includes("supportedCorners < 2")) {
  throw new Error("Density-window fallback regression failed: disconnected edges must not pass without continuity through most frame corners.");
}

if (source.includes("const sideThreshold = Math.max(ringDensity * 1.08, center * 0.72)")) {
  throw new Error("Density-window fallback regression failed: empty sides must not pass through a zero support threshold.");
}

if (source.includes("const hollowContrast = frameDensity / Math.max(0.01, center)")) {
  throw new Error("Density-window fallback regression failed: a single central mullion must not make an otherwise hollow architectural frame look solid.");
}

if (source.includes("centerDistance <= smallerDiagonal * 0.16")) {
  throw new Error("Density-window fallback regression failed: diagonal-only deduplication can collapse close adjacent windows.");
}

if (source.includes("if (accepted.some((existing) => overlapRatio(existing, proposal) > 0.48)) continue;")) {
  throw new Error("Density-window fallback regression failed: offset, similarly sized proposals must be suppressed even when raw overlap is just below the old cutoff.");
}

if (source.includes("score: contrast * 2 + supportedSides")) {
  throw new Error("Density-window fallback regression failed: ranking must reward hollow frames with distributed, corner-connected, balanced edge evidence, not solid texture density.");
}

console.log("Density-window fallback source smoke passed: recovery includes slim and tall openings, preserves safety gates, and tolerates a single central mullion.");
