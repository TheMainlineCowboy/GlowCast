import fs from "node:fs/promises";
import "./patch-adapter-clean-mask-outlines-v1.mjs";
import "./patch-adapter-suppress-isolated-mask-specks-v1.mjs";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fallbackGrowthRatio = fallbackArea / Math.max(existingArea, 1);";
const scaledBalanceMarker = "const maxExpansionImbalance = fallbackGrowthRatio > 1.45 ? 0.18 : 0.28;";
const balancedMarker = "const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;";
if (source.includes(marker) && source.includes(scaledBalanceMarker) && source.includes(balancedMarker)) {
  console.log("Fallback duplicate growth and growth-scaled balanced-expansion gates already applied.");
  process.exit(0);
}

const anchor = `      const preservesExistingFootprint = existingFootprintRetention >= 0.9;
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&
        preservesExistingFootprint &&`;

const replacement = `      const preservesExistingFootprint = existingFootprintRetention >= 0.9;
      const fallbackGrowthRatio = fallbackArea / Math.max(existingArea, 1);
      const boundedFallbackGrowth = fallbackGrowthRatio <= 1.8;
      const leftExpansion = Math.max(0, existing.box.x - box.x);
      const rightExpansion = Math.max(0, box.x + box.width - (existing.box.x + existing.box.width));
      const topExpansion = Math.max(0, existing.box.y - box.y);
      const bottomExpansion = Math.max(0, box.y + box.height - (existing.box.y + existing.box.height));
      const horizontalExpansionImbalance = Math.abs(leftExpansion - rightExpansion) / Math.max(existing.box.width, 1);
      const verticalExpansionImbalance = Math.abs(topExpansion - bottomExpansion) / Math.max(existing.box.height, 1);
      const maxExpansionImbalance = fallbackGrowthRatio > 1.45 ? 0.18 : 0.28;
      const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&
        preservesExistingFootprint &&
        boundedFallbackGrowth &&
        balancedFallbackExpansion &&`;

if (!source.includes(anchor)) {
  throw new Error("Fallback duplicate growth-cap anchor not found.");
}

source = source.replace(anchor, replacement);

if (
  !source.includes(marker) ||
  !source.includes("boundedFallbackGrowth &&") ||
  !source.includes(scaledBalanceMarker) ||
  !source.includes(balancedMarker) ||
  !source.includes("balancedFallbackExpansion &&")
) {
  throw new Error("Fallback duplicate growth and growth-scaled balanced-expansion gates were not applied.");
}

await fs.writeFile(path, source);
console.log("Prevented larger fallback repairs from using the same one-sided expansion tolerance as small repairs.");