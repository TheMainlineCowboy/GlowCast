import fs from "node:fs";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const adapter = fs.readFileSync(adapterPath, "utf8");

const requiredSnippets = [
  "const overlappingCandidates = next",
  "overlap: overlapRatio(existing.box, box)",
  "perimeterSides: [top, bottom, left, right].filter(Boolean).length",
  ".filter((candidate) => candidate.overlap > 0.58)",
  "b.perimeterSides - a.perimeterSides",
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
  console.error("Fallback source smoke failed. Checked-in adapter source lacks perimeter-quality duplicate ranking, center and shape consistency, extreme-aspect preservation, or off-center horizontal mullion behavior.");
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

if (adapter.includes(".sort((a, b) => b.overlap - a.overlap || a.area - b.area || a.index - b.index)")) {
  console.error("Fallback duplicate source smoke failed. Nested selection still ignores perimeter completeness.");
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

console.log("Fallback source smoke passed: overlaps are ranked by overlap and perimeter completeness before size, only centered shape-consistent repairs may replace fragments, and displaced, distorted, extreme-aspect, or order-dependent duplicates preserve stronger masks.");
