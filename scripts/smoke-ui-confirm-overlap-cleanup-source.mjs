import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "Remove overlapping masks? GlowCast will keep the stronger mask from each pair.",
  "Overlap cleanup canceled. No masks were removed.",
  "const confirmed = window.confirm(",
  "if (!confirmed)"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Overlap cleanup confirmation marker missing: ${marker}`);
  }
}

console.log("Overlap cleanup confirmation source smoke passed.");
