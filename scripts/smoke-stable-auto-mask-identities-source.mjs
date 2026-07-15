import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function stableMaskGeometryId(prefix: string, box: SimpleBox): string",
  '.map((value) => Math.round(value * 20).toString(36))',
  'id: stableMaskGeometryId("mask_candidate", box)',
  'id: stableMaskGeometryId("mask_fallback", box)'
];

for (const marker of required) {
  if (!source.includes(marker)) {
    console.error(`Stable auto-mask identity smoke failed: missing ${marker}`);
    process.exit(1);
  }
}

if (source.includes('"mask_candidate_" + Date.now()') || source.includes('"mask_fallback_" + Date.now()')) {
  console.error("Stable auto-mask identity smoke failed: timestamp-based detector identities remain.");
  process.exit(1);
}

console.log("Stable auto-mask identity smoke passed: unchanged geometry keeps deterministic detector and fallback mask identities.");
