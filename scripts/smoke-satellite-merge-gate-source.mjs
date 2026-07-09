import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const prepSource = await fs.readFile("scripts/source-prep.mjs", "utf8");

if (prepSource.includes("patch-satellite-merge-inflation-gate-v1.mjs")) {
  console.error("Satellite merge gate smoke failed. Source prep still runs the redundant inflation gate patch.");
  process.exit(1);
}

for (const required of ["parentFillRatio >= 0.56", "satelliteFillRatio >= 0.08", "inflated random box"]) {
  if (!adapterSource.includes(required)) {
    console.error(`Satellite merge gate smoke failed. Missing source guard: ${required}`);
    process.exit(1);
  }
}

console.log("Satellite merge gate smoke passed: checked-in source guards are present without prep patch wiring.");
