import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");
const required = [
  "function getAutoMaskConfidence(",
  'return "Weak";',
  'return "Strong";',
  'return "Review";',
  "Auto mask confidence: {selectedAutoMaskConfidence}",
  "selectedAutoMaskConfidence = getAutoMaskConfidence(selectedZone, projectionArea)",
  "data-auto-mask-confidence-overlay",
  'selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence',
  "GlowCast confidence:"
];

const missing = required.filter((snippet) => !source.includes(snippet));
if (missing.length) {
  throw new Error(`Automatic-mask confidence smoke failed; missing: ${missing.join(", ")}`);
}

console.log("Automatic-mask confidence source and selected-mask overlay smoke passed.");
