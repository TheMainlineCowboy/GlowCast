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

function addScatteredDistinctPerimeterTouches(edgePoints, x1, y1, x2, y2, strength = 220) {
  const xThird = (x2 - x1) / 3;
  const yThird = (y2 - y1) / 3;
  for (let bucket = 0; bucket < 3; bucket += 1) {
    const xStart = x1 + bucket * xThird;
    const yStart = y1 + bucket * yThird;
    const xs = [Math.round(xStart + 1), Math.round(xStart + xThird - 1)];
    const ys = [Math.round(yStart + 1), Math.round(yStart + yThird - 1)];
    for (const x of xs) edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
    for (const y of ys) edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

function addShortRunsPerBucket(edgePoints, x1, y1, x2, y2, runLength, sampleStep = 1, strength = 220) {
  const xThird = (x2 - x1) / 3;
  const yThird = (y2 - y1) / 3;
  for (let bucket = 0; bucket < 3; bucket += 1) {
    const xStart = Math.round(x1 + bucket * xThird + 3);
    const yStart = Math.round(y1 + bucket * yThird + 3);
    for (let offset = 0; offset < runLength; offset += 1) {
      const distance = offset * sampleStep;
      edgePoints.push(
        { x: xStart + distance, y: y1, strength },
        { x: xStart + distance, y: y2, strength },
        { x: x1, y: yStart + distance, strength },
        { x: x2, y: yStart + distance, strength }
      );
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

  const scatteredDistinctEdges = [];
  addScatteredDistinctPerimeterTouches(scatteredDistinctEdges, 35, 5, 65, 95);
  if (hasDistributedFullSpanPerimeter(scatteredDistinctEdges, { x: 35, y: 5, width: 30, height: 90 })) {
    throw new Error("Separated edge points must not imitate continuous architectural perimeter runs.");
  }

  const highResolutionShortRuns = [];
  addShortRunsPerBucket(highResolutionShortRuns, 100, 50, 900, 950, 3);
  if (hasDistributedFullSpanPerimeter(highResolutionShortRuns, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Three-pixel noise runs must not qualify on high-resolution architectural openings.");
  }

  const highResolutionSupportedRuns = [];
  addShortRunsPerBucket(highResolutionSupportedRuns, 100, 50, 900, 950, 5);
  if (!hasDistributedFullSpanPerimeter(highResolutionSupportedRuns, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Scaled continuous perimeter runs should support a high-resolution architectural opening.");
  }

  const highResolutionSampledRuns = [];
  addShortRunsPerBucket(highResolutionSampledRuns, 100, 50, 900, 950, 5, 2);
  if (!hasDistributedFullSpanPerimeter(highResolutionSampledRuns, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Legitimate high-resolution frames sampled every two pixels should remain continuous.");
  }

  const highResolutionDistantNoise = [];
  addShortRunsPerBucket(highResolutionDistantNoise, 100, 50, 900, 950, 5, 5);
  if (hasDistributedFullSpanPerimeter(highResolutionDistantNoise, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Five-pixel-spaced noise must not be joined into a continuous architectural frame.");
  }

  const exactHighResolutionPerimeter = [];
  addShortRunsPerBucket(exactHighResolutionPerimeter, 100, 50, 900, 950, 5, 2);
  if (!hasDistributedFullSpanPerimeter(exactHighResolutionPerimeter, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Evidence on the actual high-resolution opening perimeter should be accepted.");
  }

  const parallelNearbyTrim = [];
  addShortRunsPerBucket(parallelNearbyTrim, 109, 59, 891, 941, 5, 2);
  if (hasDistributedFullSpanPerimeter(parallelNearbyTrim, { x: 100, y: 50, width: 800, height: 900 })) {
    throw new Error("Continuous trim lines running beside an opening must not count as its structural perimeter.");
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

  console.log("Full-span fallback runtime smoke passed: compact, large, sampled, and singly occluded openings accepted; nearby parallel trim, distant high-resolution noise, short runs, scattered, duplicate-pixel, stray-point, corner-concentrated, and narrow border masks rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
