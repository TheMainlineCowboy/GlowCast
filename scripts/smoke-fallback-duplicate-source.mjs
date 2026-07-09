import fs from "node:fs";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const prepPatchPath = "scripts/patch-fallback-duplicate-replacement-v1.mjs";
const adapter = fs.readFileSync(adapterPath, "utf8");
const prepPatch = fs.readFileSync(prepPatchPath, "utf8");

const requiredSnippets = [
  "const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);",
  "const existingArea = existing.box.width * existing.box.height;",
  "if (area > existingArea * 1.35)",
  "id: existing.id"
];

const missingFromPrep = requiredSnippets.filter((snippet) => !prepPatch.includes(snippet));
if (missingFromPrep.length) {
  console.error("Fallback duplicate source smoke failed. Prep patch no longer contains duplicate replacement behavior.");
  console.error(JSON.stringify(missingFromPrep, null, 2));
  process.exit(1);
}

const missingFromSource = requiredSnippets.filter((snippet) => !adapter.includes(snippet));
if (missingFromSource.length) {
  console.error("Fallback duplicate source smoke failed. Checked-in adapter source still lacks duplicate replacement behavior.");
  console.error(JSON.stringify(missingFromSource, null, 2));
  process.exit(1);
}

if (adapter.includes("const duplicate = next.some((existing) => overlapRatio(existing.box, box) > 0.58);\n    if (duplicate) continue;")) {
  console.error("Fallback duplicate source smoke failed. Old skip-only fallback duplicate block is still present.");
  process.exit(1);
}

console.log("Fallback duplicate source smoke passed: larger overlapping fallback masks can replace smaller fragments in checked-in source.");
