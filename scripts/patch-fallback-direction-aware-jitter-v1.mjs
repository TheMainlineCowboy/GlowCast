import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas.length";
if (source.includes(marker)) {
  console.log("Direction-aware sparse jitter resistance already applied.");
  process.exit(0);
}

const samplingAnchor = `           const secondaryGapGradientSamplingAllowance = dominantGapCandidate
             ? Math.min(1.25, Math.max(0, denseMedianSpacing * 0.12))
             : 0;`;
const samplingReplacement = `${samplingAnchor}
           const secondaryGapGradientDirectionalAllowance = secondaryGapDeltas.length
             ? 0.4 + 0.6 * secondaryGapDirectionalConsistency
             : 0.4;`;

const scaleAnchor = "Math.max(0.5, dimension * 0.003 + secondaryGapGradientSamplingAllowance)";
const scaleReplacement = `Math.max(
                   0.5,
                   dimension * 0.003 +
                     secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance
                 )`;

if (!source.includes(samplingAnchor) || !source.includes(scaleAnchor)) {
  throw new Error("Direction-aware sparse jitter anchors missing after cluster preparation.");
}

source = source.replace(samplingAnchor, samplingReplacement).replace(scaleAnchor, scaleReplacement);

if (
  !source.includes(marker) ||
  !source.includes("secondaryGapGradientSamplingAllowance * secondaryGapGradientDirectionalAllowance")
) {
  throw new Error("Direction-aware sparse jitter resistance was not applied.");
}

await fs.writeFile(path, source);
console.log("Bounded sparse-edge jitter relief by directional consistency.");
