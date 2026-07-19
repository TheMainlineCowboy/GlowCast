import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
if (!adapterSource.includes("perimeterStrengthConsistency:") || !adapterSource.includes("sampleCount: bestRun.length")) {
  throw new Error("Strength-confidence runtime smoke requires prepared confidence-aware perimeter consistency ranking.");
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-strength-confidence-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function addFallbackCandidates", "export function addFallbackCandidates"));
await fs.copyFile("src/core/architecturalDetector.ts", path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile("src/edgeDetect.ts", path.join(sourceRoot, "edgeDetect.ts"));

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

function axisPositions(count) {
  return Array.from({ length: count }, (_, index) => 33 + (34 * index) / Math.max(count - 1, 1));
}

function frameWithSideCounts(id, counts, strength = 120) {
  const [topCount, bottomCount, leftCount, rightCount] = counts;
  const points = [];
  for (const x of axisPositions(topCount)) points.push({ x, y: 33, strength });
  for (const x of axisPositions(bottomCount)) points.push({ x, y: 67, strength });
  for (const y of axisPositions(leftCount)) points.push({ x: 33, y, strength });
  for (const y of axisPositions(rightCount)) points.push({ x: 67, y, strength });
  return { id, box: { x: 33, y: 33, width: 34, height: 34 }, points };
}

function addClosedFrame(edgePoints, x1, y1, x2, y2, strength = 230) {
  for (let x = x1; x <= x2; x += 1) edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  for (let y = y1; y <= y2; y += 1) edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
}

function candidateById(candidates, id) {
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Expected candidate ${id}, got ${JSON.stringify(candidates)}`);
  return candidate;
}

function unchanged(candidate, expected) {
  return candidate.box.x === expected.box.x && candidate.box.y === expected.box.y &&
    candidate.box.width === expected.box.width && candidate.box.height === expected.box.height;
}

const fallbackEdges = [];
addClosedFrame(fallbackEdges, 32, 32, 68, 68);
const bounds = { x: 0, y: 0, width: 100, height: 100 };

try {
  const { addFallbackCandidates } = await import(pathToFileURL(emittedAdapterPath).href);
  for (const accepted of [
    [frameWithSideCounts("uneven-confidence", [10, 14, 14, 14]), frameWithSideCounts("balanced-confidence", [13, 13, 13, 13])],
    [frameWithSideCounts("balanced-confidence", [13, 13, 13, 13]), frameWithSideCounts("uneven-confidence", [10, 14, 14, 14])]
  ]) {
    const result = addFallbackCandidates(accepted, fallbackEdges, bounds);
    const uneven = accepted.find((candidate) => candidate.id === "uneven-confidence");
    const balanced = accepted.find((candidate) => candidate.id === "balanced-confidence");
    if (!unchanged(candidateById(result, "uneven-confidence"), uneven)) {
      throw new Error(`Sparse weakest-side evidence appeared artificially consistent for order ${accepted.map((item) => item.id).join(", ")}`);
    }
    const repaired = candidateById(result, "balanced-confidence");
    if (repaired.box.width <= balanced.box.width || repaired.box.height <= balanced.box.height) {
      throw new Error(`Balanced sample confidence should receive the bounded repair regardless of input order: ${JSON.stringify(repaired.box)}`);
    }
  }
  console.log("Strength-confidence runtime smoke passed: equally dense frames no longer let a sparsely supported side appear artificially consistent.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
