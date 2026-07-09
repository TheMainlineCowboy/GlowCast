import fs from "node:fs/promises";

const prepSource = await fs.readFile("scripts/source-prep.mjs", "utf8");
const patchSource = await fs.readFile("scripts/patch-satellite-merge-inflation-gate-v1.mjs", "utf8");

if (!prepSource.includes("patch-satellite-merge-inflation-gate-v1.mjs")) {
  console.error("Satellite merge gate smoke failed. Source prep does not run the inflation gate patch.");
  process.exit(1);
}

for (const required of ["parentFillRatio >= 0.56", "satelliteFillRatio >= 0.08", "inflated random box"]) {
  if (!patchSource.includes(required)) {
    console.error(`Satellite merge gate smoke failed. Missing required guard: ${required}`);
    process.exit(1);
  }
}

console.log("Satellite merge gate smoke passed: prep wiring and inflation guards are present.");
