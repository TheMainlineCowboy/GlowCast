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
  "data-auto-mask-review-state",
  'zone.included ? "accepted" : "pending"',
  'zone.included ? "Accepted" : "Pending review"',
  "Review state:",
  'selectedTarget === "zone" && selectedZoneId === zone.id && selectedAutoMaskConfidence',
  "GlowCast confidence:",
  "function isNearbyMaskCandidate(",
  "normalizedDistance <= 0.34",
  "data-nearby-strong-auto-mask",
  'selectedAutoMaskConfidence !== "Strong"',
  'getAutoMaskConfidence(zone, projectionArea) === "Strong"',
  "isNearbyMaskCandidate(zone, selectedZone, projectionArea)",
  "Strong alternative"
];

const missing = required.filter((snippet) => !source.includes(snippet));
if (missing.length) {
  throw new Error(`Automatic-mask confidence smoke failed; missing: ${missing.join(", ")}`);
}

console.log("Automatic-mask confidence, review-state, and nearby strong-candidate comparison overlay smoke passed.");
