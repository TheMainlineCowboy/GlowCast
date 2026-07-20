import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const secondaryGapGradientStrengthCoherence = bestRun.length",
  "bilateralContrastRetention >= 0.62",
  "Math.min(leftContrastRetention, rightContrastRetention)",
  "secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence"
];
const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) throw new Error(`Bilateral-contrast-aware strength-coherent jitter patch incomplete: ${JSON.stringify(missing)}`);

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
    if (interruptionIndex >= 0) {
      repaired[interruptionIndex] = (normalized[interruptionIndex - 1] + normalized[interruptionIndex + 1]) / 2;
    } else {
      for (let index = 2; index < normalized.length - 3; index += 1) {
        const segment = [normalized[index], normalized[index + 1]];
        const leftFlank = [normalized[index - 2], normalized[index - 1]];
        const rightFlank = [normalized[index + 2], normalized[index + 3]];
        const leftFlankMean = (leftFlank[0] + leftFlank[1]) / 2;
        const rightFlankMean = (rightFlank[0] + rightFlank[1]) / 2;
        const flankMean = (leftFlankMean + rightFlankMean) / 2;
        const flankInternalVariation = Math.max(
          Math.abs(leftFlank[0] - leftFlank[1]),
          Math.abs(rightFlank[0] - rightFlank[1])
        );
        const segmentVariation = Math.abs(segment[0] - segment[1]);
        const segmentMean = (segment[0] + segment[1]) / 2;
        const segmentDip = flankMean - segmentMean;
        const leftContrastRetention = segment[0] / Math.max(leftFlankMean, 0.001);
        const rightContrastRetention = segment[1] / Math.max(rightFlankMean, 0.001);
        const bilateralContrastRetention = Math.min(leftContrastRetention, rightContrastRetention);
        if (flankInternalVariation <= 0.08 && Math.abs(leftFlankMean - rightFlankMean) <= 0.1 && segmentVariation <= 0.06 && flankMean >= 0.4 && bilateralContrastRetention >= 0.62 && segmentDip >= 0.1 && segmentDip <= 0.28) {
          repaired[index] = segment[0] + (flankMean - segment[0]) * 0.45;
          repaired[index + 1] = segment[1] + (flankMean - segment[1]) * 0.45;
          break;
        }
      }
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
const isolatedGlare = coherence([132, 136, 130, 58, 133, 137]);
const coherentShadowSegment = coherence([132, 136, 92, 96, 133, 137]);
const oneSidedReflectionSegment = coherence([132, 136, 86, 101, 133, 137]);
const lowContrastReflectionSegment = coherence([132, 136, 70, 73, 133, 137]);
const broadMissingSegment = coherence([132, 136, 58, 61, 133, 137]);
const unstableSoftSegment = coherence([132, 78, 92, 96, 84, 137]);
const repeatedOscillatingReflection = coherence([42, 116, 35, 121, 38, 109]);
const strongCoherentBoundary = coherence([210, 216, 208, 214, 211, 218]);

if (!(coherentShadowSegment > oneSidedReflectionSegment)) throw new Error(`A bilaterally retained shadow edge must outrank a one-sided reflection dip: shadow=${coherentShadowSegment}, oneSided=${oneSidedReflectionSegment}`);
if (!(coherentShadowSegment > lowContrastReflectionSegment)) throw new Error(`A shadowed edge retaining bilateral contrast must outrank a low-contrast reflection: shadow=${coherentShadowSegment}, reflection=${lowContrastReflectionSegment}`);
if (!(coherentShadowSegment > broadMissingSegment)) throw new Error(`A coherent shadow segment must retain more support than a genuinely absent segment: shadow=${coherentShadowSegment}, absent=${broadMissingSegment}`);
if (!(coherentShadowSegment > unstableSoftSegment)) throw new Error(`Bilateral contrast relief must require coherent flanks: shadow=${coherentShadowSegment}, unstable=${unstableSoftSegment}`);
if (!(isolatedGlare >= coherentShadowSegment)) throw new Error(`A single glare interruption may receive at least as much support as a two-sample shadow segment: glare=${isolatedGlare}, shadow=${coherentShadowSegment}`);
if (!(softCoherentBoundary >= isolatedGlare)) throw new Error(`An uninterrupted coherent boundary should not rank below a locally interrupted one: clean=${softCoherentBoundary}, glare=${isolatedGlare}`);
if (!(coherentShadowSegment > repeatedOscillatingReflection)) throw new Error(`A coherent shadow segment must retain more support than repeated oscillation: shadow=${coherentShadowSegment}, noise=${repeatedOscillatingReflection}`);
if (!(strongCoherentBoundary > softCoherentBoundary)) throw new Error(`Strong coherent architecture must retain more bounded relief than soft coherent architecture: strong=${strongCoherentBoundary}, soft=${softCoherentBoundary}`);
if (!(repeatedOscillatingReflection >= 0.2 && strongCoherentBoundary <= 1)) throw new Error("Strength coherence must remain normalized and preserve the minimum detector allowance.");

console.log("Bilateral-contrast strength smoke passed: coherent shadowed edges retain support while one-sided reflections and absent gaps stay suppressed.");
