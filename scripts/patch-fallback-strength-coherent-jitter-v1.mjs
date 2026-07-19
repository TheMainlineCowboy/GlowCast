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
const strengthBlock = `${directionalMatch[1]}\n${indentation}const secondaryGapGradientStrengthCoherence = bestRun.length\n${indentation}  ? (() => {\n${indentation}      const normalizedStrengths = bestRun.map((sample) => Math.max(0, Math.min(sample.strength, 255)) / 255);\n${indentation}      const adjacentStrengthChanges = normalizedStrengths.slice(1).map((strength, index) => Math.abs(strength - normalizedStrengths[index]));\n${indentation}      const meanAdjacentChange = adjacentStrengthChanges.reduce((sum, change) => sum + change, 0) / Math.max(adjacentStrengthChanges.length, 1);\n${indentation}      const continuity = 1 - Math.min(1, meanAdjacentChange * 2.5);\n${indentation}      return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity)));\n${indentation}    })()\n${indentation}  : 0.2;`;

source = source.replace(directionalPattern, strengthBlock).replace(
  samplingExpression,
  `${samplingExpression} * secondaryGapGradientStrengthCoherence`
);

if (
  !source.includes(marker) ||
  !source.includes("robustStrength * (0.55 + 0.45 * continuity)") ||
  !source.includes("secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence")
) {
  throw new Error("Strength-coherent sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Bounded sparse-edge jitter relief by local edge-strength coherence.");
