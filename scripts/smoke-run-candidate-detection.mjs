import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const runnerPath = "src/core/runCandidateDetection.ts";
const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

if (!adapterSource.includes("sideCoverage.sides < 3")) {
  console.error("Run candidate detection smoke test failed. Fallback gate is not enforcing three-sided architectural masks.");
  process.exit(1);
}

if (!adapterSource.includes("closureBonus")) {
  console.error("Run candidate detection smoke test failed. Fallback scoring is not rewarding closed architectural masks.");
  process.exit(1);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-run-candidate-detection-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "runCandidateDetection.ts");
const tempPath = path.join(outDir, "core", "runCandidateDetection.js");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.copyFile(runnerPath, sourcePath);
await fs.copyFile(adapterPath, path.join(coreDir, "maskCandidateAdapter.ts"));
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    sourcePath,
    "--ignoreConfig",
    "--rootDir",
    sourceRoot,
    "--outDir",
    outDir,
    "--module",
    "ES2020",
    "--target",
    "ES2020",
    "--moduleResolution",
    "Bundler",
    "--skipLibCheck"
  ],
  { stdio: "inherit" }
);

const emittedRunnerPath = path.join(outDir, "core", "runCandidateDetection.js");
const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
const emittedRunner = await fs.readFile(emittedRunnerPath, "utf8");
const emittedAdapter = await fs.readFile(emittedAdapterPath, "utf8");
const emittedDetector = await fs.readFile(emittedDetectorPath, "utf8");
await fs.writeFile(
  emittedRunnerPath,
  emittedRunner.replace(/from\s+["']\.\/maskCandidateAdapter["']/g, 'from "./maskCandidateAdapter.js"')
);
await fs.writeFile(
  emittedAdapterPath,
  emittedAdapter.replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"')
);
await fs.writeFile(
  emittedDetectorPath,
  emittedDetector.replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"')
);

function addFrame(edgePoints, x1, y1, x2, y2, strength = 180) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength });
    edgePoints.push({ x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength });
    edgePoints.push({ x: x2, y, strength });
  }
}

function addCornerFragment(edgePoints, x1, y1, x2, y2, strength = 190) {
  for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y1, strength });
  for (let y = y1; y <= y2; y += 1) edgePoints.push({ x: x1, y, strength });
}

function addThreeSidedDoorway(edgePoints, x1, y1, x2, y2, strength = 190) {
  for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y1, strength });
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength });
    edgePoints.push({ x: x2, y, strength });
  }
}

function addDenseThreeSidedDoorway(edgePoints, x1, y1, x2, y2, strength = 210) {
  addThreeSidedDoorway(edgePoints, x1, y1, x2, y2, strength);
  addThreeSidedDoorway(edgePoints, x1 + 0.25, y1 + 0.25, x2 - 0.25, y2 - 0.25, strength);
}

function addArch(edgePoints, centerX, topY, radiusX, radiusY, bottomY, strength = 195) {
  for (let step = 0; step <= 32; step += 1) {
    const theta = Math.PI - (Math.PI * step) / 32;
    edgePoints.push({
      x: Number((centerX + Math.cos(theta) * radiusX).toFixed(2)),
      y: Number((topY + radiusY - Math.sin(theta) * radiusY).toFixed(2)),
      strength
    });
  }
  const leftX = centerX - radiusX;
  const rightX = centerX + radiusX;
  const springY = topY + radiusY;
  for (let y = springY; y <= bottomY; y += 1) {
    edgePoints.push({ x: leftX, y, strength });
    edgePoints.push({ x: rightX, y, strength });
  }
  for (let x = leftX; x <= rightX; x += 1) edgePoints.push({ x, y: bottomY, strength });
}

try {
  const { runCandidateDetection } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const groupedEdges = [];
  addFrame(groupedEdges, 42, 24, 62, 52);
  // Satellites must clear the adapter's deliberate minimum architectural size;
  // otherwise this fixture tests noise rejection instead of exported grouping behavior.
  addFrame(groupedEdges, 32, 25, 40, 51, 190);
  addFrame(groupedEdges, 64, 25, 72, 51, 190);

  let groupedDiagnostics;
  const masks = runCandidateDetection(groupedEdges, bounds, null, (diagnostics) => {
    groupedDiagnostics = diagnostics;
  });
  const groupedMask = masks.find((mask) => mask.x <= 34 && mask.x + mask.width >= 70 && mask.y <= 26 && mask.y + mask.height >= 50);

  if (!groupedDiagnostics || groupedDiagnostics.components < 1 || groupedDiagnostics.selected < 1) {
    throw new Error(`Detector diagnostics did not survive the exported runner path: ${JSON.stringify(groupedDiagnostics)}`);
  }
  if (!groupedMask) throw new Error(`Adapter grouping was not exposed by the exported runner: ${JSON.stringify(masks)}`);
  if (!Array.isArray(groupedMask.points) || groupedMask.points.length < 3) {
    throw new Error(`Exported runner discarded custom outline points: ${JSON.stringify(masks)}`);
  }

  const pointsAreLocal = groupedMask.points.every(
    (point) => point.x >= -0.01 && point.x <= 100.01 && point.y >= -0.01 && point.y <= 100.01
  );
  const touchesLocalBounds = groupedMask.points.some(
    (point) => point.x <= 1.05 || point.y <= 1.05 || point.x >= 98.95 || point.y >= 98.95
  );
  if (!pointsAreLocal || !touchesLocalBounds) {
    throw new Error(`Custom outline points were not normalized for zone-local clip paths: ${JSON.stringify(groupedMask)}`);
  }
  if (!/^Auto window mask /.test(groupedMask.label)) {
    throw new Error(`Grouped frame was not labeled as an auto window mask: ${JSON.stringify(groupedMask)}`);
  }

  const scopedMasks = runCandidateDetection(groupedEdges, bounds, [
    { x: 40, y: 18 },
    { x: 88, y: 18 },
    { x: 88, y: 58 },
    { x: 40, y: 58 }
  ]);
  if (scopedMasks.some((mask) => mask.x < 40)) {
    throw new Error(`Polygon scoping leaked outside the selected surface: ${JSON.stringify(scopedMasks)}`);
  }

  const cornerNoise = [];
  addCornerFragment(cornerNoise, 12, 18, 34, 48);
  let cornerDiagnostics;
  const cornerMasks = runCandidateDetection(cornerNoise, bounds, null, (diagnostics) => {
    cornerDiagnostics = diagnostics;
  });
  if (cornerMasks.length) throw new Error(`Fallback accepted an open corner fragment as a mask: ${JSON.stringify(cornerMasks)}`);
  if (!cornerDiagnostics || cornerDiagnostics.rejectedClosure < 1 || cornerDiagnostics.selected !== 0) {
    throw new Error(`Rejected corner fragments were not reported through runner diagnostics: ${JSON.stringify(cornerDiagnostics)}`);
  }

  const doorwayEdges = [];
  addThreeSidedDoorway(doorwayEdges, 44, 18, 60, 58);
  let doorwayDiagnostics;
  const doorwayMasks = runCandidateDetection(doorwayEdges, bounds, null, (diagnostics) => {
    doorwayDiagnostics = diagnostics;
  });
  const doorwayMask = doorwayMasks.find((mask) => mask.x <= 45 && mask.x + mask.width >= 59 && mask.y <= 19 && mask.y + mask.height >= 57);
  if (!doorwayMask) throw new Error(`Fallback over-filtered a three-sided doorway/arch-like outline: ${JSON.stringify(doorwayMasks)}`);
  if (!doorwayDiagnostics || doorwayDiagnostics.components < 1 || doorwayDiagnostics.selected > doorwayMasks.length) {
    throw new Error(`Doorway diagnostics do not distinguish detector selections from adapter output: ${JSON.stringify({ doorwayDiagnostics, doorwayMasks })}`);
  }
  if (!Array.isArray(doorwayMask.points) || doorwayMask.points.length < 3) {
    throw new Error(`Three-sided fallback mask did not keep editable outline points: ${JSON.stringify(doorwayMask)}`);
  }
  if (!/^Auto door mask /.test(doorwayMask.label)) {
    throw new Error(`Three-sided doorway was not labeled as an auto door mask: ${JSON.stringify(doorwayMask)}`);
  }

  const rankingEdges = [];
  addFrame(rankingEdges, 12, 20, 31, 44, 210);
  addFrame(rankingEdges, 12.25, 20.25, 30.75, 43.75, 210);
  addDenseThreeSidedDoorway(rankingEdges, 56, 18, 72, 58);
  const rankedMasks = runCandidateDetection(rankingEdges, bounds);
  const closedFrameIndex = rankedMasks.findIndex((mask) => mask.x <= 13 && mask.x + mask.width >= 30 && mask.y <= 21 && mask.y + mask.height >= 43);
  const denseThreeSideIndex = rankedMasks.findIndex((mask) => mask.x <= 57 && mask.x + mask.width >= 71 && mask.y <= 19 && mask.y + mask.height >= 57);
  if (closedFrameIndex < 0) throw new Error(`Closed frame was lost in mixed fallback ranking: ${JSON.stringify(rankedMasks)}`);
  if (denseThreeSideIndex >= 0) {
    const closedConfidence = rankedMasks[closedFrameIndex]?.confidence ?? 0;
    const denseThreeSideConfidence = rankedMasks[denseThreeSideIndex]?.confidence ?? 0;
    if (denseThreeSideConfidence - closedConfidence > 10) {
      throw new Error(`Dense three-sided fallback materially dominated a closed architectural frame: ${JSON.stringify(rankedMasks)}`);
    }
  }

  const archEdges = [];
  addArch(archEdges, 50, 18, 12, 10, 64);
  const archMasks = runCandidateDetection(archEdges, bounds);
  const archMask = archMasks.find((mask) => /^Auto arch mask /.test(mask.label));
  if (!archMask || archMask.shape !== "freehand" || !Array.isArray(archMask.points) || archMask.points.length < 5) {
    throw new Error(`Arched opening was not exposed as a custom freehand arch mask: ${JSON.stringify(archMasks)}`);
  }

  console.log(`Run candidate detection smoke test passed: ${masks.length} adapter-backed masks exposed with runner diagnostics, local outline points, labels, corner rejection, doorway fallback, arch classification, three-side fallback gate wiring, and bounded closed-frame ranking.`);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
