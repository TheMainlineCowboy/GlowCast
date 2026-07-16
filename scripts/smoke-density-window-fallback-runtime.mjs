import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-density-fallback-runtime-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function buildDensityWindowFallbacks", "export function buildDensityWindowFallbacks"));
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", sourcePath, "--ignoreConfig", "--rootDir", sourceRoot,
  "--outDir", outDir, "--module", "ES2020", "--target", "ES2020",
  "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
await fs.writeFile(emittedAdapterPath, (await fs.readFile(emittedAdapterPath, "utf8")).replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, (await fs.readFile(emittedDetectorPath, "utf8")).replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

const bounds = { x: 0, y: 0, width: 100, height: 100 };
const columns = 48;
const rows = 36;
const edges = [];

function addCell(column, row, repeats = 4, strength = 255) {
  for (let index = 0; index < repeats; index += 1) {
    edges.push({
      x: ((column + 0.2 + index * 0.12) / columns) * bounds.width,
      y: ((row + 0.2 + index * 0.12) / rows) * bounds.height,
      strength
    });
  }
}

function addFrame(left, top, width, height, { openBottom = false, solid = false } = {}) {
  const right = left + width - 1;
  const bottom = top + height - 1;
  for (let column = left; column <= right; column += 1) {
    addCell(column, top);
    if (!openBottom) addCell(column, bottom);
  }
  for (let row = top; row <= bottom; row += 1) {
    addCell(left, row);
    addCell(right, row);
  }
  if (solid) {
    for (let row = top + 1; row < bottom; row += 1) {
      for (let column = left + 1; column < right; column += 1) addCell(column, row, 3);
    }
  }
}

// A genuinely closed hollow opening should be recovered.
addFrame(5, 7, 11, 10);
// A uniformly dense rectangle should not be mistaken for a hollow opening.
addFrame(22, 7, 11, 10, { solid: true });
// A three-sided frame should remain rejected.
addFrame(36, 7, 9, 10, { openBottom: true });

function contains(box, x, y) {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

try {
  const { buildDensityWindowFallbacks } = await import(pathToFileURL(emittedAdapterPath).href);
  const result = buildDensityWindowFallbacks(edges, bounds);
  const closedCenter = { x: ((5 + 5.5) / columns) * 100, y: ((7 + 5) / rows) * 100 };
  const solidCenter = { x: ((22 + 5.5) / columns) * 100, y: ((7 + 5) / rows) * 100 };
  const openCenter = { x: ((36 + 4.5) / columns) * 100, y: ((7 + 5) / rows) * 100 };

  const closedMatches = result.filter((candidate) => contains(candidate, closedCenter.x, closedCenter.y));
  const solidMatches = result.filter((candidate) => contains(candidate, solidCenter.x, solidCenter.y));
  const openMatches = result.filter((candidate) => contains(candidate, openCenter.x, openCenter.y));

  if (closedMatches.length !== 1) {
    console.error("Density fallback runtime smoke failed: expected one recovered closed hollow opening.");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (solidMatches.length > 0) {
    console.error("Density fallback runtime smoke failed: solid texture patch produced a mask.");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (openMatches.length > 0) {
    console.error("Density fallback runtime smoke failed: three-sided frame produced a mask.");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (result.length !== 1) {
    console.error("Density fallback runtime smoke failed: overlapping or unrelated proposals were not suppressed.");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("Density fallback runtime smoke passed: recovered the closed hollow opening while rejecting solid texture, a three-sided frame, and duplicate proposals.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
