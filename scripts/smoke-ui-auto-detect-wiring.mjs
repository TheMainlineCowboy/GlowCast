import fs from "node:fs/promises";

const sourcePrep = await fs.readFile("scripts/source-prep.mjs", "utf8");
const patch = await fs.readFile("scripts/patch-ui-auto-detect-masks-v1.mjs", "utf8");
const app = await fs.readFile("src/App.tsx", "utf8");

function requireText(name, source, text) {
  if (!source.includes(text)) {
    console.error(`UI auto-detect wiring smoke failed: missing ${name}.`);
    process.exit(1);
  }
}

requireText("source-prep patch import", sourcePrep, "patch-ui-auto-detect-masks-v1.mjs");
requireText("runner import insertion", patch, "runCandidateDetection");
requireText("auto detect function", patch, "async function runLocalAutoMaskDetection()");
requireText("auto detect button", patch, "Auto Detect Masks");
requireText("edge scan before detection", patch, "scanImageEdges(imageUrl)");
requireText("candidate runner call", patch, "runCandidateDetection(activeEdgePoints, bounds, polygon)");
requireText("auto mask label replacement", patch, "Auto architectural mask");

if (app.includes("Auto Detect Masks") && !app.includes("runCandidateDetection")) {
  console.error("UI auto-detect wiring smoke failed: App has button text without runner import/call.");
  process.exit(1);
}

console.log("UI auto-detect wiring smoke passed.");
