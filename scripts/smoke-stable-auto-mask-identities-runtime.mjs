import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

if (!adapterSource.includes("function stableMaskGeometryId")) {
  throw new Error("Stable auto-mask runtime smoke requires prepared stableMaskGeometryId source.");
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-stable-mask-id-runtime-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function stableMaskGeometryId", "export function stableMaskGeometryId")
);
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc",
  sourcePath,
  "--ignoreConfig",
  "--rootDir", sourceRoot,
  "--outDir", outDir,
  "--module", "ES2020",
  "--target", "ES2020",
  "--moduleResolution", "Bundler",
  "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
await fs.writeFile(emittedAdapterPath, (await fs.readFile(emittedAdapterPath, "utf8")).replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, (await fs.readFile(emittedDetectorPath, "utf8")).replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

const box = { x: 10, y: 20, width: 30, height: 40 };
const outline = [
  { x: 10, y: 20 },
  { x: 40, y: 20 },
  { x: 40, y: 60 },
  { x: 10, y: 60 }
];
const rotated = [outline[2], outline[3], outline[0], outline[1]];
const reversed = [...outline].reverse();
const tinyJitter = outline.map((point, index) => ({
  x: point.x + (index % 2 === 0 ? 0.01 : -0.01),
  y: point.y + (index % 2 === 0 ? -0.01 : 0.01)
}));
const crossedConnectivity = [outline[0], outline[2], outline[1], outline[3]];

try {
  const { stableMaskGeometryId } = await import(pathToFileURL(emittedAdapterPath).href);
  const baseline = stableMaskGeometryId("mask_candidate", box, outline);
  const equivalentIds = [
    stableMaskGeometryId("mask_candidate", box, rotated),
    stableMaskGeometryId("mask_candidate", box, reversed),
    stableMaskGeometryId("mask_candidate", box, tinyJitter)
  ];

  if (equivalentIds.some((id) => id !== baseline)) {
    console.error("Stable auto-mask identity runtime smoke failed: equivalent outline traversal or sub-quantization jitter changed identity.");
    console.error(JSON.stringify({ baseline, equivalentIds }, null, 2));
    process.exit(1);
  }

  const distinct = stableMaskGeometryId("mask_candidate", box, crossedConnectivity);
  if (distinct === baseline) {
    console.error("Stable auto-mask identity runtime smoke failed: different edge connectivity collided at runtime.");
    console.error(JSON.stringify({ baseline, distinct }, null, 2));
    process.exit(1);
  }

  console.log("Stable auto-mask identity runtime smoke passed: rotation, traversal direction, and tiny jitter remain stable while different connectivity stays distinct.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
