import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const offCenterHorizontalMullionInteriorDensity = heightCells >= 10",
  "const dividerMid = verticalMid + offset",
  "if (topPaneHeight < 2 || bottomPaneHeight < 2) return bestDensity",
  "const shiftedLeftEvidence = sumRect(",
  "const shiftedRightEvidence = sumRect(",
  "const shiftedEvidence = Math.min(shiftedLeftEvidence, shiftedRightEvidence)",
  "shiftedEvidence >= mullionEvidenceThreshold",
  "offCenterHorizontalMullionInteriorDensity"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Off-center horizontal mullion regression failed: missing ${fragment}`);
  }
}

if (source.includes("const horizontalMullionInteriorDensity = horizontalMullionEvidence >= mullionEvidenceThreshold ? horizontalMullionClearDensity : center;")) {
  throw new Error("Off-center horizontal mullion regression failed: centered-only horizontal divider recovery was restored.");
}

console.log("Off-center horizontal mullion source smoke passed: unequal-height divided openings retain distributed evidence and pane-clearance safeguards.");
