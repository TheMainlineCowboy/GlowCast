import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const requiredMarkers = [
  "const overlapReviewPosition = selectedZoneId === null",
  ".filter((zone) => overlappingAutoMaskIds.has(zone.id))",
  "Pair ${overlapReviewPosition} of ${overlappingAutoMaskIds.size}",
  "Review Overlaps (${overlappingAutoMaskIds.size})"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Overlap review progress marker missing: ${marker}`);
}

console.log("Overlap review pair progress source smoke passed.");
