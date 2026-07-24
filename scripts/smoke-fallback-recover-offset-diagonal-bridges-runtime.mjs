import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-offset-bridge-recovery-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function recoverSparseBridgeComponents", "export function recoverSparseBridgeComponents")
);
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

  const offsetDiagonal = [];
  addClosedFrame(offsetDiagonal, 10, 20, 28, 55);
  addClosedFrame(offsetDiagonal, 54, 34, 88, 72);
  for (let x = 29; x < 54; x += 1) {
    offsetDiagonal.push({ x, y: 54 - Math.round((x - 29) * 0.72), strength: 220 });
  }
  const recoveredOffset = recoverSparseBridgeComponents(
    offsetDiagonal,
    { x: 10, y: 20, width: 78, height: 52 },
    bounds
  );
  if (recoveredOffset.length !== 2) {
    throw new Error(`Expected two openings from an off-center diagonal bridge, received ${recoveredOffset.length}.`);
  }
  if (recoveredOffset[0].width > 28 || recoveredOffset[1].width > 42) {
    throw new Error("Offset diagonal recovery retained too much sparse bridge tail.");
  }

  const verticalDiagonal = [];
  addClosedFrame(verticalDiagonal, 18, 8, 52, 28);
  addClosedFrame(verticalDiagonal, 34, 55, 70, 88);
  for (let y = 29; y < 55; y += 1) {
    verticalDiagonal.push({ x: 51 - Math.round((y - 29) * 0.58), y, strength: 220 });
  }
  const recoveredVertical = recoverSparseBridgeComponents(
    verticalDiagonal,
    { x: 18, y: 8, width: 52, height: 80 },
    bounds
  );
  if (recoveredVertical.length !== 2) {
    throw new Error(`Expected two openings from a vertical diagonal bridge, received ${recoveredVertical.length}.`);
  }
  if (recoveredVertical[0].height > 30 || recoveredVertical[1].height > 42) {
    throw new Error("Vertical diagonal recovery retained too much sparse bridge tail.");
  }

  const centeredBridge = [];
  addClosedFrame(centeredBridge, 12, 28, 31, 62);
  addClosedFrame(centeredBridge, 69, 28, 88, 62);
  for (let x = 32; x < 69; x += 1) centeredBridge.push({ x, y: 45, strength: 220 });
  const centeredRecovery = recoverSparseBridgeComponents(
    centeredBridge,
    { x: 12, y: 28, width: 76, height: 34 },
    bounds
  );
  if (centeredRecovery.length !== 2) {
    throw new Error("Existing centered thin-bridge recovery regressed.");
  }

  const continuousFrame = [];
  addClosedFrame(continuousFrame, 12, 22, 88, 70);
  const continuousRecovery = recoverSparseBridgeComponents(
    continuousFrame,
    { x: 12, y: 22, width: 76, height: 48 },
    bounds
  );
  if (continuousRecovery.length !== 0) {
    throw new Error("A continuous architectural frame must not be split by the sparse-bridge scanner.");
  }

  console.log("Offset/diagonal bridge recovery smoke passed: asymmetric horizontal and vertical bridges recover two compact openings, centered recovery remains intact, and a continuous frame stays whole.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
