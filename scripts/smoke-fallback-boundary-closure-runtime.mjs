import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-boundary-closure-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function buildFallbackComponents", "export function buildFallbackComponents"));
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", sourcePath, "--ignoreConfig", "--rootDir", sourceRoot,
  "--outDir", outDir, "--module", "ES2020", "--target", "ES2020",
  "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
const emittedAdapter = await fs.readFile(emittedAdapterPath, "utf8");
const emittedDetector = await fs.readFile(emittedDetectorPath, "utf8");
await fs.writeFile(emittedAdapterPath, emittedAdapter.replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, emittedDetector.replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

function addThreeSidedFrame(edgePoints, x1, y1, x2, y2, missingSide, strength = 220) {
  if (missingSide !== "top") {
    for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y1, strength });
  }
  if (missingSide !== "bottom") {
    for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y2, strength });
  }
  if (missingSide !== "left") {
    for (let y = y1; y <= y2; y += 1) edgePoints.push({ x: x1, y, strength });
  }
  if (missingSide !== "right") {
    for (let y = y1; y <= y2; y += 1) edgePoints.push({ x: x2, y, strength });
  }
}

try {
  const { buildFallbackComponents } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const interiorDoorwayEdges = [];
  addThreeSidedFrame(interiorDoorwayEdges, 20, 20, 44, 52, "bottom");
  const interiorDoorway = buildFallbackComponents(interiorDoorwayEdges, bounds);
  if (interiorDoorway.length !== 1) {
    throw new Error(`Interior three-sided doorway should remain eligible, got ${JSON.stringify(interiorDoorway)}`);
  }

  const croppedBoundaryEdges = [];
  addThreeSidedFrame(croppedBoundaryEdges, 0, 20, 24, 52, "left");
  const croppedBoundary = buildFallbackComponents(croppedBoundaryEdges, bounds);
  if (croppedBoundary.length !== 0) {
    throw new Error(`Open boundary fragment should be rejected, got ${JSON.stringify(croppedBoundary)}`);
  }

  const closedBoundaryEdges = [];
  addThreeSidedFrame(closedBoundaryEdges, 0, 20, 24, 52, "none");
  const closedBoundary = buildFallbackComponents(closedBoundaryEdges, bounds);
  if (closedBoundary.length !== 1) {
    throw new Error(`Closed boundary window should remain eligible, got ${JSON.stringify(closedBoundary)}`);
  }

  console.log("Fallback boundary closure runtime smoke passed: interior three-sided doorway and closed edge window accepted; cropped open edge fragment rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
