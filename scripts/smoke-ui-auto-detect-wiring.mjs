import fs from "node:fs/promises";

const sourcePrep = await fs.readFile("scripts/source-prep.mjs", "utf8");
const patch = await fs.readFile("scripts/patch-ui-auto-detect-masks-v1.mjs", "utf8");
const app = await fs.readFile("src/App.tsx", "utf8");
const viteConfig = await fs.readFile("vite.config.ts", "utf8");
const indexHtml = await fs.readFile("index.html", "utf8");

function requireText(name, source, text) {
  if (!source.includes(text)) {
    console.error(`UI auto-detect wiring smoke failed: missing ${name}.`);
    process.exit(1);
  }
}

requireText("source-prep resilient runner", sourcePrep, "async function runPatch(path, { required = false } = {})");
requireText("source-prep optional patch warning", sourcePrep, "Optional patch skipped");
requireText("source-prep required patch error", sourcePrep, "Required source prep patch failed");
requireText("required auto-detect prep", sourcePrep, 'patch-ui-auto-detect-masks-v1.mjs", { required: true }');
requireText("React Vite plugin", viteConfig, "react()");
requireText("Cloudflare build SHA input", viteConfig, "CF_PAGES_COMMIT_SHA");
requireText("build stamp transform", viteConfig, "glowcast-build-stamp");
requireText("build stamp replacement", viteConfig, 'replaceAll("__GLOWCAST_BUILD__", buildSha)');
requireText("visible build stamp", indexHtml, "glowcast-build-stamp");
requireText("build stamp placeholder", indexHtml, "__GLOWCAST_BUILD__");

requireText("prepared app runner import", app, 'import { runCandidateDetection } from "./core/runCandidateDetection";');
requireText("prepared app auto detect function", app, "async function runLocalAutoMaskDetection()");
requireText("prepared app auto detect button", app, "Auto Detect Masks");
requireText("prepared app runner call", app, "runCandidateDetection(activeEdgePoints, bounds, polygon");
requireText("prepared app auto mask replacement", app, "Auto architectural mask");

requireText("runner import insertion patch", patch, "runCandidateDetection");
requireText("auto detect function patch", patch, "async function runLocalAutoMaskDetection()");
requireText("auto detect button patch", patch, "Auto Detect Masks");
requireText("edge scan before detection", patch, "scanImageEdges(imageUrl)");
requireText("candidate runner diagnostics call", patch, "runCandidateDetection(activeEdgePoints, bounds, polygon, (diagnostics)");
requireText("debug counter state", patch, "const [detectionDebug, setDetectionDebug]");
requireText("detector diagnostics type", patch, "DetectorDiagnostics");
requireText("closure rejection debug value", patch, "rejectedClosure");
requireText("size rejection debug value", patch, "rejectedSize");
requireText("aspect rejection debug value", patch, "rejectedAspect");
requireText("confidence rejection debug value", patch, "rejectedConfidence");
requireText("boundary penalty debug value", patch, "boundaryPenalized");

console.log("UI auto-detect wiring smoke passed: prepared App.tsx and visible build stamp are wired.");
