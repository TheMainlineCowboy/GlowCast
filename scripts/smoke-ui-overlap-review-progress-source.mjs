import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const requiredMarkers = [
  "const overlapReviewPosition = selectedZoneId === null",
  ".filter((zone) => overlappingAutoMaskIds.has(zone.id))",
  "Pair ${overlapReviewPosition} of ${overlappingAutoMaskIds.size}",
  "Review Overlaps (${overlappingAutoMaskIds.size})",
  "const selectOverlappingAutoMask = (direction: 1 | -1)",
  "const reviewPreviousOverlappingAutoMask = () => selectOverlappingAutoMask(-1)",
  "event.key !== \"ArrowLeft\" && event.key !== \"ArrowRight\"",
  "selectOverlappingAutoMask(event.key === \"ArrowRight\" ? 1 : -1)",
  "input, textarea, select, [contenteditable='true']",
  "←/→ review pairs",
  "Use Left and Right Arrow keys to review overlap pairs"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Overlap review progress or keyboard marker missing: ${marker}`);
}

console.log("Overlap review pair progress and keyboard navigation source smoke passed.");
