import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "function prioritizeArchitecturalOpenings(";
if (!source.includes(marker)) {
  const anchor = "function suppressNestedInteriorDetails(";
  const helper = `function prioritizeArchitecturalOpenings(\n  candidates: MaskCandidateOutput[],\n  bounds: SimpleBox\n): MaskCandidateOutput[] {\n  const boundsArea = Math.max(bounds.width * bounds.height, 1);\n\n  return candidates\n    .map((candidate, index) => {\n      const areaRatio = (candidate.box.width * candidate.box.height) / boundsArea;\n      const shortest = Math.max(Math.min(candidate.box.width, candidate.box.height), 0.01);\n      const longest = Math.max(candidate.box.width, candidate.box.height);\n      const balance = shortest / Math.max(longest, 0.01);\n      const architecturalScore = areaRatio * (0.78 + balance * 0.22);\n      return { candidate, index, architecturalScore };\n    })\n    .sort((a, b) => b.architecturalScore - a.architecturalScore || a.index - b.index)\n    .map(({ candidate }) => candidate);\n}\n\n`;

  if (!source.includes(anchor)) {
    throw new Error("nested suppression helper anchor not found");
  }
  source = source.replace(anchor, helper + anchor);
}

const diagnosticsReturn = "  const finalMasks = suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);";
const directReturn = "  return suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);";
const rankedDiagnosticsReturn = "  const finalMasks = prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10);";
const rankedDirectReturn = "  return prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10);";

if (source.includes(diagnosticsReturn)) {
  source = source.replace(diagnosticsReturn, rankedDiagnosticsReturn);
} else if (source.includes(directReturn)) {
  source = source.replace(directReturn, rankedDirectReturn);
} else if (!source.includes(rankedDiagnosticsReturn) && !source.includes(rankedDirectReturn)) {
  throw new Error("nested suppression output anchor not found");
}

await fs.writeFile(path, source);
console.log("architectural opening priority ready");
