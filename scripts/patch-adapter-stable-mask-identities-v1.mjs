import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const helperMarker = "function stableMaskGeometryId(prefix: string, box: SimpleBox, points: SimplePoint[]): string";
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

function canonicalOutlineKey(points: SimplePoint[]): string {
  const keys = points.map((point) => \`${'${Math.round(point.x * 20).toString(36)},${Math.round(point.y * 20).toString(36)}'}\`);
  if (keys.length === 0) return "empty";
  const rotations = (sequence: string[]) => sequence.map((_, index) => sequence.slice(index).concat(sequence.slice(0, index)).join(";"));
  const forward = rotations(keys);
  const reverse = rotations([...keys].reverse());
  return [...forward, ...reverse].sort()[0];
}

function stableMaskGeometryId(prefix: string, box: SimpleBox, points: SimplePoint[]): string {
  const geometry = [box.x, box.y, box.width, box.height]
    .map((value) => Math.round(value * 20).toString(36))
    .join("_");
  const outline = canonicalOutlineKey(points);
  let fingerprint = 2166136261;
  for (let index = 0; index < outline.length; index += 1) {
    fingerprint ^= outline.charCodeAt(index);
    fingerprint = Math.imul(fingerprint, 16777619);
  }
  return \`${'${prefix}_${geometry}_${(fingerprint >>> 0).toString(36)}'}\`;
}`
  );
}

const fallbackId = 'id: "mask_fallback_" + Date.now() + "_" + next.length,';
if (source.includes(fallbackId)) {
  source = source.replace(fallbackId, 'id: stableMaskGeometryId("mask_fallback", box, fallback.points),');
}

const candidateId = 'id: "mask_candidate_" + Date.now() + "_" + accepted.length,';
if (source.includes(candidateId)) {
  source = source.replace(candidateId, 'id: stableMaskGeometryId("mask_candidate", box, points),');
}

if (!source.includes('id: stableMaskGeometryId("mask_fallback", box, fallback.points),') || !source.includes('id: stableMaskGeometryId("mask_candidate", box, points),')) {
  throw new Error("Unable to establish distinct stable detector mask identities");
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

await import("./smoke-stable-auto-mask-identities-source.mjs");
console.log("connectivity-preserving stable auto-mask identities ready");
