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
const strengthBlock = `${directionalMatch[1]}\n${indentation}const secondaryGapGradientStrengthCoherence = bestRun.length\n${indentation}  ? (() => {\n${indentation}      const normalizedStrengths = bestRun.map((sample) => Math.max(0, Math.min(sample.strength, 255)) / 255);\n${indentation}      const repairedStrengths = [...normalizedStrengths];\n${indentation}      if (normalizedStrengths.length >= 5) {\n${indentation}        let interruptionIndex = -1;\n${indentation}        let interruptionScore = 0;\n${indentation}        for (let index = 1; index < normalizedStrengths.length - 1; index += 1) {\n${indentation}          const left = normalizedStrengths[index - 1];\n${indentation}          const current = normalizedStrengths[index];\n${indentation}          const right = normalizedStrengths[index + 1];\n${indentation}          const neighborAgreement = Math.abs(left - right);\n${indentation}          const pairedJump = Math.min(Math.abs(current - left), Math.abs(current - right));\n${indentation}          if (neighborAgreement <= 0.08 && pairedJump >= 0.18 && pairedJump > interruptionScore) {\n${indentation}            interruptionIndex = index;\n${indentation}            interruptionScore = pairedJump;\n${indentation}          }\n${indentation}        }\n${indentation}        if (interruptionIndex >= 0) {\n${indentation}          repairedStrengths[interruptionIndex] = (normalizedStrengths[interruptionIndex - 1] + normalizedStrengths[interruptionIndex + 1]) / 2;\n${indentation}        }\n${indentation}      }\n${indentation}      const adjacentStrengthChanges = repairedStrengths.slice(1).map((strength, index) => Math.abs(strength - repairedStrengths[index]));\n${indentation}      const meanAdjacentChange = adjacentStrengthChanges.reduce((sum, change) => sum + change, 0) / Math.max(adjacentStrengthChanges.length, 1);\n${indentation}      const continuity = 1 - Math.min(1, meanAdjacentChange * 2.5);\n${indentation}      return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity)));\n${indentation}    })()\n${indentation}  : 0.2;`;

source = source.replace(directionalPattern, strengthBlock).replace(
  samplingExpression,
  `${samplingExpression} * secondaryGapGradientStrengthCoherence`
);

if (
  !source.includes(marker) ||
  !source.includes("neighborAgreement <= 0.08") ||
  !source.includes("pairedJump >= 0.18") ||
  !source.includes("secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence")
) {
  throw new Error("Segment-aware strength-coherent sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Bounded sparse-edge jitter relief by localized segment-aware edge-strength coherence.");
