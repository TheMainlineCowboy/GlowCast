import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const oldReturn = "  return groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds).slice(0, 10);";
const newReturn = `  // Repeated windows, shutters, and door groups can legitimately exceed ten masks.
  // Preserve a larger reviewable set so valid architectural openings are not silently
  // discarded before the user can inspect or disable them.
  const maxArchitecturalMasks = 16;
  return groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds).slice(0, maxArchitecturalMasks);`;

if (source.includes(newReturn)) {
  console.log("expanded architectural mask preservation already applied");
  process.exit(0);
}

if (!source.includes(oldReturn)) {
  throw new Error("Unable to locate architectural mask result cap");
}

source = source.replace(oldReturn, newReturn);
await fs.writeFile(adapterPath, source);
console.log("expanded architectural mask preservation ready");
