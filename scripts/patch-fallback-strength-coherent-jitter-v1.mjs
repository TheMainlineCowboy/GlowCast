import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryGapGradientStrengthCoherence = bestRun.length";
if (source.includes(marker)) {
  console.log("Strength-coherent sparse jitter resistance already applied.");
  process.exit(0);
}

const directionalPattern = /(\s+const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas\.length\s*\n\s*\? 0\.4 \+ 0\.6 \* secondaryGapDirectionalConsistency\s*\n\s*: 0\.4;)/;
const directionalMatch = source.match(directionalPattern);
const samplingExpression = "secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance";

if (!directionalMatch || !source.includes(samplingExpression)) {
  throw new Error("Strength-coherent jitter anchors missing after direction-aware preparation.");
}

const indentation = directionalMatch[1].match(/\n(\s*)\?/)?.[1] ?? "           ";
const strengthBlock = `${directionalMatch[1]}\n${indentation}const secondaryGapGradientStrengthCoherence = bestRun.length\n${indentation}  ? (() => {\n${indentation}      const normalizedStrengths = bestRun.map((sample) => Math.max(0, Math.min(sample.strength, 255)) / 255);\n${indentation}      const adjacentStrengthChanges = normalizedStrengths.slice(1).map((strength, index) => Math.abs(strength - normalizedStrengths[index]));\n${indentation}      const sortedAdjacentChanges = [...adjacentStrengthChanges].sort((a, b) => a - b);\n${indentation}      const localizedInterruptionCount = sortedAdjacentChanges.length >= 4 ? 1 : 0;\n${indentation}      const stableAdjacentChanges = sortedAdjacentChanges.slice(0, Math.max(1, sortedAdjacentChanges.length - localizedInterruptionCount));\n${indentation}      const stableMeanAdjacentChange = stableAdjacentChanges.reduce((sum, change) => sum + change, 0) / Math.max(stableAdjacentChanges.length, 1);\n${indentation}      const strongestInterruption = sortedAdjacentChanges.at(-1) ?? 0;\n${indentation}      const continuity = 1 - Math.min(1, stableMeanAdjacentChange * 2.5);\n${indentation}      const localizedInterruptionRetention = 1 - Math.min(0.25, strongestInterruption * 0.35);\n${indentation}      return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity) * localizedInterruptionRetention));\n${indentation}    })()\n${indentation}  : 0.2;`;

source = source.replace(directionalPattern, strengthBlock).replace(
  samplingExpression,
  `${samplingExpression} * secondaryGapGradientStrengthCoherence`
);

if (
  !source.includes(marker) ||
  !source.includes("stableMeanAdjacentChange") ||
  !source.includes("localizedInterruptionRetention") ||
  !source.includes("secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence")
) {
  throw new Error("Segment-aware strength-coherent sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Bounded sparse-edge jitter relief by segment-aware local edge-strength coherence.");
