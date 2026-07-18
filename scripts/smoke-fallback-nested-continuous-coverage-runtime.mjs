import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

if (!adapterSource.includes("perimeterCoverage:") || !adapterSource.includes("perimeterDensity:") || !adapterSource.includes("perimeterStrength:") || !adapterSource.includes("const robustStrength =")) {
  throw new Error("Continuous-coverage runtime smoke requires prepared perimeter coverage, density, and robust edge-strength ranking.");
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-nested-continuous-coverage-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

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

function addClosedFrame(edgePoints, x1, y1, x2, y2, strength = 230) {
  for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  for (let y = y1; y <= y2; y += 1) edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
}

function frameWithStep(id, step, strength = 230) {
  const points = [];
  const addAxis = (start, end, callback) => {
    for (let value = start; value < end; value += step) callback(Number(value.toFixed(1)));
    callback(end);
  };
  addAxis(33, 67, (x) => points.push({ x, y: 33, strength }, { x, y: 67, strength }));
  addAxis(33, 67, (y) => points.push({ x: 33, y, strength }, { x: 67, y, strength }));
  return { id, box: { x: 33, y: 33, width: 34, height: 34 }, points };
}

function continuousFrame(id, strength = 230) {
  return frameWithStep(id, 1, strength);
}

function looseContinuousFrame(id) {
  return frameWithStep(id, 1.4, 230);
}

function spikyContinuousFrame(id) {
  const frame = continuousFrame(id, 80);
  frame.points = frame.points.map((point, index) => ({
    ...point,
    strength: index % 10 === 0 ? 255 : 80
  }));
  return frame;
}

function sparseSpreadFrame(id) {
  return {
    id,
    box: { x: 33, y: 33, width: 34, height: 34 },
    points: [
      { x: 33, y: 33, strength: 230 }, { x: 50, y: 33, strength: 230 }, { x: 67, y: 33, strength: 230 },
      { x: 33, y: 67, strength: 230 }, { x: 50, y: 67, strength: 230 }, { x: 67, y: 67, strength: 230 },
      { x: 33, y: 50, strength: 230 }, { x: 67, y: 50, strength: 230 }
    ]
  };
}

function candidateById(candidates, id) {
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Expected candidate ${id}, got ${JSON.stringify(candidates)}`);
  return candidate;
}

function assertUnchanged(candidate, expected, context) {
  if (candidate.box.x !== expected.box.x || candidate.box.y !== expected.box.y ||
      candidate.box.width !== expected.box.width || candidate.box.height !== expected.box.height) {
    throw new Error(`${context}: expected ${JSON.stringify(expected.box)}, got ${JSON.stringify(candidate.box)}`);
  }
}

const bounds = { x: 0, y: 0, width: 100, height: 100 };
const fallbackEdges = [];
addClosedFrame(fallbackEdges, 32, 32, 68, 68);

try {
  const { addFallbackCandidates } = await import(pathToFileURL(emittedAdapterPath).href);
  for (const accepted of [
    [sparseSpreadFrame("sparse"), continuousFrame("continuous")],
    [continuousFrame("continuous"), sparseSpreadFrame("sparse")]
  ]) {
    const result = addFallbackCandidates(accepted, fallbackEdges, bounds);
    const sparse = accepted.find((item) => item.id === "sparse");
    const continuous = accepted.find((item) => item.id === "continuous");
    assertUnchanged(candidateById(result, "sparse"), sparse, `Sparse widely separated samples received the repair for order ${accepted.map((item) => item.id).join(", ")}`);
    const repaired = candidateById(result, "continuous");
    if (repaired.box.width <= continuous.box.width || repaired.box.height <= continuous.box.height) {
      throw new Error(`Continuous perimeter should receive the bounded repair regardless of input order: ${JSON.stringify(repaired.box)}`);
    }
  }

  for (const accepted of [
    [looseContinuousFrame("loose"), continuousFrame("dense")],
    [continuousFrame("dense"), looseContinuousFrame("loose")]
  ]) {
    const result = addFallbackCandidates(accepted, fallbackEdges, bounds);
    const loose = accepted.find((item) => item.id === "loose");
    const dense = accepted.find((item) => item.id === "dense");
    assertUnchanged(candidateById(result, "loose"), loose, `Loosely sampled perimeter received the repair for order ${accepted.map((item) => item.id).join(", ")}`);
    const repaired = candidateById(result, "dense");
    if (repaired.box.width <= dense.box.width || repaired.box.height <= dense.box.height) {
      throw new Error(`Dense continuous perimeter should outrank equal-span loose evidence regardless of input order: ${JSON.stringify(repaired.box)}`);
    }
  }

  for (const accepted of [
    [continuousFrame("weak", 70), continuousFrame("strong", 235)],
    [continuousFrame("strong", 235), continuousFrame("weak", 70)]
  ]) {
    const result = addFallbackCandidates(accepted, fallbackEdges, bounds);
    const weak = accepted.find((item) => item.id === "weak");
    const strong = accepted.find((item) => item.id === "strong");
    assertUnchanged(candidateById(result, "weak"), weak, `Weak equal-density perimeter received the repair for order ${accepted.map((item) => item.id).join(", ")}`);
    const repaired = candidateById(result, "strong");
    if (repaired.box.width <= strong.box.width || repaired.box.height <= strong.box.height) {
      throw new Error(`Strong architectural perimeter should outrank equally dense weak evidence regardless of input order: ${JSON.stringify(repaired.box)}`);
    }
  }

  for (const accepted of [
    [spikyContinuousFrame("spiky"), continuousFrame("steady", 95)],
    [continuousFrame("steady", 95), spikyContinuousFrame("spiky")]
  ]) {
    const result = addFallbackCandidates(accepted, fallbackEdges, bounds);
    const spiky = accepted.find((item) => item.id === "spiky");
    const steady = accepted.find((item) => item.id === "steady");
    assertUnchanged(candidateById(result, "spiky"), spiky, `Isolated high-intensity noise inflated a weak perimeter for order ${accepted.map((item) => item.id).join(", ")}`);
    const repaired = candidateById(result, "steady");
    if (repaired.box.width <= steady.box.width || repaired.box.height <= steady.box.height) {
      throw new Error(`Consistently strong perimeter should outrank a weak edge with isolated spikes regardless of input order: ${JSON.stringify(repaired.box)}`);
    }
  }

  console.log("Nested continuous-coverage runtime smoke passed: sustained dense, consistently strong perimeter runs outrank widely separated, loosely sampled, weak, and isolated-spike evidence across input orders.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
