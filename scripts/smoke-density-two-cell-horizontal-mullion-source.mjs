import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const horizontalOffsets = heightCells >= 14 ? [-2, -1, 1, 2] : [-1, 1];",
  "horizontalOffsets.reduce((bestDensity, offset) => {",
  "const shiftedEvidenceThreshold = Math.abs(offset) === 2",
  "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)",
  "shiftedEvidence >= shiftedEvidenceThreshold"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Two-cell horizontal mullion source smoke missing: ${fragment}`);
  }
}

if (source.includes("? [-1, 1].reduce((bestDensity, offset) => {") ||
    source.includes("Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)")) {
  throw new Error("Two-cell horizontal mullion regression failed: weaker far-offset recovery was restored.");
}

console.log("Two-cell horizontal mullion source smoke passed: large unequal-height openings require stricter far-offset divider evidence.");
