import fs from "node:fs/promises";

await import("./patch-final-edge-flow.mjs");
await import("./patch-ui-regressions.mjs");
await import("./patch-start-surface-flow.mjs");
await import("./patch-detector-diagonal-connectivity-v1.mjs");
await import("./patch-detector-thin-gap-closing-v1.mjs");
await import("./patch-ui-auto-detect-masks-v1.mjs");
await import("./patch-fallback-closed-shape-gate-v1.mjs");

const edgePath = "src/edgeDetect.ts";
let edge = await fs.readFile(edgePath, "utf8");

if (!edge.includes("maskCandidateAdapter")) {
  edge = edge.replace(
    "export type EdgePoint",
    "import { buildMaskCandidatesFromEdges } from \"./core/maskCandidateAdapter\";\n\nexport type EdgePoint"
  );
}

const replacement = `
export function generateAutoMasks(
  edgePoints: EdgePoint[],
  projectionZone: ProjectionZone,
  _options: AutoMaskOptions = { clusterRadius: 1.8, minPoints: 14, tolerance: 0.8 }
): AutoMaskZone[] {
  const candidates = buildMaskCandidatesFromEdges(edgePoints, projectionZone);
  return candidates.map((candidate, index) => ({
    id: "auto_mask_architectural_" + Date.now() + "_" + index,
    type: "auto-generated",
    shape: "polygon",
    points: candidate.points,
    boundingBox: {
      x: Number(candidate.box.x.toFixed(2)),
      y: Number(candidate.box.y.toFixed(2)),
      width: Number(candidate.box.width.toFixed(2)),
      height: Number(candidate.box.height.toFixed(2))
    },
    enabled: true
  }));
}

`;

const marker = "export function drawProjectionWithMasks";
const start = edge.indexOf("export function generateAutoMasks(");
const end = edge.indexOf(marker);
if (start >= 0 && end > start) {
  edge = edge.slice(0, start) + replacement + edge.slice(end);
}

await fs.writeFile(edgePath, edge);
console.log("source prep complete");