import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const statsType = `export type MaskCandidateStats = {
  total: number;
  returned: number;
  truncated: boolean;
};

let lastMaskCandidateStats: MaskCandidateStats = { total: 0, returned: 0, truncated: false };

export function getLastMaskCandidateStats(): MaskCandidateStats {
  return { ...lastMaskCandidateStats };
}

`;

if (!source.includes("export type MaskCandidateStats")) {
  const typeAnchor = "type FallbackComponent =";
  if (!source.includes(typeAnchor)) {
    throw new Error("Mask candidate type anchor not found");
  }
  source = source.replace(typeAnchor, `${statsType}${typeAnchor}`);
}

const oldFinal = `  const maxArchitecturalMasks = 16;
  const finalMasks = prioritizeArchitecturalOpenings(
    suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds),
    bounds
  ).slice(0, maxArchitecturalMasks);`;

const newFinal = `  const maxArchitecturalMasks = 16;
  const rankedMasks = prioritizeArchitecturalOpenings(
    suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds),
    bounds
  );
  const finalMasks = rankedMasks.slice(0, maxArchitecturalMasks);
  lastMaskCandidateStats = {
    total: rankedMasks.length,
    returned: finalMasks.length,
    truncated: rankedMasks.length > finalMasks.length
  };`;

if (source.includes("truncated: rankedMasks.length > finalMasks.length")) {
  console.log("Automatic mask truncation stats already applied.");
} else if (source.includes(oldFinal)) {
  source = source.replace(oldFinal, newFinal);
  await fs.writeFile(adapterPath, source);
  console.log("Automatic mask truncation stats ready.");
} else {
  throw new Error("Final architectural mask cap anchor not found");
}
