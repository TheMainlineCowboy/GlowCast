import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "retainedOverlappingAutoMaskIds.has(zone.id)",
  'selectedZoneId === zone.id ? "REMOVE" : "OVERLAP"',
  ': "KEEP"',
  '"rgba(22, 163, 74, 0.98)"',
  'Remove candidate — this mask will be discarded if cleanup runs',
  'Overlap candidate — select Review Overlaps to inspect',
  'Keep candidate — this stronger mask remains after cleanup',
  'Selected automatic mask is scheduled for overlap removal',
  'This automatic mask is the stronger overlap candidate and will be kept'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing overlap keep/remove comparison marker: ${marker}`);
  }
}

console.log("Overlap keep/remove comparison cue source smoke passed.");