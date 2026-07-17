import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "const existingFootprintRetention = retainedExistingArea / Math.max(existingArea, 1);";
if (source.includes(marker)) {
  console.log("Fallback duplicate footprint-retention gate already applied.");
  process.exit(0);
}

const anchor = `      const centerConsistentFallback = normalizedCenterDrift <= 0.22;
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&`;

const replacement = `      const centerConsistentFallback = normalizedCenterDrift <= 0.22;
      const retainedExistingWidth = Math.max(
        0,
        Math.min(existing.box.x + existing.box.width, box.x + box.width) - Math.max(existing.box.x, box.x)
      );
      const retainedExistingHeight = Math.max(
        0,
        Math.min(existing.box.y + existing.box.height, box.y + box.height) - Math.max(existing.box.y, box.y)
      );
      const retainedExistingArea = retainedExistingWidth * retainedExistingHeight;
      const existingFootprintRetention = retainedExistingArea / Math.max(existingArea, 1);
      const preservesExistingFootprint = existingFootprintRetention >= 0.9;
      if (
        !extremeFallbackAspect &&
        shapeConsistentFallback &&
        centerConsistentFallback &&
        preservesExistingFootprint &&`;

if (!source.includes(anchor)) {
  throw new Error("Fallback duplicate footprint-retention anchor not found.");
}

source = source.replace(anchor, replacement);

if (!source.includes(marker) || !source.includes("preservesExistingFootprint &&")) {
  throw new Error("Fallback duplicate footprint-retention gate was not applied.");
}

await fs.writeFile(path, source);
console.log("Prevented fallback replacements from clipping a stronger architectural mask's footprint.");
