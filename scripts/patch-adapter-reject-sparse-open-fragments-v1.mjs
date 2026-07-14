import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "function suppressWeakOpenFragments(";
if (!source.includes(marker)) {
  const anchor = "function prioritizeArchitecturalOpenings(";
  const helper = `function suppressWeakOpenFragments(\n  candidates: MaskCandidateOutput[],\n  bounds: SimpleBox\n): MaskCandidateOutput[] {\n  const boundsArea = Math.max(bounds.width * bounds.height, 1);\n\n  return candidates.filter((candidate) => {\n    const areaRatio = (candidate.box.width * candidate.box.height) / boundsArea;\n    const outlineFill = polygonAreaRatio(candidate.points, candidate.box);\n    // Very sparse small polygons are usually diagonal/open edge fragments. Larger\n    // irregular architectural features remain available for ranking.\n    return outlineFill >= 0.28 || areaRatio >= 0.12;\n  });\n}\n\n`;

  if (!source.includes(anchor)) {
    throw new Error("architectural priority helper anchor not found");
  }
  source = source.replace(anchor, helper + anchor);
}

const rankedDiagnosticsReturn = "  const finalMasks = prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10);";
const rankedDirectReturn = "  return prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10);";
const filteredDiagnosticsReturn = "  const finalMasks = prioritizeArchitecturalOpenings(suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds), bounds).slice(0, 10);";
const filteredDirectReturn = "  return prioritizeArchitecturalOpenings(suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds), bounds).slice(0, 10);";

if (source.includes(rankedDiagnosticsReturn)) {
  source = source.replace(rankedDiagnosticsReturn, filteredDiagnosticsReturn);
} else if (source.includes(rankedDirectReturn)) {
  source = source.replace(rankedDirectReturn, filteredDirectReturn);
} else if (!source.includes(filteredDiagnosticsReturn) && !source.includes(filteredDirectReturn)) {
  throw new Error("architectural ranking output anchor not found");
}

await fs.writeFile(path, source);
console.log("sparse open-fragment rejection ready");
