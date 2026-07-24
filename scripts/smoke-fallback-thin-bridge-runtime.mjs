import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-thin-bridge-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function hasSparseMidBridge", "export function hasSparseMidBridge")
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
  const { hasSparseMidBridge } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const continuousFrame = [];
  addClosedFrame(continuousFrame, 15, 30, 85, 60);
  if (hasSparseMidBridge(continuousFrame, { x: 15, y: 30, width: 70, height: 30 }, bounds)) {
    throw new Error("A genuinely continuous large frame must not be classified as a sparse bridge.");
  }

  const bridgedOpenings = [];
  addClosedFrame(bridgedOpenings, 15, 30, 30, 60);
  addClosedFrame(bridgedOpenings, 70, 30, 85, 60);
  for (let x = 31; x < 70; x += 1) bridgedOpenings.push({ x, y: 45, strength: 220 });
  if (!hasSparseMidBridge(bridgedOpenings, { x: 15, y: 30, width: 70, height: 30 }, bounds)) {
    throw new Error("Two dense openings joined by a thin façade bridge should be rejected as one fallback component.");
  }

  const compactFixture = [];
  addClosedFrame(compactFixture, 42, 42, 58, 58);
  if (hasSparseMidBridge(compactFixture, { x: 42, y: 42, width: 16, height: 16 }, bounds)) {
    throw new Error("Compact architectural fixtures must remain outside the thin-bridge cleanup gate.");
  }

  console.log("Thin-bridge fallback runtime smoke passed: continuous large frames and compact fixtures survive while two dense openings joined by a sparse bridge are rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
