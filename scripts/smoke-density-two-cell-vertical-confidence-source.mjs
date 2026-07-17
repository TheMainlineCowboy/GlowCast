import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const shiftedEvidenceThreshold = Math.abs(offset) === 2",
  "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)",
  "shiftedEvidence >= shiftedEvidenceThreshold"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Two-cell vertical confidence regression failed: missing ${fragment}`);
  }
}

if (source.includes("Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)")) {
  throw new Error("Two-cell vertical confidence regression failed: weaker threshold restored.");
}

console.log("Two-cell vertical confidence source smoke passed: far off-center dividers require stronger evidence.");
