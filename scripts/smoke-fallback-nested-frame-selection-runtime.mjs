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
if (!adapterSource.includes("const overlappingCandidates = next")) {
  throw new Error("Nested-frame runtime smoke requires deterministic overlap selection.");
}
if (!adapterSource.includes("perimeterSides:")) {
  throw new Error("Nested-frame runtime smoke requires perimeter-quality overlap selection.");
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
const middle = {
  id: "middle-inset-frame",
  box: { x: 31, y: 31, width: 38, height: 38 },
  points: [
    { x: 31, y: 31 }, { x: 69, y: 31 }, { x: 69, y: 69 }, { x: 31, y: 69 }
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

function assertUnchanged(candidate, expected, context) {
  if (
    candidate.box.x !== expected.box.x || candidate.box.y !== expected.box.y ||
    candidate.box.width !== expected.box.width || candidate.box.height !== expected.box.height
  ) {
    throw new Error(`${context}: expected ${JSON.stringify(expected.box)}, got ${JSON.stringify(candidate.box)}`);
  }
}

const hierarchyOrders = [
  [inner, middle, decoy], [inner, decoy, middle], [middle, inner, decoy],
  [middle, decoy, inner], [decoy, inner, middle], [decoy, middle, inner]
];

try {
  const { addFallbackCandidates } = await import(pathToFileURL(emittedAdapterPath).href);

  const modestRepairEdges = [];
  addClosedFrame(modestRepairEdges, 32, 32, 68, 68);
  const modestRepair = addFallbackCandidates([inner], modestRepairEdges, bounds);
  const repairedInner = candidateById(modestRepair, inner.id);
  if (repairedInner.box.width <= inner.box.width || repairedInner.box.height <= inner.box.height) {
    throw new Error(`A bounded outer repair should still enlarge the incomplete inner opening: ${JSON.stringify(repairedInner.box)}`);
  }

  const sparseInner = {
    ...inner,
    id: "sparse-inner-fragment",
    points: [{ x: 35, y: 35 }, { x: 50, y: 35 }, { x: 35, y: 50 }]
  };
  const completeMiddle = {
    ...middle,
    id: "complete-middle-frame",
    box: { x: 33, y: 33, width: 34, height: 34 },
    points: [
      { x: 33, y: 33 }, { x: 67, y: 33 }, { x: 67, y: 67 }, { x: 33, y: 67 }
    ]
  };
  for (const accepted of [[sparseInner, completeMiddle], [completeMiddle, sparseInner]]) {
    const result = addFallbackCandidates(accepted, modestRepairEdges, bounds);
    assertUnchanged(
      candidateById(result, sparseInner.id),
      sparseInner,
      `Sparse inner fragment outranked a complete nested frame for order ${accepted.map((item) => item.id).join(", ")}`
    );
    const repairedComplete = candidateById(result, completeMiddle.id);
    if (repairedComplete.box.width <= completeMiddle.box.width || repairedComplete.box.height <= completeMiddle.box.height) {
      throw new Error(`Complete nested frame should receive the bounded repair regardless of input order: ${JSON.stringify(repairedComplete.box)}`);
    }
  }

  const oversizedOuterEdges = [];
  addClosedFrame(oversizedOuterEdges, 27, 27, 73, 73);
  for (const accepted of hierarchyOrders) {
    const result = addFallbackCandidates(accepted, oversizedOuterEdges, bounds);
    assertUnchanged(
      candidateById(result, inner.id),
      inner,
      `Oversized outer trim replaced the inner projectable surface for order ${accepted.map((item) => item.id).join(", ")}`
    );
    assertUnchanged(
      candidateById(result, middle.id),
      middle,
      `Oversized outer trim mutated the competing middle frame for order ${accepted.map((item) => item.id).join(", ")}`
    );
  }

  console.log("Nested fallback selection runtime smoke passed: bounded repairs remain eligible, complete perimeter evidence outranks sparse nested fragments across input orders, and oversized outer frames preserve established projectable surfaces.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
