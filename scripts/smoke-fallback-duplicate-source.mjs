import fs from "node:fs";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const adapter = fs.readFileSync(adapterPath, "utf8");

const requiredSnippets = [
  "const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);",
  "const existingArea = existing.box.width * existing.box.height;",
  "const fallbackAspect = box.width / Math.max(box.height, 0.01);",
  "const existingAspect = existing.box.width / Math.max(existing.box.height, 0.01);",
  "const aspectChange = Math.max(fallbackAspect / existingAspect, existingAspect / fallbackAspect);",
  "const extremeFallbackAspect = fallbackAspect < 0.35 || fallbackAspect > 3.2;",
  "const shapeConsistentFallback = aspectChange <= 1.6;",
  "shapeConsistentFallback &&",
  "id: existing.id",
  "const offCenterHorizontalMullionInteriorDensity = heightCells >= 10",
  "const dividerMid = verticalMid + offset",
  "if (topPaneHeight < 2 || bottomPaneHeight < 2) return bestDensity",
  "const shiftedEvidence = Math.min(shiftedLeftEvidence, shiftedRightEvidence)",
  "offCenterHorizontalMullionInteriorDensity"
];

const missingFromSource = requiredSnippets.filter((snippet) => !adapter.includes(snippet));
if (missingFromSource.length) {
  console.error("Fallback source smoke failed. Checked-in adapter source lacks required duplicate cleanup, shape consistency, extreme-aspect preservation, or off-center horizontal mullion behavior.");
  console.error(JSON.stringify(missingFromSource, null, 2));
  process.exit(1);
}

if (adapter.includes("const duplicate = next.some((existing) => overlapRatio(existing.box, box) > 0.58);\n    if (duplicate) continue;")) {
  console.error("Fallback duplicate source smoke failed. Old skip-only fallback duplicate block is still present.");
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

console.log("Fallback source smoke passed: ordinary shape-consistent overlaps may replace fragments, shape-distorting and extreme-aspect duplicates preserve stronger masks, and off-center horizontal dividers retain evidence and pane-clearance safeguards.");
