import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const maxArchitecturalMasks = 16;";
if (source.includes(marker)) {
  console.log("expanded architectural mask preservation already applied");
  process.exit(0);
}

const oldCap = "  const finalMasks = prioritizeArchitecturalOpenings(suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds), bounds).slice(0, 10);";
const newCap = `  // Repeated windows, shutters, and door groups can legitimately exceed ten masks.
  // Preserve a larger reviewable set so valid architectural openings are not silently
  // discarded before the user can inspect or disable them.
  const maxArchitecturalMasks = 16;
  const finalMasks = prioritizeArchitecturalOpenings(
    suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds),
    bounds
  ).slice(0, maxArchitecturalMasks);`;

if (!source.includes(oldCap)) {
  throw new Error("Unable to locate filtered architectural mask result cap");
}

source = source.replace(oldCap, newCap);
await fs.writeFile(adapterPath, source);
console.log("expanded architectural mask preservation ready");
