import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "function suppressNestedInteriorDetails(";
if (!source.includes(marker)) {
  const anchor = "export function buildMaskCandidatesFromEdges(";
  const helper = `function suppressNestedInteriorDetails(\n  candidates: MaskCandidateOutput[],\n  bounds: SimpleBox\n): MaskCandidateOutput[] {\n  const boundsArea = Math.max(bounds.width * bounds.height, 1);\n\n  return candidates.filter((candidate, candidateIndex) => {\n    const candidateArea = candidate.box.width * candidate.box.height;\n    if (candidateArea > boundsArea * 0.14) return true;\n\n    return !candidates.some((outer, outerIndex) => {\n      if (candidateIndex === outerIndex) return false;\n\n      const outerArea = outer.box.width * outer.box.height;\n      if (outerArea < candidateArea * 1.7) return false;\n      if (outer.box.width < candidate.box.width * 1.16 || outer.box.height < candidate.box.height * 1.16) return false;\n\n      const insetToleranceX = Math.max(0.8, bounds.width * 0.008);\n      const insetToleranceY = Math.max(0.8, bounds.height * 0.008);\n      const fullyNested =\n        candidate.box.x >= outer.box.x - insetToleranceX &&\n        candidate.box.y >= outer.box.y - insetToleranceY &&\n        candidate.box.x + candidate.box.width <= outer.box.x + outer.box.width + insetToleranceX &&\n        candidate.box.y + candidate.box.height <= outer.box.y + outer.box.height + insetToleranceY;\n\n      if (!fullyNested) return false;\n\n      const horizontalInset = Math.min(\n        candidate.box.x - outer.box.x,\n        outer.box.x + outer.box.width - (candidate.box.x + candidate.box.width)\n      );\n      const verticalInset = Math.min(\n        candidate.box.y - outer.box.y,\n        outer.box.y + outer.box.height - (candidate.box.y + candidate.box.height)\n      );\n\n      // Only collapse true interior trim/panes. Side-by-side repeated openings and\n      // candidates that merely overlap an outer frame remain independent masks.\n      return horizontalInset >= -insetToleranceX && verticalInset >= -insetToleranceY;\n    });\n  });\n}\n\n`;

  if (!source.includes(anchor)) {
    throw new Error("mask candidate adapter export anchor not found");
  }
  source = source.replace(anchor, helper + anchor);
}

const diagnosticsReturn = "  const finalMasks = grouped.slice(0, 10);";
const directReturn = "  return groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds).slice(0, 10);";
const nestedDiagnosticsReturn = "  const finalMasks = suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);";

if (source.includes(diagnosticsReturn)) {
  source = source.replace(diagnosticsReturn, nestedDiagnosticsReturn);
} else if (source.includes(directReturn)) {
  source = source.replace(
    directReturn,
    `  const grouped = groupNearbySatellites(addFallbackCandidates(accepted, edgePoints, bounds), bounds);\n  return suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);`
  );
} else if (!source.includes(nestedDiagnosticsReturn) && !source.includes("return suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);")) {
  throw new Error("mask candidate adapter return anchor not found");
}

await fs.writeFile(path, source);
console.log("nested interior mask suppression ready");
