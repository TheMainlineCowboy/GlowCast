import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-adaptive-gap-recovery-"));
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
  const bounds = { x: 0, y: 0, width: 120, height: 100 };
  const points = [];
  addClosedFrame(points, 5, 24, 25, 66);
  addClosedFrame(points, 41, 24, 61, 66);
  addClosedFrame(points, 91, 24, 115, 66);

  // First separation is narrow and clean; second is wider and deliberately noisier.
  for (let x = 26; x < 41; x += 1) points.push({ x, y: 45, strength: 220 });
  for (let x = 62; x < 91; x += 1) {
    points.push({ x, y: 44, strength: 220 });
    if (x % 4 === 0) points.push({ x, y: 48, strength: 180 });
  }

  const recovered = recoverSparseBridgeComponents(points, { x: 5, y: 24, width: 110, height: 42 }, bounds);
  if (recovered.length !== 3) {
    throw new Error(`Expected three openings across uneven sparse gaps, received ${recovered.length}.`);
  }
  if (recovered.some((candidate) => candidate.width > 31)) {
    throw new Error("Adaptive recovery retained excessive bridge clutter in a recovered opening.");
  }
  console.log("Adaptive uneven-gap recovery smoke passed: narrow clean and wider noisy separations both recovered individual openings.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
