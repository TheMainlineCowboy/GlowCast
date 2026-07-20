import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "overlappingAutoMaskIds.has(zone.id) ? (",
  'selectedZoneId === zone.id ? "REMOVE" : "OVERLAP"',
  'background: selectedZoneId === zone.id',
  'color: selectedZoneId === zone.id ? "#ffffff" : "#111827"',
  'Remove candidate — this mask will be discarded if cleanup runs',
  'Overlap candidate — select Review Overlaps to inspect',
  'aria-label={selectedZoneId === zone.id',
  'Selected automatic mask is scheduled for overlap removal'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing overlap candidate warning marker: ${marker}`);
  }
}

console.log("Overlap candidate warning and selected-removal cue source smoke passed.");
