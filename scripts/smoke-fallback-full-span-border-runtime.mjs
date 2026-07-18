import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-full-span-border-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
const testableAdapterSource = adapterSource
  .replace("function hasDistributedFullSpanPerimeter", "export function hasDistributedFullSpanPerimeter")
  .replace("function buildFallbackComponents", "export function buildFallbackComponents");
await fs.writeFile(sourcePath, testableAdapterSource);
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

function addClosedFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

function addOccludedTopFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  const gapStart = x1 + Math.floor((x2 - x1) * 0.42);
  const gapEnd = x1 + Math.ceil((x2 - x1) * 0.58);
  for (let x = x1; x <= x2; x += 1) {
    if (x < gapStart || x > gapEnd) edgePoints.push({ x, y: y1, strength });
    edgePoints.push({ x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

function addCornerConcentratedFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
  for (let offset = 0; offset <= 5; offset += 1) {
    edgePoints.push(
      { x: x1 + offset, y: y1, strength },
      { x: x2 - offset, y: y1, strength },
      { x: x1 + offset, y: y2, strength },
      { x: x2 - offset, y: y2, strength }
    );
  }
}

function addWeakPerimeterTouches(edgePoints, x1, y1, x2, y2, strength = 220) {
  const xs = [x1 + 3, Math.round((x1 + x2) / 2), x2 - 3];
  const ys = [y1 + 3, Math.round((y1 + y2) / 2), y2 - 3];
  for (const x of xs) {
    edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  }
  for (const y of ys) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

function addDuplicatedPerimeterTouches(edgePoints, x1, y1, x2, y2, strength = 220) {
  const xs = [x1 + 3, Math.round((x1 + x2) / 2), x2 - 3];
  const ys = [y1 + 3, Math.round((y1 + y2) / 2), y2 - 3];
  for (const x of xs) {
    for (let repeat = 0; repeat < 4; repeat += 1) {
      edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
    }
  }
  for (const y of ys) {
    for (let repeat = 0; repeat < 4; repeat += 1) {
      edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
    }
  }
}

try {
  const { buildFallbackComponents, hasDistributedFullSpanPerimeter } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const normalDoorEdges = [];
  addClosedFrame(normalDoorEdges, 40, 15, 60, 82);
  const normalDoor = buildFallbackComponents(normalDoorEdges, bounds);
  if (normalDoor.length !== 1) throw new Error(`Normal closed doorway should remain eligible, got ${JSON.stringify(normalDoor)}`);

  const largeTallOpeningEdges = [];
  addClosedFrame(largeTallOpeningEdges, 35, 5, 65, 95);
  const largeTallOpening = buildFallbackComponents(largeTallOpeningEdges, bounds);
  if (largeTallOpening.length !== 1) throw new Error(`Large closed architectural opening should remain eligible, got ${JSON.stringify(largeTallOpening)}`);

  const occludedLargeOpeningEdges = [];
  addOccludedTopFrame(occludedLargeOpeningEdges, 35, 5, 65, 95);
  const occludedLargeOpening = buildFallbackComponents(occludedLargeOpeningEdges, bounds);
  if (occludedLargeOpening.length !== 1) throw new Error(`Singly occluded opening should remain eligible, got ${JSON.stringify(occludedLargeOpening)}`);

  const weakPerimeterEdges = [];
  addWeakPerimeterTouches(weakPerimeterEdges, 35, 5, 65, 95);
  if (hasDistributedFullSpanPerimeter(weakPerimeterEdges, { x: 35, y: 5, width: 30, height: 90 })) {
    throw new Error("Single stray edge points must not count as supported perimeter thirds.");
  }

  const duplicatedPerimeterEdges = [];
  addDuplicatedPerimeterTouches(duplicatedPerimeterEdges, 35, 5, 65, 95);
  if (hasDistributedFullSpanPerimeter(duplicatedPerimeterEdges, { x: 35, y: 5, width: 30, height: 90 })) {
    throw new Error("Repeated reports of the same pixels must not count as distinct structural evidence.");
  }

  const cornerConcentratedOpeningEdges = [];
  addCornerConcentratedFrame(cornerConcentratedOpeningEdges, 35, 5, 65, 95);
  const cornerConcentratedOpening = buildFallbackComponents(cornerConcentratedOpeningEdges, bounds);
  if (cornerConcentratedOpening.length !== 0) throw new Error(`Corner-concentrated outline should be rejected, got ${JSON.stringify(cornerConcentratedOpening)}`);

  const fullHeightBorderEdges = [];
  addClosedFrame(fullHeightBorderEdges, 45, 5, 55, 95);
  const fullHeightBorder = buildFallbackComponents(fullHeightBorderEdges, bounds);
  if (fullHeightBorder.length !== 0) throw new Error(`Near-full-height narrow border should be rejected, got ${JSON.stringify(fullHeightBorder)}`);

  const fullWidthBorderEdges = [];
  addClosedFrame(fullWidthBorderEdges, 5, 45, 95, 55);
  const fullWidthBorder = buildFallbackComponents(fullWidthBorderEdges, bounds);
  if (fullWidthBorder.length !== 0) throw new Error(`Near-full-width narrow border should be rejected, got ${JSON.stringify(fullWidthBorder)}`);

  console.log("Full-span fallback runtime smoke passed: complete and singly occluded openings accepted; duplicate-pixel, stray-point, corner-concentrated, and narrow border masks rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
