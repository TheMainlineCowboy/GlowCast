import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const secondaryGapGradientScaleAllowance = secondaryGapDeltas.length >= 3";
if (source.includes(marker)) {
  console.log("Length-aware, scale-aware jitter-tolerant smooth-perspective periodic-pattern resistance already applied.");
  process.exit(0);
}

const oldJitterBlock = `          const secondaryGapGradientJitterAllowance = secondaryGapDeltas.length >= 3
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
            : 0;`;

const scaleAwareJitterBlock = `          const secondaryGapGradientScaleAllowance = secondaryGapDeltas.length >= 3
            ? Math.min(2.5, Math.max(0.5, dimension * 0.004))
            : 0;
          const secondaryGapGradientJitterAllowance = secondaryGapDeltas.length >= 3
            ? Math.min(
                Math.max(secondaryGapGradientScaleAllowance, secondaryGapDeltaMagnitudeMean * 0.2),
                Math.max(secondaryGapGradientScaleAllowance, secondaryGapDeltaMagnitudeMean * 0.35)
              )
            : 0;
          const secondaryGapGradientResidualDeviation = secondaryGapDeltas.length >= 3
            ? Math.sqrt(
                Math.max(
                  0,
                  secondaryGapDeltaMagnitudeVariance -
                    Math.pow(secondaryGapGradientJitterAllowance, 2)
                )
              )
            : 0;`;

if (!source.includes(oldJitterBlock)) {
  throw new Error("Existing jitter-tolerant perspective block did not match the expected scale-aware upgrade shape.");
}
source = source.replace(oldJitterBlock, scaleAwareJitterBlock);

if (
  !source.includes(marker) ||
  !source.includes("Math.min(2.5, Math.max(0.5, dimension * 0.004))") ||
  !source.includes("Math.max(secondaryGapGradientScaleAllowance, secondaryGapDeltaMagnitudeMean * 0.35)") ||
  !source.includes("Math.pow(secondaryGapGradientJitterAllowance, 2)")
) {
  throw new Error("Scale-aware jitter tolerance was not applied.");
}

await fs.writeFile(path, source);
console.log("Scaled natural perspective-jitter tolerance to architectural side size while preserving strict bounds.");
