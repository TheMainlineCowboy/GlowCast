import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  '"autoReviewFocus"',
  '@keyframes autoReviewPulse',
  '.zone.autoReviewFocus',
  'prefers-reduced-motion: reduce',
  '(zone.label ?? "").startsWith("Auto architectural mask") && !zone.included'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Missing automatic-mask review focus marker: ${marker}`);
  }
}

if (!source.includes('selectedZoneId === zone.id')) {
  throw new Error("Review focus is not tied to the selected zone.");
}

console.log("Automatic-mask review focus source regression passed.");
