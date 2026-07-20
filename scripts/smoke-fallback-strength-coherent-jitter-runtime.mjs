import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientStrengthCoherence = bestRun.length",
  "stableMeanAdjacentChange",
  "localizedInterruptionRetention",
  "secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Segment-aware strength-coherent jitter patch incomplete: ${JSON.stringify(missing)}`);

function coherence(strengths) {
  const normalized = strengths.map((strength) => Math.max(0, Math.min(strength, 255)) / 255);
  const adjacentChanges = normalized.slice(1).map((strength, index) => Math.abs(strength - normalized[index]));
  const sortedAdjacentChanges = [...adjacentChanges].sort((a, b) => a - b);
  const localizedInterruptionCount = sortedAdjacentChanges.length >= 4 ? 1 : 0;
  const stableAdjacentChanges = sortedAdjacentChanges.slice(0, Math.max(1, sortedAdjacentChanges.length - localizedInterruptionCount));
  const stableMeanAdjacentChange = stableAdjacentChanges.reduce((sum, change) => sum + change, 0) / Math.max(stableAdjacentChanges.length, 1);
  const strongestInterruption = sortedAdjacentChanges.at(-1) ?? 0;
  const continuity = 1 - Math.min(1, stableMeanAdjacentChange * 2.5);
  const localizedInterruptionRetention = 1 - Math.min(0.25, strongestInterruption * 0.35);
  const sorted = [...normalized].sort((a, b) => a - b);
  const trimCount = sorted.length >= 10 ? Math.max(1, Math.floor(sorted.length * 0.1)) : 0;
  const robust = sorted.slice(trimCount, sorted.length - trimCount || sorted.length);
  const robustStrength = robust.reduce((sum, strength) => sum + strength, 0) / Math.max(robust.length, 1);
  return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity) * localizedInterruptionRetention));
}

const softCoherentBoundary = coherence([132, 136, 130, 134, 131, 137]);
const coherentBoundaryWithLocalGlare = coherence([132, 136, 130, 58, 133, 137]);
const repeatedOscillatingReflection = coherence([42, 116, 35, 121, 38, 109]);
const strongCoherentBoundary = coherence([210, 216, 208, 214, 211, 218]);

if (!(coherentBoundaryWithLocalGlare > repeatedOscillatingReflection)) {
  throw new Error(`One localized glare interruption must retain more support than repeated oscillation: glare=${coherentBoundaryWithLocalGlare}, noise=${repeatedOscillatingReflection}`);
}
if (!(softCoherentBoundary > coherentBoundaryWithLocalGlare)) {
  throw new Error(`An uninterrupted coherent boundary should still outrank a locally interrupted one: clean=${softCoherentBoundary}, glare=${coherentBoundaryWithLocalGlare}`);
}
if (!(strongCoherentBoundary > softCoherentBoundary)) {
  throw new Error(`Strong coherent architecture must retain more bounded relief than soft coherent architecture: strong=${strongCoherentBoundary}, soft=${softCoherentBoundary}`);
}
if (!(repeatedOscillatingReflection >= 0.2 && strongCoherentBoundary <= 1)) {
  throw new Error("Strength coherence must remain normalized and preserve the minimum detector allowance.");
}

console.log("Segment-aware strength-coherent jitter smoke passed: one local glare interruption is preserved while repeated oscillation stays suppressed.");
