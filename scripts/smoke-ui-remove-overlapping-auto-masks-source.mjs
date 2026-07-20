import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "const findOverlappingAutoMaskIds = (candidateZones: ProjectZone[]) => {",
  "intersectionOverUnion >= 0.82 || smallerCoverage >= 0.94",
  "const overlappingAutoMaskIds = findOverlappingAutoMaskIds(zones);",
  "const reviewNextOverlappingAutoMask = () => {",
  "overlapCandidates.findIndex((zone) => zone.id === selectedZoneId)",
  "Review Overlaps ({overlappingAutoMaskIds.size})",
  "Reviewing overlap candidate ${currentIndex + 2 > overlapCandidates.length ? 1 : currentIndex + 2} of ${overlapCandidates.length}.",
  "const removeOverlappingAutoMasks = () => {",
  "Remove Overlaps ({overlappingAutoMaskIds.size})",
  "Removed ${overlappingAutoMaskIds.size} overlapping automatic mask"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing overlapping-mask cleanup marker: ${marker}`);
}

console.log("Overlapping automatic-mask cleanup and review source smoke passed.");
