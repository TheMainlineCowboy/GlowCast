import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const nestedFrameGrowthBound = fallbackGrowthRatio <= 1.6;";
if (source.includes(marker)) {
  console.log("Nested fallback frame selection already applied.");
  process.exit(0);
}

const anchor = `      const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;
      if (`;
const replacement = `      const balancedFallbackExpansion = horizontalExpansionImbalance <= maxExpansionImbalance && verticalExpansionImbalance <= maxExpansionImbalance;
      // When a fallback tightly surrounds an established architectural candidate, prefer
      // the existing inner opening unless the repair is still within the proven bounded
      // fragment-recovery range. This keeps inset window panes and door openings from
      // being replaced by a much larger outer trim frame.
      const fallbackContainsExisting = existingFootprintRetention >= 0.98;
      const nestedFrameGrowthBound = fallbackGrowthRatio <= 1.6;
      const preservesNestedProjectableSurface = !fallbackContainsExisting || nestedFrameGrowthBound;
      if (`;

if (!source.includes(anchor)) {
  throw new Error("Nested fallback selection anchor not found.");
}
source = source.replace(anchor, replacement);
source = source.replace(
  "        balancedFallbackExpansion &&\n        fallbackArea > existingArea * 1.12",
  "        balancedFallbackExpansion &&\n        preservesNestedProjectableSurface &&\n        fallbackArea > existingArea * 1.12"
);

if (!source.includes(marker) || !source.includes("preservesNestedProjectableSurface &&")) {
  throw new Error("Nested fallback frame selection was not applied.");
}

await fs.writeFile(path, source);
console.log("Preserved established inner openings when oversized nested fallback frames compete.");
