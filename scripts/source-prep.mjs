import fs from "node:fs/promises";

async function runPatch(path, { required = false } = {}) {
  try {
    await import(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (required) {
      throw new Error(`Required source prep patch failed: ${path}: ${message}`, { cause: error });
    }
    console.warn(`[source-prep] Optional patch skipped: ${path}: ${message}`);
  }
}

await runPatch("./patch-final-edge-flow.mjs", { required: true });
await runPatch("./patch-ui-regressions.mjs", { required: true });
await runPatch("./patch-start-surface-flow.mjs", { required: true });
await runPatch("./patch-detector-diagonal-connectivity-v1.mjs");
await runPatch("./patch-detector-thin-gap-closing-v1.mjs");
await runPatch("./patch-detector-closed-frame-ranking-v1.mjs", { required: true });
await runPatch("./patch-detector-outer-frame-preference-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-detect-imports-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-detect-masks-v1.mjs", { required: true });
await runPatch("./patch-fallback-closed-shape-gate-v1.mjs");
await runPatch("./patch-fallback-three-side-gate-v1.mjs");
await runPatch("./patch-adapter-diagnostics-v1.mjs");

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
