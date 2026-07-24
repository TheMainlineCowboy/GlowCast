import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-multi-bridge-recovery-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function recoverSparseBridgeComponents", "export function recoverSparseBridgeComponents"));
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

function addClosedFrame(points, x1, y1, x2, y2) {
  for (let x = x1; x <= x2; x += 1) points.push({ x, y: y1, strength: 220 }, { x, y: y2, strength: 220 });
  for (let y = y1; y <= y2; y += 1) points.push({ x: x1, y, strength: 220 }, { x: x2, y, strength: 220 });
}

try {
  const { recoverSparseBridgeComponents } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  // Use three clearly separated frames so the regression proves recursive recovery
  // instead of depending on borderline sparse-band thresholds from the two-opening path.
  const threeHorizontal = [];
  addClosedFrame(threeHorizontal, 6, 24, 20, 61);
  addClosedFrame(threeHorizontal, 38, 24, 52, 61);
  addClosedFrame(threeHorizontal, 78, 24, 94, 61);
  for (let x = 21; x < 38; x += 1) threeHorizontal.push({ x, y: 44, strength: 220 });
  for (let x = 53; x < 78; x += 1) threeHorizontal.push({ x, y: 44, strength: 220 });
  const recoveredThree = recoverSparseBridgeComponents(
    threeHorizontal,
    { x: 6, y: 24, width: 88, height: 37 },
    bounds
  );
  if (recoveredThree.length !== 3) {
    throw new Error(`Expected three recovered horizontal openings, received ${recoveredThree.length}.`);
  }
  if (recoveredThree.some((candidate) => candidate.width > 24)) {
    throw new Error("Three-opening recovery retained too much horizontal bridge clutter.");
  }

  const threeVertical = [];
  addClosedFrame(threeVertical, 25, 5, 61, 20);
  addClosedFrame(threeVertical, 25, 38, 61, 53);
  addClosedFrame(threeVertical, 25, 78, 61, 95);
  for (let y = 21; y < 38; y += 1) threeVertical.push({ x: 44, y, strength: 220 });
  for (let y = 54; y < 78; y += 1) threeVertical.push({ x: 44, y, strength: 220 });
  const recoveredVertical = recoverSparseBridgeComponents(
    threeVertical,
    { x: 25, y: 5, width: 36, height: 90 },
    bounds
  );
  if (recoveredVertical.length !== 3) {
    throw new Error(`Expected three recovered vertical openings, received ${recoveredVertical.length}.`);
  }
  if (recoveredVertical.some((candidate) => candidate.height > 25)) {
    throw new Error("Three-opening vertical recovery retained too much bridge clutter.");
  }

  const continuousFrame = [];
  addClosedFrame(continuousFrame, 8, 18, 91, 72);
  for (let x = 9; x < 91; x += 2) continuousFrame.push({ x, y: 44, strength: 220 });
  const shouldStayWhole = recoverSparseBridgeComponents(
    continuousFrame,
    { x: 8, y: 18, width: 83, height: 54 },
    bounds
  );
  if (shouldStayWhole.length !== 0) {
    throw new Error("Continuous architectural frame was incorrectly split into multiple openings.");
  }

  console.log("Multi-opening bridge recovery smoke passed: three horizontal and vertical openings were recovered while a continuous frame remained intact.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
