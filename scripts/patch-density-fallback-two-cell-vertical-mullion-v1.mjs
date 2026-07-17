import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

if (source.includes("const verticalOffsets = widthCells >= 13 ? [-2, -1, 1, 2] : [-1, 1];")) {
  console.log("Two-cell off-center vertical mullion recovery already present.");
} else {
  const oldStart = `          const offCenterVerticalMullionInteriorDensity = widthCells >= 9
            ? [-1, 1].reduce((bestDensity, offset) => {`;
  const newStart = `          const verticalOffsets = widthCells >= 13 ? [-2, -1, 1, 2] : [-1, 1];
          const offCenterVerticalMullionInteriorDensity = widthCells >= 9
            ? verticalOffsets.reduce((bestDensity, offset) => {`;
  const oldGate = `                return shiftedEvidence >= mullionEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;
  const newGate = `                const shiftedEvidenceThreshold = Math.abs(offset) === 2
                  ? Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)
                  : mullionEvidenceThreshold;
                return shiftedEvidence >= shiftedEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;

  if (!source.includes(oldStart) || !source.includes(oldGate)) {
    throw new Error("Two-cell vertical mullion recovery anchors not found.");
  }
  source = source.replace(oldStart, newStart).replace(oldGate, newGate);
  await fs.writeFile(path, source);
  console.log("Recovered two-cell off-center vertical mullions on large openings with stronger divider evidence.");
}
