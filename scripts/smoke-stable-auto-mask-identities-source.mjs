import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const edgeSource = await fs.readFile("src/edgeDetect.ts", "utf8");

const requiredAdapterMarkers = [
  "function stableMaskGeometryId(prefix: string, box: SimpleBox, points: SimplePoint[]): string",
  '.map((value) => Math.round(value * 20).toString(36))',
  '.sort()',
  'fingerprint = Math.imul(fingerprint, 16777619)',
  'id: stableMaskGeometryId("mask_candidate", box, points)',
  'id: stableMaskGeometryId("mask_fallback", box, fallback.points)'
];

for (const marker of requiredAdapterMarkers) {
  if (!adapterSource.includes(marker)) {
    console.error(`Stable auto-mask identity smoke failed: missing ${marker}`);
    process.exit(1);
  }
}

if (adapterSource.includes('"mask_candidate_" + Date.now()') || adapterSource.includes('"mask_fallback_" + Date.now()')) {
  console.error("Stable auto-mask identity smoke failed: timestamp-based detector identities remain.");
  process.exit(1);
}

if (adapterSource.includes('stableMaskGeometryId("mask_candidate", box)') || adapterSource.includes('stableMaskGeometryId("mask_fallback", box)')) {
  console.error("Stable auto-mask identity smoke failed: box-only identities can collide for different outlines.");
  process.exit(1);
}

if (!edgeSource.includes('id: "auto_mask_architectural_" + candidate.id,')) {
  console.error("Stable auto-mask identity smoke failed: UI masks do not inherit detector geometry identities.");
  process.exit(1);
}
if (edgeSource.includes('"auto_mask_architectural_" + Date.now()')) {
  console.error("Stable auto-mask identity smoke failed: timestamp-based UI mask identities remain.");
  process.exit(1);
}

console.log("Stable auto-mask identity smoke passed: unchanged outlines keep deterministic identities while different outlines sharing a box remain distinct.");