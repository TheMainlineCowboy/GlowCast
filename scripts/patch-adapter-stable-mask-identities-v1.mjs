import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const helperMarker = "function stableMaskGeometryId(prefix: string, box: SimpleBox): string";
if (!source.includes(helperMarker)) {
  const pointKeyAnchor = `function pointKey(point: SimplePoint): string {
  return \`${'${point.x.toFixed(2)},${point.y.toFixed(2)}'}\`;
}`;
  if (!source.includes(pointKeyAnchor)) {
    throw new Error("Unable to locate point-key helper for stable mask identities");
  }

  source = source.replace(
    pointKeyAnchor,
    `${pointKeyAnchor}

function stableMaskGeometryId(prefix: string, box: SimpleBox): string {
  const geometry = [box.x, box.y, box.width, box.height]
    .map((value) => Math.round(value * 20).toString(36))
    .join("_");
  return \`${'${prefix}_${geometry}'}\`;
}`
  );
}

const fallbackId = 'id: "mask_fallback_" + Date.now() + "_" + next.length,';
if (source.includes(fallbackId)) {
  source = source.replace(fallbackId, 'id: stableMaskGeometryId("mask_fallback", box),');
}

const candidateId = 'id: "mask_candidate_" + Date.now() + "_" + accepted.length,';
if (source.includes(candidateId)) {
  source = source.replace(candidateId, 'id: stableMaskGeometryId("mask_candidate", box),');
}

if (!source.includes('id: stableMaskGeometryId("mask_fallback", box),') || !source.includes('id: stableMaskGeometryId("mask_candidate", box),')) {
  throw new Error("Unable to establish stable detector mask identities");
}

await fs.writeFile(adapterPath, source);

const edgePath = "src/edgeDetect.ts";
let edge = await fs.readFile(edgePath, "utf8");
const timestampId = 'id: "auto_mask_architectural_" + Date.now() + "_" + index,';
if (edge.includes(timestampId)) {
  edge = edge.replace("return candidates.map((candidate, index) => ({", "return candidates.map((candidate) => ({");
  edge = edge.replace(timestampId, 'id: "auto_mask_architectural_" + candidate.id,');
}
if (!edge.includes('id: "auto_mask_architectural_" + candidate.id,')) {
  throw new Error("Unable to establish stable UI auto-mask identities");
}
await fs.writeFile(edgePath, edge);

console.log("stable auto-mask identities ready");
