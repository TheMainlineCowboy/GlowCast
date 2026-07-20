import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientStrengthCoherence = bestRun.length",
  "flankInternalVariation <= 0.08",
  "flankAgreement <= 0.1",
  "secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Flank-validated strength-coherent jitter patch incomplete: ${JSON.stringify(missing)}`);

function coherence(strengths) {
  const normalized = strengths.map((strength) => Math.max(0, Math.min(strength, 255)) / 255);
  const repaired = [...normalized];
  if (normalized.length >= 6) {
    let interruptionIndex = -1;
    let interruptionScore = 0;
    for (let index = 2; index < normalized.length - 2; index += 1) {
      const left = normalized[index - 1];
      const current = normalized[index];
      const right = normalized[index + 1];
      const leftFlank = [normalized[index - 2], left];
      const rightFlank = [right, normalized[index + 2]];
      const leftFlankMean = (leftFlank[0] + leftFlank[1]) / 2;
      const rightFlankMean = (rightFlank[0] + rightFlank[1]) / 2;
      const flankInternalVariation = Math.max(
        Math.abs(leftFlank[0] - leftFlank[1]),
        Math.abs(rightFlank[0] - rightFlank[1])
      );
      const flankAgreement = Math.abs(leftFlankMean - rightFlankMean);
      const pairedJump = Math.min(Math.abs(current - leftFlankMean), Math.abs(current - rightFlankMean));
      if (flankInternalVariation <= 0.08 && flankAgreement <= 0.1 && pairedJump >= 0.18 && pairedJump > interruptionScore) {
        interruptionIndex = index;
        interruptionScore = pairedJump;
      }
    }
    if (interruptionIndex >= 0) repaired[interruptionIndex] = (normalized[interruptionIndex - 1] + normalized[interruptionIndex + 1]) / 2;
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
const isolatedGlare = coherence([132, 136, 130, 58, 133, 137]);
const broadMissingSegment = coherence([132, 136, 58, 61, 133, 137]);
const unstableFlanks = coherence([132, 75, 130, 58, 84, 137]);
const repeatedOscillatingReflection = coherence([42, 116, 35, 121, 38, 109]);
const strongCoherentBoundary = coherence([210, 216, 208, 214, 211, 218]);

if (!(isolatedGlare > broadMissingSegment)) throw new Error(`One isolated glare sample must retain more support than a multi-sample missing segment: glare=${isolatedGlare}, missing=${broadMissingSegment}`);
if (!(isolatedGlare > unstableFlanks)) throw new Error(`Glare relief must require coherent flanks: glare=${isolatedGlare}, unstable=${unstableFlanks}`);
if (!(isolatedGlare > repeatedOscillatingReflection)) throw new Error(`One localized glare interruption must retain more support than repeated oscillation: glare=${isolatedGlare}, noise=${repeatedOscillatingReflection}`);
if (!(softCoherentBoundary >= isolatedGlare)) throw new Error(`An uninterrupted coherent boundary should not rank below a locally interrupted one: clean=${softCoherentBoundary}, glare=${isolatedGlare}`);
if (!(strongCoherentBoundary > softCoherentBoundary)) throw new Error(`Strong coherent architecture must retain more bounded relief than soft coherent architecture: strong=${strongCoherentBoundary}, soft=${softCoherentBoundary}`);
if (!(repeatedOscillatingReflection >= 0.2 && strongCoherentBoundary <= 1)) throw new Error("Strength coherence must remain normalized and preserve the minimum detector allowance.");

console.log("Flank-validated strength-coherent jitter smoke passed: isolated glare is tolerated, but broad missing segments and unstable flanks stay suppressed.");
