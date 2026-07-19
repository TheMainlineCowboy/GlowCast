import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryClusterPatternPenalty = dominantGapCandidate";
if (source.includes(marker)) {
  console.log("Length-aware, periodic-pattern-resistant secondary spacing-cluster authority already applied.");
  process.exit(0);
}

const anchor = `          const secondaryClusterAuthority = dominantGapCandidate
            ? Math.min(1, dominantGapCandidate.upperCount / Math.max(dominantGapCandidate.lowerCount, 1)) * Math.sqrt(secondaryClusterDistribution)
            : 0;`;

if (!source.includes(anchor)) {
  throw new Error("Length-aware cluster authority anchor missing after edge-strength preparation.");
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
          const secondaryClusterPatternPenalty = dominantGapCandidate
            ? 1 - 0.4 * secondaryPatternRegularity
            : 1;
          const secondaryClusterAuthority = dominantGapCandidate
            ? Math.min(1, dominantGapCandidate.upperCount / Math.max(dominantGapCandidate.lowerCount, 1)) *
              Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *
              secondaryClusterPatternPenalty
            : 0;`;

source = source.replace(anchor, replacement);

if (
  !source.includes(marker) ||
  !source.includes("secondaryClusterSpan / Math.max(dimension * 0.35, 1)") ||
  !source.includes("const secondaryPatternRegularity = secondaryIndexGaps.length >= 3") ||
  !source.includes("1 - 0.4 * secondaryPatternRegularity") ||
  !source.includes("Math.sqrt(secondaryClusterDistribution * secondaryClusterLengthSupport) *")
) {
  throw new Error("Length-aware, periodic-pattern-resistant spacing-cluster authority was not applied.");
}

await fs.writeFile(path, source);
console.log("Weighted secondary spacing-cluster authority by represented architectural length while suppressing periodic decorative patterns.");
