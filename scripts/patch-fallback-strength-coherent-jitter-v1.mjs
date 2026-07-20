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
const strengthBlock = `${directionalMatch[1]}\n${indentation}const secondaryGapGradientStrengthCoherence = bestRun.length\n${indentation}  ? (() => {\n${indentation}      const normalizedStrengths = bestRun.map((sample) => Math.max(0, Math.min(sample.strength, 255)) / 255);\n${indentation}      const repairedStrengths = [...normalizedStrengths];\n${indentation}      if (normalizedStrengths.length >= 6) {\n${indentation}        let interruptionIndex = -1;\n${indentation}        let interruptionScore = 0;\n${indentation}        for (let index = 2; index < normalizedStrengths.length - 2; index += 1) {\n${indentation}          const left = normalizedStrengths[index - 1];\n${indentation}          const current = normalizedStrengths[index];\n${indentation}          const right = normalizedStrengths[index + 1];\n${indentation}          const leftFlank = [normalizedStrengths[index - 2], left];\n${indentation}          const rightFlank = [right, normalizedStrengths[index + 2]];\n${indentation}          const leftFlankMean = (leftFlank[0] + leftFlank[1]) / 2;\n${indentation}          const rightFlankMean = (rightFlank[0] + rightFlank[1]) / 2;\n${indentation}          const flankInternalVariation = Math.max(\n${indentation}            Math.abs(leftFlank[0] - leftFlank[1]),\n${indentation}            Math.abs(rightFlank[0] - rightFlank[1])\n${indentation}          );\n${indentation}          const flankAgreement = Math.abs(leftFlankMean - rightFlankMean);\n${indentation}          const pairedJump = Math.min(Math.abs(current - leftFlankMean), Math.abs(current - rightFlankMean));\n${indentation}          if (flankInternalVariation <= 0.08 && flankAgreement <= 0.1 && pairedJump >= 0.18 && pairedJump > interruptionScore) {\n${indentation}            interruptionIndex = index;\n${indentation}            interruptionScore = pairedJump;\n${indentation}          }\n${indentation}        }\n${indentation}        if (interruptionIndex >= 0) {\n${indentation}          repairedStrengths[interruptionIndex] = (normalizedStrengths[interruptionIndex - 1] + normalizedStrengths[interruptionIndex + 1]) / 2;\n${indentation}        } else {\n${indentation}          for (let index = 2; index < normalizedStrengths.length - 3; index += 1) {\n${indentation}            const segment = [normalizedStrengths[index], normalizedStrengths[index + 1]];\n${indentation}            const leftFlank = [normalizedStrengths[index - 2], normalizedStrengths[index - 1]];\n${indentation}            const rightFlank = [normalizedStrengths[index + 2], normalizedStrengths[index + 3]];\n${indentation}            const leftFlankMean = (leftFlank[0] + leftFlank[1]) / 2;\n${indentation}            const rightFlankMean = (rightFlank[0] + rightFlank[1]) / 2;\n${indentation}            const flankMean = (leftFlankMean + rightFlankMean) / 2;\n${indentation}            const flankInternalVariation = Math.max(\n${indentation}              Math.abs(leftFlank[0] - leftFlank[1]),\n${indentation}              Math.abs(rightFlank[0] - rightFlank[1])\n${indentation}            );\n${indentation}            const segmentVariation = Math.abs(segment[0] - segment[1]);\n${indentation}            const segmentMean = (segment[0] + segment[1]) / 2;\n${indentation}            const segmentDip = flankMean - segmentMean;\n${indentation}            if (flankInternalVariation <= 0.08 && Math.abs(leftFlankMean - rightFlankMean) <= 0.1 && segmentVariation <= 0.06 && segmentMean >= 0.3 && segmentDip >= 0.1 && segmentDip <= 0.28) {\n${indentation}              repairedStrengths[index] = segment[0] + (flankMean - segment[0]) * 0.45;\n${indentation}              repairedStrengths[index + 1] = segment[1] + (flankMean - segment[1]) * 0.45;\n${indentation}              break;\n${indentation}            }\n${indentation}          }\n${indentation}        }\n${indentation}      }\n${indentation}      const adjacentStrengthChanges = repairedStrengths.slice(1).map((strength, index) => Math.abs(strength - repairedStrengths[index]));\n${indentation}      const meanAdjacentChange = adjacentStrengthChanges.reduce((sum, change) => sum + change, 0) / Math.max(adjacentStrengthChanges.length, 1);\n${indentation}      const continuity = 1 - Math.min(1, meanAdjacentChange * 2.5);\n${indentation}      return Math.max(0.2, Math.min(1, robustStrength * (0.55 + 0.45 * continuity)));\n${indentation}    })()\n${indentation}  : 0.2;`;

source = source.replace(directionalPattern, strengthBlock).replace(
  samplingExpression,
  `${samplingExpression} * secondaryGapGradientStrengthCoherence`
);

if (
  !source.includes(marker) ||
  !source.includes("segmentMean >= 0.3") ||
  !source.includes("segmentDip <= 0.28") ||
  !source.includes("secondaryGapGradientDirectionalAllowance * secondaryGapGradientStrengthCoherence")
) {
  throw new Error("Segment-aware strength-coherent sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Preserved one coherent soft edge segment while rejecting broad absent gaps.");
