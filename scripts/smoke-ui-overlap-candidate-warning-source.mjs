import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "selectedRetainedOverlapId === zone.id",
  'selectedZoneId === zone.id ? "REMOVE" : "OVERLAP"',
  ': "KEEP"',
  '"rgba(22, 163, 74, 0.98)"',
  'Remove candidate — this mask will be discarded if cleanup runs',
  'Overlap candidate — select Review Overlaps to inspect',
  'Paired keep candidate — this stronger mask remains when the selected overlap is removed',
  'Selected automatic mask is scheduled for overlap removal',
  'This automatic mask is the paired stronger overlap candidate and will be kept'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing pair-specific overlap keep/remove marker: ${marker}`);
  }
}

console.log("Pair-specific overlap keep/remove comparison cue source smoke passed.");
