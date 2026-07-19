import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryGapGradientJitterAllowance = secondaryGapDeltas.length >= 3";
if (source.includes(marker)) {
  console.log("Length-aware, jitter-tolerant smooth-perspective periodic-pattern resistance already applied.");
  process.exit(0);
}

const anchor = `          const secondaryClusterAuthority = dominantGapCandidate
             ? Math.min(1, dominantGapCandidate.upperCount / Math.max(dominantGapCandidate.lowerCount, 1)) * Math.sqrt(secondaryClusterDistribution)
             : 0;`;

if (!source.includes(anchor)) {
  throw new Error("Jitter-tolerant smooth perspective pattern-resistance anchor missing after edge-strength preparation.");
}

const replacement = `          const secondaryClusterSpan = dominantGapCandidate && secondaryGapIndices.length > 1
             ? Math.max(
                 0,
                 bestRun[secondaryGapIndices[secondaryGapIndices.length - 1] + 1].position -
                   bestRun[secondaryGapIndices[0]].position
               )
             : 0;
           const secondaryClusterLengthSupport = dominantGapCandidate
             ? Math.min(1, secondaryClusterSpan / Math.max(dimension * 0.35, 1))
             : 0;
           const secondaryIndexGaps = secondaryGapIndices
             .slice(1)
             .map((index, gapIndex) => index - secondaryGapIndices[gapIndex]);
           const secondaryIndexGapMean = secondaryIndexGaps.length
             ? secondaryIndexGaps.reduce((sum, gap) => sum + gap, 0) / secondaryIndexGaps.length
             : 0;
           const secondaryIndexGapVariance = secondaryIndexGaps.length >= 3
             ? secondaryIndexGaps.reduce((sum, gap) => sum + Math.pow(gap - secondaryIndexGapMean, 2), 0) / secondaryIndexGaps.length
             : 0;
           const secondaryPatternRegularity = secondaryIndexGaps.length >= 3
             ? Math.max(0, 1 - Math.sqrt(secondaryIndexGapVariance) / Math.max(secondaryIndexGapMean * 0.45, 0.5))
             : 0;
           const secondaryGapValues = secondaryGapIndices.map((index) => orderedGaps[index]);
           const secondaryGapDeltas = secondaryGapValues
             .slice(1)
             .map((gap, gapIndex) => gap - secondaryGapValues[gapIndex]);
           const secondaryGapDirection = secondaryGapDeltas.reduce(
             (sum, delta) => sum + (Math.abs(delta) < 0.25 ? 0 : Math.sign(delta)),
             0
           );
           const secondaryGapDirectionalConsistency = secondaryGapDeltas.length
             ? Math.abs(secondaryGapDirection) / secondaryGapDeltas.length
             : 0;
           const secondaryGapDeltaMagnitudeMean = secondaryGapDeltas.length
             ? secondaryGapDeltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / secondaryGapDeltas.length
             : 0;
           const secondaryGapDeltaMagnitudeVariance = secondaryGapDeltas.length >= 3
             ? secondaryGapDeltas.reduce(
                 (sum, delta) => sum + Math.pow(Math.abs(delta) - secondaryGapDeltaMagnitudeMean, 2),
                 0
               ) / secondaryGapDeltas.length
             : 0;
           const secondaryGapGradientJitterAllowance = secondaryGapDeltas.length >= 3
             ? Math.max(0.75, secondaryGapDeltaMagnitudeMean * 0.2)
             : 0;
           const secondaryGapGradientResidualDeviation = secondaryGapDeltas.length >= 3
             ? Math.sqrt(
                 Math.max(
                   0,
                   secondaryGapDeltaMagnitudeVariance -
                     Math.pow(secondaryGapGradientJitterAllowance, 2)
                 )
               )
             : 0;
           const secondaryGapGradientSmoothness = secondaryGapDeltas.length >= 3
             ? Math.max(
                 0,
                 1 - secondaryGapGradientResidualDeviation /
                   Math.max(secondaryGapDeltaMagnitudeMean * 0.75, 0.5)
               )
             : 0;
           const secondaryGapRangeRatio = secondaryGapValues.length
             ? (Math.max(...secondaryGapValues) - Math.min(...secondaryGapValues)) /
               Math.max(secondaryGapValues.reduce((sum, gap) => sum + gap, 0) / secondaryGapValues.length, 1)
             : 0;
           const secondaryPerspectiveGradientSupport = secondaryGapValues.length >= 4
             ? Math.min(
                 1,
                 secondaryGapDirectionalConsistency * secondaryGapGradientSmoothness * secondaryGapRangeRatio * 2.5
               )
             : 0;
           const adjustedSecondaryPatternRegularity = secondaryPatternRegularity *
             (1 - 0.65 * secondaryPerspectiveGradientSupport);
           const secondaryClusterPatternPenalty = dominantGapCandidate
             ? 1 - 0.4 * adjustedSecondaryPatternRegularity
             : 1;
           const secondaryClusterAuthority = dominantGapCandidate
             ? Math.min(1, dominantGapCandidate.upperCount / Math.max(dominantGapCandidate.lowerCount, 1)) *
               Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *
               secondaryClusterPatternPenalty
             : 0;`;

source = source.replace(anchor, replacement);

if (
  !source.includes(marker) ||
  !source.includes("const secondaryGapGradientResidualDeviation = secondaryGapDeltas.length >= 3") ||
  !source.includes("secondaryGapDeltaMagnitudeVariance -") ||
  !source.includes("Math.pow(secondaryGapGradientJitterAllowance, 2)") ||
  !source.includes("secondaryGapDirectionalConsistency * secondaryGapGradientSmoothness * secondaryGapRangeRatio * 2.5")
) {
  throw new Error("Jitter-tolerant smooth perspective-aware periodic-pattern resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Preserved naturally jittered perspective gradients while continuing to suppress abrupt stepped decorative patterns.");
