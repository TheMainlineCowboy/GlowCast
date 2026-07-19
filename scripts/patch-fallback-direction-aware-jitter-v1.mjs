import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas.length";
if (source.includes(marker)) {
  console.log("Direction-aware sparse jitter resistance already applied.");
  process.exit(0);
}

const samplingPattern = /(\s+const secondaryGapGradientSamplingAllowance = dominantGapCandidate\s*\n\s*\? Math\.min\(1\.25, Math\.max\(0, denseMedianSpacing \* 0\.12\)\)\s*\n\s*: 0;)/;
const samplingMatch = source.match(samplingPattern);
const scalePattern = /Math\.max\(0\.5, dimension \* 0\.003 \+ secondaryGapGradientSamplingAllowance\)/;

if (!samplingMatch || !scalePattern.test(source)) {
  throw new Error("Direction-aware sparse jitter anchors missing after cluster preparation.");
}

const indentation = samplingMatch[1].match(/\n(\s*)\?/)?.[1] ?? "           ";
const directionalBlock = `${samplingMatch[1]}\n${indentation}const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas.length\n${indentation}  ? 0.4 + 0.6 * secondaryGapDirectionalConsistency\n${indentation}  : 0.4;`;

source = source.replace(samplingPattern, directionalBlock).replace(
  scalePattern,
  `Math.max(\n${indentation}  0.5,\n${indentation}  dimension * 0.003 +\n${indentation}    secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance\n${indentation})`
);

if (
  !source.includes(marker) ||
  !source.includes("secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance")
) {
  throw new Error("Direction-aware sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Bounded sparse-edge jitter relief by directional consistency.");
