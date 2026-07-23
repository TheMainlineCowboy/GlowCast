import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function suppressIsolatedMaskSpecks(";
if (source.includes(marker)) {
  console.log("isolated mask speck suppression patch already applied");
  process.exit(0);
}

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

const returnAnchor = "  return candidates.map((candidate) => ({\n    ...candidate,\n    points: cleanMaskOutline(candidate.points, candidate.box, bounds)\n  }));";
const replacement = "  const cleaned = candidates.map((candidate) => ({\n    ...candidate,\n    points: cleanMaskOutline(candidate.points, candidate.box, bounds)\n  }));\n  return suppressIsolatedMaskSpecks(cleaned, bounds);";

if (!source.includes(returnAnchor)) {
  throw new Error("Unable to locate cleaned mask candidate return pipeline");
}

source = source.replace(returnAnchor, replacement);

await fs.writeFile(adapterPath, source);
console.log("applied isolated automatic-mask speck suppression");
