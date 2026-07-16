import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "need manual review — check image for missed openings",
  'role="status"',
  'aria-live="polite"',
  "Check the image for openings that may need a manual mask."
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing actionable omitted-mask guidance marker: ${marker}`);
  }
}

if (source.includes("additional {omittedMaskLabel} need manual review</strong>")) {
  throw new Error("Non-actionable omitted-mask warning returned");
}

console.log("Actionable omitted-mask guidance source regression passed.");
