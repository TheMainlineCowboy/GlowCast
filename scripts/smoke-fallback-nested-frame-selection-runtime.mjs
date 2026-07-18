import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

if (!adapterSource.includes("preservesNestedProjectableSurface")) {
  throw new Error("Nested-frame runtime smoke requires the prepared nested fallback selection gate.");
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-nested-frame-selection-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function addFallbackCandidates", "export function addFallbackCandidates")
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

function addClosedFrame(edgePoints, x1, y1, x2, y2, strength = 230) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

const inner = {
  id: "inner-projectable-surface",
  box: { x: 35, y: 35, width: 30, height: 30 },
  points: [
    { x: 35, y: 35 }, { x: 65, y: 35 }, { x: 65, y: 65 }, { x: 35, y: 65 }
  ]
};
const decoy = {
  id: "separate-opening",
  box: { x: 5, y: 5, width: 12, height: 18 },
  points: [
    { x: 5, y: 5 }, { x: 17, y: 5 }, { x: 17, y: 23 }, { x: 5, y: 23 }
  ]
};
const bounds = { x: 0, y: 0, width: 100, height: 100 };

function candidateById(candidates, id) {
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Expected candidate ${id}, got ${JSON.stringify(candidates)}`);
  return candidate;
}

try {
  const { addFallbackCandidates } = await import(pathToFileURL(emittedAdapterPath).href);

  const modestRepairEdges = [];
  addClosedFrame(modestRepairEdges, 32, 32, 68, 68);
  const modestRepair = addFallbackCandidates([inner], modestRepairEdges, bounds);
  const repairedInner = candidateById(modestRepair, inner.id);
  if (repairedInner.box.width <= inner.box.width || repairedInner.box.height <= inner.box.height) {
    throw new Error(`A bounded outer repair should still enlarge the incomplete inner opening: ${JSON.stringify(repairedInner.box)}`);
  }

  const oversizedOuterEdges = [];
  addClosedFrame(oversizedOuterEdges, 27, 27, 73, 73);
  for (const accepted of [[inner, decoy], [decoy, inner]]) {
    const result = addFallbackCandidates(accepted, oversizedOuterEdges, bounds);
    const preservedInner = candidateById(result, inner.id);
    if (
      preservedInner.box.x !== inner.box.x || preservedInner.box.y !== inner.box.y ||
      preservedInner.box.width !== inner.box.width || preservedInner.box.height !== inner.box.height
    ) {
      throw new Error(`Oversized outer trim replaced the inner projectable surface when candidate order was ${accepted.map((item) => item.id).join(", ")}: ${JSON.stringify(preservedInner.box)}`);
    }
  }

  console.log("Nested fallback selection runtime smoke passed: bounded repairs remain eligible, oversized outer frames preserve the inner projectable surface, and candidate ordering does not change the result.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
