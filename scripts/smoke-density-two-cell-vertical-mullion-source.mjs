import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const verticalOffsets = widthCells >= 13 ? [-2, -1, 1, 2] : [-1, 1];",
  "verticalOffsets.reduce((bestDensity, offset) => {",
  "const shiftedEvidenceThreshold = Math.abs(offset) === 2",
  "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)",
  "shiftedEvidence >= shiftedEvidenceThreshold"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Two-cell vertical mullion regression failed: missing ${fragment}`);
  }
}

if (source.includes("? [-1, 1].reduce((bestDensity, offset) => {") ||
    source.includes("Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)")) {
  throw new Error("Two-cell vertical mullion regression failed: weaker far-offset recovery was restored.");
}

console.log("Two-cell vertical mullion source smoke passed: large unequal-width openings require stricter far-offset divider evidence.");
