import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {",
  "intersectionOverUnion >= 0.82 || smallerCoverage >= 0.94",
  "const overlappingAutoMaskIds = findOverlappingAutoMaskIds(zones);",
  "const removeOverlappingAutoMasks = () => {",
  "Remove Overlaps ({overlappingAutoMaskIds.size})",
  "Removed ${overlappingAutoMaskIds.size} overlapping automatic mask"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing overlapping-mask cleanup marker: ${marker}`);
}

console.log("Overlapping automatic-mask cleanup source smoke passed.");
