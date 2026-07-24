import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");
let changed = false;

const marker = "function suppressIsolatedMaskSpecks(";
if (!source.includes(marker)) {
  const cleanStart = source.indexOf("function cleanMaskCandidateOutlines(");
  if (cleanStart < 0) throw new Error("Clean mask outline helper must be applied before isolated-speck suppression");

  const helper = `function suppressIsolatedMaskSpecks(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  if (candidates.length < 2) return candidates;

  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const shortestSide = Math.max(Math.min(bounds.width, bounds.height), 1);
  const tinyAreaLimit = boundsArea * 0.0032;
  const tinySpanLimit = shortestSide * 0.095;
  const nearbyGapLimit = shortestSide * 0.035;

  return candidates.filter((candidate, index) => {
    const area = candidate.box.width * candidate.box.height;
    const isTiny =
      area < tinyAreaLimit &&
      candidate.box.width < tinySpanLimit &&
      candidate.box.height < tinySpanLimit;
    if (!isTiny) return true;

    const hasNearbyArchitecturalNeighbor = candidates.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const gap = gapBetween(candidate.box, other.box);
      return Math.hypot(gap.x, gap.y) <= nearbyGapLimit;
    });

    return hasNearbyArchitecturalNeighbor;
  });
}

`;

  source = source.slice(0, cleanStart) + helper + source.slice(cleanStart);
  changed = true;
}

const buildStart = source.indexOf("export function buildMaskCandidatesFromEdges(");
if (buildStart < 0) throw new Error("Unable to locate mask candidate builder");
const buildSource = source.slice(buildStart);
const returnMatches = [...buildSource.matchAll(/^  return (.+);$/gm)];
const finalReturn = returnMatches.at(-1);
if (!finalReturn || finalReturn.index === undefined) throw new Error("Unable to locate final cleaned mask candidate return pipeline");

const returnExpression = finalReturn[1];
if (!returnExpression.includes("suppressIsolatedMaskSpecks(")) {
  if (!returnExpression.includes("cleanMaskCandidateOutlines(")) {
    throw new Error("Expected outline cleanup to wrap the final mask candidate pipeline");
  }
  const absoluteReturnStart = buildStart + finalReturn.index;
  const originalReturn = finalReturn[0];
  const filteredReturn = `  return suppressIsolatedMaskSpecks(${returnExpression}, bounds);`;
  source = source.slice(0, absoluteReturnStart) + filteredReturn + source.slice(absoluteReturnStart + originalReturn.length);
  changed = true;
}

if (!source.includes(marker) || !source.includes("suppressIsolatedMaskSpecks(")) {
  throw new Error("Isolated-speck suppression helper and return wrapper were not both established");
}

if (changed) {
  await fs.writeFile(adapterPath, source);
  console.log("applied or repaired isolated automatic-mask speck suppression");
} else {
  console.log("isolated automatic-mask speck suppression already complete");
}
