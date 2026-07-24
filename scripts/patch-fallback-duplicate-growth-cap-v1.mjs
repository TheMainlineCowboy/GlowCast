import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fallbackGrowthRatio = fallbackArea / Math.max(existingArea, 1);";
const scaledBalanceMarker = "const maxExpansionImbalance = fallbackGrowthRatio > 1.45 ? 0.18 : 0.28;";
const balancedMarker = "const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;";

if (source.includes(marker) && source.includes(scaledBalanceMarker) && source.includes(balancedMarker)) {
  console.log("Fallback duplicate growth and growth-scaled balanced-expansion gates already applied.");
} else {
  const stableAnchor = "      const preservesExistingFootprint = existingFootprintRetention >= 0.9;";
  const anchorIndex = source.indexOf(stableAnchor);
  if (anchorIndex < 0) {
    throw new Error("Fallback duplicate growth-cap footprint anchor not found.");
  }

  const declarations = `${stableAnchor}
      const fallbackGrowthRatio = fallbackArea / Math.max(existingArea, 1);
      const boundedFallbackGrowth = fallbackGrowthRatio <= 1.8;
      const leftExpansion = Math.max(0, existing.box.x - box.x);
      const rightExpansion = Math.max(0, box.x + box.width - (existing.box.x + existing.box.width));
      const topExpansion = Math.max(0, existing.box.y - box.y);
      const bottomExpansion = Math.max(0, box.y + box.height - (existing.box.y + existing.box.height));
      const horizontalExpansionImbalance = Math.abs(leftExpansion - rightExpansion) / Math.max(existing.box.width, 1);
      const verticalExpansionImbalance = Math.abs(topExpansion - bottomExpansion) / Math.max(existing.box.height, 1);
      const maxExpansionImbalance = fallbackGrowthRatio > 1.45 ? 0.18 : 0.28;
      const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;`;

  source = source.slice(0, anchorIndex) + declarations + source.slice(anchorIndex + stableAnchor.length);

  const gateSearchStart = anchorIndex + declarations.length;
  const gateMarker = "        preservesExistingFootprint &&";
  const gateIndex = source.indexOf(gateMarker, gateSearchStart);
  if (gateIndex < 0) {
    throw new Error("Fallback duplicate growth-cap decision gate not found after footprint anchor.");
  }

  const strengthenedGate = `${gateMarker}
        boundedFallbackGrowth &&
        balancedFallbackExpansion &&`;
  source = source.slice(0, gateIndex) + strengthenedGate + source.slice(gateIndex + gateMarker.length);

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
}
