import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-fallback-adapter-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");
const tempPath = path.join(outDir, "core", "maskCandidateAdapter.js");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function addFallbackCandidates", "export function addFallbackCandidates"));
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

function addFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength });
    edgePoints.push({ x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength });
    edgePoints.push({ x: x2, y, strength });
  }
}

function seedMask() {
  return {
    id: "architectural_seed",
    box: { x: 20, y: 20, width: 20, height: 20 },
    points: [{ x: 20, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 40 }, { x: 20, y: 40 }]
  };
}

function assertBox(actual, expected, label) {
  const tolerance = 1.5;
  for (const key of ["x", "y", "width", "height"]) {
    if (Math.abs(actual[key] - expected[key]) > tolerance) {
      throw new Error(`${label}: expected ${key}=${expected[key]}, got ${actual[key]}`);
    }
  }
}

try {
  const { addFallbackCandidates } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const centeredEdges = [];
  addFrame(centeredEdges, 18, 18, 42, 42);
  const centered = addFallbackCandidates([seedMask()], centeredEdges, bounds);
  if (centered.length !== 1 || centered[0].id !== "architectural_seed") {
    throw new Error(`Centered repair created a duplicate: ${JSON.stringify(centered)}`);
  }
  assertBox(centered[0].box, { x: 18, y: 18, width: 25, height: 25 }, "Centered repair");

  const oversizedCenteredEdges = [];
  addFrame(oversizedCenteredEdges, 6, 6, 54, 54);
  const oversizedCentered = addFallbackCandidates([seedMask()], oversizedCenteredEdges, bounds);
  if (oversizedCentered.length !== 1) {
    throw new Error(`Oversized centered fallback created a duplicate: ${JSON.stringify(oversizedCentered)}`);
  }
  assertBox(oversizedCentered[0].box, seedMask().box, "Oversized centered fallback");

  const oneSidedTrimEdges = [];
  addFrame(oneSidedTrimEdges, 20, 17, 47, 43);
  const oneSidedTrim = addFallbackCandidates([seedMask()], oneSidedTrimEdges, bounds);
  if (oneSidedTrim.length !== 1) {
    throw new Error(`One-sided trim fallback created a duplicate: ${JSON.stringify(oneSidedTrim)}`);
  }
  assertBox(oneSidedTrim[0].box, seedMask().box, "One-sided trim fallback");

  const shiftedRightEdges = [];
  addFrame(shiftedRightEdges, 24, 16, 52, 44);
  const shiftedRight = addFallbackCandidates([seedMask()], shiftedRightEdges, bounds);
  if (shiftedRight.length !== 1) throw new Error(`Right-shifted fallback created a duplicate: ${JSON.stringify(shiftedRight)}`);
  assertBox(shiftedRight[0].box, seedMask().box, "Right-shifted fallback");

  const shiftedDownEdges = [];
  addFrame(shiftedDownEdges, 16, 24, 44, 52);
  const shiftedDown = addFallbackCandidates([seedMask()], shiftedDownEdges, bounds);
  if (shiftedDown.length !== 1) throw new Error(`Down-shifted fallback created a duplicate: ${JSON.stringify(shiftedDown)}`);
  assertBox(shiftedDown[0].box, seedMask().box, "Down-shifted fallback");

  console.log("Fallback adapter replacement smoke passed: bounded balanced repair accepted; oversized, one-sided, displaced, and footprint-clipping replacements rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
