import fs from "node:fs/promises";

const sourcePrep = await fs.readFile("scripts/source-prep.mjs", "utf8");
const patch = await fs.readFile("scripts/patch-ui-auto-detect-masks-v1.mjs", "utf8");
const app = await fs.readFile("src/App.tsx", "utf8");
const viteConfig = await fs.readFile("vite.config.ts", "utf8");

function requireText(name, source, text) {
  if (!source.includes(text)) {
    console.error(`UI auto-detect wiring smoke failed: missing ${name}.`);
    process.exit(1);
  }
}

requireText("source-prep patch import", sourcePrep, "patch-ui-auto-detect-masks-v1.mjs");
requireText("vite source-prep hook", viteConfig, "scripts/source-prep.mjs");
requireText("vite buildStart hook", viteConfig, "buildStart()");
requireText("vite dev server hook", viteConfig, "configureServer()");
requireText("runner import insertion", patch, "runCandidateDetection");
requireText("auto detect function", patch, "async function runLocalAutoMaskDetection()");
requireText("auto detect button", patch, "Auto Detect Masks");
requireText("edge scan before detection", patch, "scanImageEdges(imageUrl)");
requireText("candidate runner diagnostics call", patch, "runCandidateDetection(activeEdgePoints, bounds, polygon, (diagnostics)");
requireText("auto mask label replacement", patch, "Auto architectural mask");
requireText("debug counter state", patch, "const [detectionDebug, setDetectionDebug]");
requireText("edge count debug value", patch, "edgePoints: activeEdgePoints.length");
requireText("mask count debug value", patch, "candidateMasks: detected.length");
requireText("surface scope debug value", patch, "polygonScoped");
requireText("visible debug helper", patch, "Debug: {detectionDebug.edgePoints.toLocaleString()} edges");
requireText("detector diagnostics type", patch, "DetectorDiagnostics");
requireText("closure rejection debug value", patch, "rejectedClosure");
requireText("size rejection debug value", patch, "rejectedSize");
requireText("aspect rejection debug value", patch, "rejectedAspect");
requireText("confidence rejection debug value", patch, "rejectedConfidence");
requireText("boundary penalty debug value", patch, "boundaryPenalized");

if (app.includes("Auto Detect Masks") && !app.includes("runCandidateDetection")) {
  console.error("UI auto-detect wiring smoke failed: App has button text without runner import/call.");
  process.exit(1);
}

console.log("UI auto-detect wiring smoke passed.");
