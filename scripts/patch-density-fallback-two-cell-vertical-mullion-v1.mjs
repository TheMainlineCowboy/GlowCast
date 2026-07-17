import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const offsetsFragment = "const verticalOffsets = widthCells >= 13 ? [-2, -1, 1, 2] : [-1, 1];";
const oldThreshold = "Math.max(mullionEvidenceThreshold * 1.15, frameDensity * 0.27)";
const strongerThreshold = "Math.max(mullionEvidenceThreshold * 1.25, frameDensity * 0.3)";

if (!source.includes(offsetsFragment)) {
  const oldStart = `          const offCenterVerticalMullionInteriorDensity = widthCells >= 9
            ? [-1, 1].reduce((bestDensity, offset) => {`;
  const newStart = `          const verticalOffsets = widthCells >= 13 ? [-2, -1, 1, 2] : [-1, 1];
          const offCenterVerticalMullionInteriorDensity = widthCells >= 9
            ? verticalOffsets.reduce((bestDensity, offset) => {`;
  const oldGate = `                return shiftedEvidence >= mullionEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;
  const newGate = `                const shiftedEvidenceThreshold = Math.abs(offset) === 2
                  ? ${strongerThreshold}
                  : mullionEvidenceThreshold;
                return shiftedEvidence >= shiftedEvidenceThreshold
                  ? Math.min(bestDensity, shiftedClearDensity)
                  : bestDensity;`;

  if (!source.includes(oldStart) || !source.includes(oldGate)) {
    throw new Error("Two-cell vertical mullion recovery anchors not found.");
  }
  source = source.replace(oldStart, newStart).replace(oldGate, newGate);
} else if (source.includes(oldThreshold)) {
  source = source.replace(oldThreshold, strongerThreshold);
}

if (!source.includes(offsetsFragment) || !source.includes(strongerThreshold)) {
  throw new Error("Stricter two-cell vertical mullion confidence was not applied.");
}

await fs.writeFile(path, source);
console.log("Recovered two-cell off-center vertical mullions with stricter far-offset divider confidence.");
