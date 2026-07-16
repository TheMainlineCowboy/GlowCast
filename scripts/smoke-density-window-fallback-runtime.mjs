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

function makeFrame({ left = 5, top = 7, width = 11, height = 10, openBottom = false, solid = false } = {}) {
  const edges = [];
  const right = left + width - 1;
  const bottom = top + height - 1;
  const addCell = (column, row, repeats = 5) => {
    for (let index = 0; index < repeats; index += 1) {
      edges.push({
        x: ((column + 0.18 + index * 0.1) / columns) * bounds.width,
        y: ((row + 0.18 + index * 0.1) / rows) * bounds.height,
        strength: 255
      });
    }
  };

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
      for (let column = left + 1; column < right; column += 1) addCell(column, row, 4);
    }
  }
  return edges;
}

function overlapRatio(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  return intersection / Math.max(0.01, Math.min(a.width * a.height, b.width * b.height));
}

try {
  const { buildDensityWindowFallbacks } = await import(pathToFileURL(emittedAdapterPath).href);
  const closed = buildDensityWindowFallbacks(makeFrame(), bounds);
  const solid = buildDensityWindowFallbacks(makeFrame({ solid: true }), bounds);
  const open = buildDensityWindowFallbacks(makeFrame({ openBottom: true }), bounds);

  if (closed.length < 1) {
    console.error("Density fallback runtime smoke failed: closed hollow opening was not recovered.");
    process.exit(1);
  }
  if (solid.length !== 0) {
    console.error("Density fallback runtime smoke failed: solid texture patch produced a mask.");
    console.error(JSON.stringify(solid, null, 2));
    process.exit(1);
  }
  if (open.length !== 0) {
    console.error("Density fallback runtime smoke failed: three-sided frame produced a mask.");
    console.error(JSON.stringify(open, null, 2));
    process.exit(1);
  }
  for (let first = 0; first < closed.length; first += 1) {
    for (let second = first + 1; second < closed.length; second += 1) {
      if (overlapRatio(closed[first], closed[second]) > 0.48) {
        console.error("Density fallback runtime smoke failed: overlapping duplicate proposals survived suppression.");
        console.error(JSON.stringify(closed, null, 2));
        process.exit(1);
      }
    }
  }
  if (closed.length > 6) {
    console.error("Density fallback runtime smoke failed: recovery exceeded the six-mask safety cap.");
    process.exit(1);
  }

  console.log("Density fallback runtime smoke passed: recovered a closed hollow opening while rejecting solid texture, a three-sided frame, and overlapping duplicates.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
