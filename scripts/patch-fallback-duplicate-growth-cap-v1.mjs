import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const fallbackGrowthRatio = fallbackArea / Math.max(existingArea, 1);";
if (source.includes(marker)) {
  console.log("Fallback duplicate growth cap already applied.");
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
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&
        preservesExistingFootprint &&
        boundedFallbackGrowth &&`;

if (!source.includes(anchor)) {
  throw new Error("Fallback duplicate growth-cap anchor not found.");
}

source = source.replace(anchor, replacement);

if (!source.includes(marker) || !source.includes("boundedFallbackGrowth &&")) {
  throw new Error("Fallback duplicate growth cap was not applied.");
}

await fs.writeFile(path, source);
console.log("Prevented centered fallback components from excessively inflating a stronger architectural mask.");
