import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "data-auto-mask-confidence-overlay",
  'selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence',
  "GlowCast confidence:",
  "{selectedAutoMaskConfidence}"
];

const missing = required.filter((snippet) => !source.includes(snippet));
if (missing.length) {
  throw new Error(`Automatic-mask confidence overlay smoke failed; missing: ${missing.join(", ")}`);
}

console.log("Automatic-mask confidence overlay source smoke passed.");
