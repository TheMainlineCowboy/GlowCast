import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  'overlappingAutoMaskIds.has(zone.id) ? "overlapCandidate"',
  'boxShadow: "0 0 0 2px rgba(17, 24, 39, 0.75)',
  'border: "2px solid #fef3c7"',
  'Overlap candidate — review before removal',
  'aria-label="This automatic mask substantially overlaps another mask and is marked for cleanup"',
  "OVERLAP"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing overlap candidate warning marker: ${marker}`);
  }
}

console.log("Overlap candidate warning source smoke passed.");
