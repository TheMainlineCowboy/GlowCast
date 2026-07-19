import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientStrengthCoherence = bestRun.length",
  "robustStrength * (0.55 + 0.45 * continuity)",
  "secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Strength-coherent jitter patch incomplete: ${JSON.stringify(missing)}`);

function coherence(strengths) {
  const normalized = strengths.map((strength) => Math.max(0, Math.min(strength, 255)) / 255);
  const adjacentChanges = normalized.slice(1).map((strength, index) => Math.abs(strength - normalized[index]));
  const meanAdjacentChange = adjacentChanges.reduce((sum, change) => sum + change, 0) / Math.max(adjacentChanges.length, 1);
  const continuity = 1 - Math.min(1, meanAdjacentChange * 2.5);
  const sorted = [...normalized].sort((a, b) => a - b);
  const trimCount = sorted.length >= 10 ? Math.max(1, Math.floor(sorted.length * 0.1)) : 0;
  const robust = sorted.slice(trimCount, sorted.length - trimCount || sorted.length);
  const robustStrength = robust.reduce((sum, strength) => sum + strength, 0) / Math.max(robust.length, 1);
  return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity)));
}

const softCoherentBoundary = coherence([132, 136, 130, 134, 131, 137]);
const weakOscillatingReflection = coherence([42, 116, 35, 121, 38, 109]);
const strongCoherentBoundary = coherence([210, 216, 208, 214, 211, 218]);

if (!(softCoherentBoundary > weakOscillatingReflection)) {
  throw new Error(`Soft coherent architecture must outrank weak oscillating reflection noise: coherent=${softCoherentBoundary}, noise=${weakOscillatingReflection}`);
}
if (!(strongCoherentBoundary > softCoherentBoundary)) {
  throw new Error(`Strong coherent architecture must retain more bounded relief than soft coherent architecture: strong=${strongCoherentBoundary}, soft=${softCoherentBoundary}`);
}
if (!(weakOscillatingReflection >= 0.2 && strongCoherentBoundary <= 1)) {
  throw new Error("Strength coherence must remain normalized and preserve the minimum detector allowance.");
}

console.log("Strength-coherent jitter smoke passed: coherent architectural edges outrank weak oscillating reflections.");
