import fs from "node:fs";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const adapter = fs.readFileSync(adapterPath, "utf8");

const requiredSnippets = [
  "const overlappingCandidates = next",
  "overlap: overlapRatio(existing.box, box)",
  "perimeterSides: sideMetrics.filter((metrics) => metrics.coverage > 0).length",
  "perimeterCoverage: sideMetrics.reduce((sum, metrics) => sum + Math.min(metrics.coverage, 1), 0)",
  "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0)",
  "perimeterStrength: sideMetrics.reduce((sum, metrics) => sum + metrics.strength, 0)",
  "perimeterSpread: sideSpreads.reduce((sum, spread) => sum + Math.min(spread, 1), 0)",
  "const continuousMetrics = (samples: Array<{ position: number; strength: number }>, dimension: number) =>",
  "const maxGap = Math.max(1.5, Math.min(4, dimension * 0.025));",
  "density: Math.min(1, bestRun.length / Math.max(span + 1, 1))",
  "strength: bestRun.reduce((sum, sample) => sum + Math.max(0, Math.min(sample.strength, 255)), 0) / Math.max(bestRun.length * 255, 1)",
  ".filter((candidate) => candidate.overlap > 0.58)",
  "b.perimeterSides - a.perimeterSides",
  "b.perimeterCoverage - a.perimeterCoverage",
  "b.perimeterDensity - a.perimeterDensity",
  "b.perimeterStrength - a.perimeterStrength",
  "b.perimeterSpread - a.perimeterSpread",
  "a.area - b.area",
  "const duplicateIndex = overlappingCandidates[0]?.index ?? -1;",
  "const existingArea = existing.box.width * existing.box.height;",
  "const fallbackAspect = box.width / Math.max(box.height, 0.01);",
  "const existingAspect = existing.box.width / Math.max(existing.box.height, 0.01);",
  "const aspectChange = Math.max(fallbackAspect / existingAspect, existingAspect / fallbackAspect);",
  "const existingCenterX = existing.box.x + existing.box.width / 2;",
  "const existingCenterY = existing.box.y + existing.box.height / 2;",
  "const fallbackCenterX = box.x + box.width / 2;",
  "const fallbackCenterY = box.y + box.height / 2;",
  "const normalizedCenterDrift = Math.hypot(",
  "const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;",
  "const shapeConsistentFallback = aspectChange <= 1.6;",
  "const centerConsistentFallback = normalizedCenterDrift <= 0.22;",
  "shapeConsistentFallback &&",
  "centerConsistentFallback &&",
  "id: existing.id",
  "const offCenterHorizontalMullionInteriorDensity = heightCells >= 10",
  "const dividerMid = verticalMid + offset",
  "if (topPaneHeight < 2 || bottomPaneHeight < 2) return bestDensity",
  "const shiftedEvidence = Math.min(shiftedLeftEvidence, shiftedRightEvidence)",
  "offCenterHorizontalMullionInteriorDensity"
];

const missingFromSource = requiredSnippets.filter((snippet) => !adapter.includes(snippet));
if (missingFromSource.length) {
  console.error("Fallback source smoke failed. Checked-in adapter source lacks strength-aware continuous perimeter duplicate ranking, center and shape consistency, extreme-aspect preservation, or off-center horizontal mullion behavior.");
  console.error(JSON.stringify(missingFromSource, null, 2));
  process.exit(1);
}

if (adapter.includes("const duplicate = next.some((existing) => overlapRatio(existing.box, box) > 0.58);\n    if (duplicate) continue;")) {
  console.error("Fallback duplicate source smoke failed. Old skip-only fallback duplicate block is still present.");
  process.exit(1);
}

if (adapter.includes("const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);")) {
  console.error("Fallback duplicate source smoke failed. First-match overlap selection is still present and can make nested masks order-dependent.");
  process.exit(1);
}

if (adapter.includes("perimeterSides: [top, bottom, left, right].filter(Boolean).length")) {
  console.error("Fallback duplicate source smoke failed. Isolated edge touches can still imitate complete nested perimeter evidence.");
  process.exit(1);
}

if (adapter.includes("perimeterSides: sideSpreads.filter((spread) => spread > 0).length")) {
  console.error("Fallback duplicate source smoke failed. Widely separated side samples can still imitate continuous perimeter support.");
  process.exit(1);
}

if (adapter.includes("perimeterSides: sideCoverage.filter((coverage) => coverage > 0).length")) {
  console.error("Fallback duplicate source smoke failed. Continuous span is still ranked without density evidence.");
  process.exit(1);
}

if (!adapter.includes("b.perimeterStrength - a.perimeterStrength ||")) {
  console.error("Fallback duplicate source smoke failed. Equally dense weak evidence can still tie strong architectural edges.");
  process.exit(1);
}

if (adapter.includes(".sort((a, b) => b.overlap - a.overlap || a.area - b.area || a.index - b.index)")) {
  console.error("Fallback duplicate source smoke failed. Nested selection still ignores perimeter completeness and continuity.");
  process.exit(1);
}

if (adapter.includes("shapeConsistentFallback &&\n        fallbackArea > existingArea * 1.12")) {
  console.error("Fallback duplicate source smoke failed. Displaced fallbacks can still replace stronger architectural masks.");
  process.exit(1);
}

if (adapter.includes("if (!extremeFallbackAspect && fallbackArea > existingArea * 1.12 && fallback.score >= 1.2) {")) {
  console.error("Fallback duplicate source smoke failed. Shape-distorting fallbacks can still replace stronger architectural masks.");
  process.exit(1);
}

if (adapter.includes("const horizontalMullionInteriorDensity = horizontalMullionEvidence >= mullionEvidenceThreshold ? horizontalMullionClearDensity : center;")) {
  console.error("Fallback mullion source smoke failed. Centered-only horizontal divider recovery is still present.");
  process.exit(1);
}

console.log("Fallback source smoke passed: overlaps are ranked by overlap, perimeter completeness, continuous coverage, edge density, normalized edge strength, and distributed spread before size; weak, displaced, distorted, extreme-aspect, isolated-touch, sparse-run, loose-density, or order-dependent duplicates preserve stronger masks.");
