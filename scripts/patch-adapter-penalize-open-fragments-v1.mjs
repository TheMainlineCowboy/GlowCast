import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const helperMarker = "function polygonAreaRatio(";
if (!source.includes(helperMarker)) {
  const anchor = "function prioritizeArchitecturalOpenings(";
  const helper = `function polygonAreaRatio(points: SimplePoint[], box: SimpleBox): number {\n  if (points.length < 3) return 1;\n\n  let twiceArea = 0;\n  for (let index = 0; index < points.length; index += 1) {\n    const current = points[index];\n    const next = points[(index + 1) % points.length];\n    twiceArea += current.x * next.y - next.x * current.y;\n  }\n\n  const polygonArea = Math.abs(twiceArea) / 2;\n  const boxArea = Math.max(box.width * box.height, 1);\n  return Math.max(0, Math.min(1, polygonArea / boxArea));\n}\n\n`;

  if (!source.includes(anchor)) {
    throw new Error("architectural priority helper anchor not found");
  }
  source = source.replace(anchor, helper + anchor);
}

const oldScore = `      const looksLikeThinTrim = balance < 0.14 && areaRatio < 0.08;\n      const trimPenalty = looksLikeThinTrim ? 0.45 : 1;\n      const architecturalScore = areaRatio * (0.78 + balance * 0.22) * trimPenalty;`;
const newScore = `      const looksLikeThinTrim = balance < 0.14 && areaRatio < 0.08;\n      const trimPenalty = looksLikeThinTrim ? 0.45 : 1;\n      const outlineFill = polygonAreaRatio(candidate.points, candidate.box);\n      // Clean rectangles score at 1. Arches and mildly irregular openings retain most\n      // of their weight, while sparse diagonal/open fragments lose priority.\n      const closurePenalty = outlineFill >= 0.72 ? 1 : outlineFill >= 0.48 ? 0.82 : 0.5;\n      const architecturalScore = areaRatio * (0.78 + balance * 0.22) * trimPenalty * closurePenalty;`;

if (source.includes(oldScore)) {
  source = source.replace(oldScore, newScore);
} else if (!source.includes("const closurePenalty = outlineFill >= 0.72")) {
  throw new Error("architectural score anchor not found");
}

await fs.writeFile(path, source);
console.log("open-fragment outline penalty ready");
