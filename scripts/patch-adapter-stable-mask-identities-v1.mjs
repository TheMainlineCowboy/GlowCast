import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const helperMarker = "function stableMaskGeometryId(prefix: string, box: SimpleBox): string";
if (source.includes(helperMarker)) {
  console.log("stable auto-mask identity patch already applied");
  process.exit(0);
}

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

const fallbackId = 'id: "mask_fallback_" + Date.now() + "_" + next.length,';
if (!source.includes(fallbackId)) {
  throw new Error("Unable to locate fallback mask identity");
}
source = source.replace(fallbackId, 'id: stableMaskGeometryId("mask_fallback", box),');

const candidateId = 'id: "mask_candidate_" + Date.now() + "_" + accepted.length,';
if (!source.includes(candidateId)) {
  throw new Error("Unable to locate detector mask identity");
}
source = source.replace(candidateId, 'id: stableMaskGeometryId("mask_candidate", box),');

await fs.writeFile(adapterPath, source);
console.log("stable auto-mask identities ready");
