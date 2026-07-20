import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientStrengthCoherence = bestRun.length",
  "neighborAgreement <= 0.08",
  "pairedJump >= 0.18",
  "secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Segment-aware strength-coherent jitter patch incomplete: ${JSON.stringify(missing)}`);

function coherence(strengths) {
  const normalized = strengths.map((strength) => Math.max(0, Math.min(strength, 255)) / 255);
  const repaired = [...normalized];
  if (normalized.length >= 5) {
    let interruptionIndex = -1;
    let interruptionScore = 0;
    for (let index = 1; index < normalized.length - 1; index += 1) {
      const left = normalized[index - 1];
      const current = normalized[index];
      const right = normalized[index + 1];
      const neighborAgreement = Math.abs(left - right);
      const pairedJump = Math.min(Math.abs(current - left), Math.abs(current - right));
      if (neighborAgreement <= 0.08 && pairedJump >= 0.18 && pairedJump > interruptionScore) {
        interruptionIndex = index;
        interruptionScore = pairedJump;
      }
    }
    if (interruptionIndex >= 0) {
      repaired[interruptionIndex] = (normalized[interruptionIndex - 1] + normalized[interruptionIndex + 1]) / 2;
    }
  }
  const adjacentChanges = repaired.slice(1).map((strength, index) => Math.abs(strength - repaired[index]));
  const meanAdjacentChange = adjacentChanges.reduce((sum, change) => sum + change, 0) / Math.max(adjacentChanges.length, 1);
  const continuity = 1 - Math.min(1, meanAdjacentChange * 2.5);
  const sorted = [...normalized].sort((a, b) => a - b);
  const trimCount = sorted.length >= 10 ? Math.max(1, Math.floor(sorted.length * 0.1)) : 0;
  const robust = sorted.slice(trimCount, sorted.length - trimCount || sorted.length);
  const robustStrength = robust.reduce((sum, strength) => sum + strength, 0) / Math.max(robust.length, 1);
  return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity)));
}

const softCoherentBoundary = coherence([132, 136, 130, 134, 131, 137]);
const coherentBoundaryWithLocalGlare = coherence([132, 136, 130, 58, 133, 137]);
const repeatedOscillatingReflection = coherence([42, 116, 35, 121, 38, 109]);
const strongCoherentBoundary = coherence([210, 216, 208, 214, 211, 218]);

if (!(coherentBoundaryWithLocalGlare > repeatedOscillatingReflection)) {
  throw new Error(`One localized glare interruption must retain more support than repeated oscillation: glare=${coherentBoundaryWithLocalGlare}, noise=${repeatedOscillatingReflection}`);
}
if (!(softCoherentBoundary >= coherentBoundaryWithLocalGlare)) {
  throw new Error(`An uninterrupted coherent boundary should not rank below a locally interrupted one: clean=${softCoherentBoundary}, glare=${coherentBoundaryWithLocalGlare}`);
}
if (!(strongCoherentBoundary > softCoherentBoundary)) {
  throw new Error(`Strong coherent architecture must retain more bounded relief than soft coherent architecture: strong=${strongCoherentBoundary}, soft=${softCoherentBoundary}`);
}
if (!(repeatedOscillatingReflection >= 0.2 && strongCoherentBoundary <= 1)) {
  throw new Error("Strength coherence must remain normalized and preserve the minimum detector allowance.");
}

console.log("Segment-aware strength-coherent jitter smoke passed: one isolated glare sample is repaired while repeated oscillation stays suppressed.");
