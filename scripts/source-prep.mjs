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
await runPatch("./patch-detector-nested-detail-selection-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-detect-imports-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-detect-masks-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-detect-safety-copy-v1.mjs", { required: true });
await runPatch("./patch-ui-friendly-detection-summary-v1.mjs", { required: true });
await runPatch("./patch-fallback-closed-shape-gate-v1.mjs");
await runPatch("./patch-fallback-three-side-gate-v1.mjs");
await runPatch("./patch-fallback-boundary-closure-v1.mjs", { required: true });
await runPatch("./patch-fallback-full-span-border-rejection-v1.mjs", { required: true });
await runPatch("./patch-fallback-side-tolerance-scaling-v1.mjs", { required: true });
await runPatch("./smoke-fallback-side-tolerance-runtime.mjs", { required: true });
await runPatch("./patch-adapter-diagnostics-v1.mjs");
await runPatch("./patch-adapter-aligned-satellites-v1.mjs", { required: true });
await runPatch("./patch-adapter-bounded-satellite-span-v1.mjs", { required: true });
await runPatch("./patch-adapter-bounded-satellite-growth-v1.mjs", { required: true });
await runPatch("./patch-adapter-preserve-repeated-openings-v1.mjs", { required: true });
await runPatch("./patch-adapter-trim-like-satellites-v1.mjs", { required: true });
await runPatch("./patch-adapter-nearest-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-adapter-span-aware-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-adapter-overlap-aware-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-smoke-overlap-aware-stacked-trim-v1.mjs", { required: true });
await runPatch("./patch-adapter-anchor-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-smoke-anchored-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-adapter-suppress-overlapping-duplicates-v1.mjs", { required: true });
await runPatch("./patch-adapter-suppress-nested-interior-v1.mjs", { required: true });
await runPatch("./patch-adapter-prioritize-architectural-openings-v1.mjs", { required: true });
await runPatch("./patch-adapter-penalize-open-fragments-v1.mjs", { required: true });
await runPatch("./patch-adapter-reject-sparse-open-fragments-v1.mjs", { required: true });
await runPatch("./patch-adapter-reject-corner-touching-satellites-v1.mjs", { required: true });
await runPatch("./patch-adapter-reject-negligible-satellites-v1.mjs", { required: true });
await runPatch("./patch-adapter-prefer-strongest-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-adapter-bound-cumulative-satellite-growth-v1.mjs", { required: true });
await runPatch("./patch-adapter-reject-ambiguous-satellite-parent-v1.mjs", { required: true });
await runPatch("./patch-adapter-quantize-ambiguity-scores-v1.mjs", { required: true });
await runPatch("./smoke-quantized-ambiguity-scores-source.mjs", { required: true });
await runPatch("./smoke-quantized-ambiguity-scores-runtime.mjs", { required: true });
await runPatch("./smoke-relative-ambiguity-confidence-source.mjs", { required: true });
await runPatch("./patch-adapter-preserve-more-architectural-masks-v1.mjs", { required: true });
await runPatch("./smoke-preserve-more-architectural-masks-source.mjs", { required: true });
await runPatch("./patch-adapter-mask-truncation-stats-v1.mjs", { required: true });
await runPatch("./patch-adapter-density-window-fallback-v1.mjs", { required: true });
await runPatch("./patch-density-fallback-mullion-tolerance-v1.mjs", { required: true });
await runPatch("./smoke-density-window-fallback-source.mjs", { required: true });
await runPatch("./patch-ui-mask-origin-legend-v1.mjs", { required: true });
await runPatch("./patch-ui-mask-count-status-v1.mjs", { required: true });
await runPatch("./patch-ui-mask-origin-counts-v1.mjs", { required: true });
await runPatch("./patch-ui-mask-origin-labels-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-mask-review-filter-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-mask-bulk-actions-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-mask-review-progress-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-mask-review-state-v1.mjs", { required: true });
await runPatch("./patch-ui-auto-mask-cap-warning-v1.mjs", { required: true });
await runPatch("./smoke-ui-auto-mask-cap-warning-source.mjs", { required: true });
await runPatch("./patch-ui-accurate-auto-mask-truncation-warning-v1.mjs", { required: true });
await runPatch("./smoke-accurate-auto-mask-truncation-warning-source.mjs", { required: true });
await runPatch("./patch-ui-omitted-auto-mask-count-v1.mjs", { required: true });
await runPatch("./smoke-ui-omitted-auto-mask-count-source.mjs", { required: true });
await runPatch("./patch-ui-clear-omitted-mask-wording-v1.mjs", { required: true });
await runPatch("./smoke-ui-clear-omitted-mask-wording-source.mjs", { required: true });
await runPatch("./patch-ui-review-next-auto-mask-v1.mjs", { required: true });
await runPatch("./smoke-ui-review-next-auto-mask-source.mjs", { required: true });
await runPatch("./patch-ui-review-auto-mask-focus-v1.mjs", { required: true });
await runPatch("./patch-ui-approve-selected-auto-mask-v1.mjs", { required: true });
await runPatch("./patch-ui-reject-selected-auto-mask-v1.mjs", { required: true });
await runPatch("./patch-ui-undo-auto-mask-rejection-v1.mjs", { required: true });
await runPatch("./smoke-ui-undo-auto-mask-rejection-source.mjs", { required: true });
await runPatch("./smoke-mullion-stronger-evidence-input-order.mjs", { required: true });
await runPatch("./patch-fallback-duplicate-center-drift-v1.mjs", { required: true });
await runPatch("./smoke-fallback-center-drift-behavior.mjs", { required: true });
await runPatch("./patch-fallback-duplicate-footprint-retention-v1.mjs", { required: true });
await runPatch("./smoke-fallback-footprint-retention-behavior.mjs", { required: true });
await runPatch("./patch-fallback-duplicate-growth-cap-v1.mjs", { required: true });

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
await runPatch("./patch-adapter-stable-mask-identities-v1.mjs", { required: true });
await runPatch("./smoke-stable-auto-mask-identities-runtime.mjs", { required: true });
console.log("source prep complete");
