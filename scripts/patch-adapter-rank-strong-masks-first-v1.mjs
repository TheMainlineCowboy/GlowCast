import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "function rankArchitecturalMasks(";
if (source.includes(marker)) {
  console.log("architectural mask ranking patch already applied");
  process.exit(0);
}

const insertAt = source.indexOf("function suppressIsolatedMaskSpecks(");
if (insertAt < 0) {
  throw new Error("Isolated-speck suppression must be applied before architectural mask ranking");
}

const helper = `function polygonArea(points: SimplePoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function rankArchitecturalMasks(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  const boundsArea = Math.max(bounds.width * bounds.height, 1);

  return [...candidates].sort((a, b) => {
    const score = (candidate: MaskCandidateOutput) => {
      const boxArea = Math.max(candidate.box.width * candidate.box.height, 1);
      const areaRatio = boxArea / boundsArea;
      const sizeScore = Math.min(1, areaRatio / 0.045);
      const fillRatio = Math.min(1, polygonArea(candidate.points) / boxArea);
      const aspect = candidate.box.width / Math.max(candidate.box.height, 0.01);
      const aspectScore = aspect >= 0.28 && aspect <= 3.8 ? 1 : aspect >= 0.18 && aspect <= 5.2 ? 0.55 : 0.1;
      const cornerScore = candidate.points.length >= 4 && candidate.points.length <= 10 ? 1 : 0.65;
      return fillRatio * 0.42 + sizeScore * 0.33 + aspectScore * 0.17 + cornerScore * 0.08;
    };

    const scoreDelta = score(b) - score(a);
    if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
    if (a.box.y !== b.box.y) return a.box.y - b.box.y;
    return a.box.x - b.box.x;
  });
}

`;

source = source.slice(0, insertAt) + helper + source.slice(insertAt);

const buildStart = source.indexOf("export function buildMaskCandidatesFromEdges(");
if (buildStart < 0) throw new Error("Unable to locate mask candidate builder");

const buildSource = source.slice(buildStart);
const returnMatches = [...buildSource.matchAll(/^  return (.+);$/gm)];
const finalReturn = returnMatches.at(-1);
if (!finalReturn || finalReturn.index === undefined) {
  throw new Error("Unable to locate final mask candidate return pipeline");
}

const returnExpression = finalReturn[1];
if (!returnExpression.includes("suppressIsolatedMaskSpecks(")) {
  throw new Error("Expected isolated-speck suppression to wrap the final mask pipeline");
}

const absoluteReturnStart = buildStart + finalReturn.index;
const originalReturn = finalReturn[0];
const rankedReturn = `  return rankArchitecturalMasks(${returnExpression}, bounds);`;
source = source.slice(0, absoluteReturnStart) + rankedReturn + source.slice(absoluteReturnStart + originalReturn.length);

await fs.writeFile(adapterPath, source);
console.log("ranked strongest architectural masks first");
