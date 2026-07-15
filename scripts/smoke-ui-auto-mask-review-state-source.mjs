import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const required = [
  'aria-live="polite"',
  '"· No auto masks yet"',
  '"· ✓ Review complete"',
  '`· ⚠ ${',
  'auto need review'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Automatic mask review-state marker missing: ${marker}`);
  }
}

if (!source.includes('startsWith("Auto architectural mask") && !zone.included).length} auto need review')) {
  throw new Error("Incomplete review state must report the remaining disabled automatic masks.");
}

if (source.includes('"· Review complete"')) {
  throw new Error("Review completion must retain the visible success indicator.");
}

console.log("Automatic mask review-state source regression passed.");
