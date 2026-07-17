import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

if (adapterSource.includes("points: boxPoints(mergedBox)")) {
  console.error("Mask adapter smoke test failed. Grouped satellite masks still discard custom outline points.");
  process.exit(1);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-mask-adapter-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");
const tempPath = path.join(outDir, "core", "maskCandidateAdapter.js");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function addFallbackCandidates", "export function addFallbackCandidates")
);
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

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
const emittedAdapter = await fs.readFile(emittedAdapterPath, "utf8");
const emittedDetector = await fs.readFile(emittedDetectorPath, "utf8");
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

function hasBoxCovering(masks, expected) {
  return masks.some(
    (mask) =>
      mask.box.x <= expected.x + expected.tolerance &&
      mask.box.y <= expected.y + expected.tolerance &&
      mask.box.x + mask.box.width >= expected.x + expected.width - expected.tolerance &&
      mask.box.y + mask.box.height >= expected.y + expected.height - expected.tolerance
  );
}

try {
  const { buildMaskCandidatesFromEdges, addFallbackCandidates } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const replacementEdges = [];
  addFrame(replacementEdges, 10, 10, 42, 42, 210);
  const replacedFallbacks = addFallbackCandidates(
    [{
      id: "seed_fragment",
      box: { x: 14, y: 14, width: 24, height: 24 },
      points: [{ x: 14, y: 14 }, { x: 38, y: 14 }, { x: 38, y: 38 }, { x: 14, y: 38 }]
    }],
    replacementEdges,
    bounds
  );
  if (replacedFallbacks.length !== 1 || replacedFallbacks[0].id !== "seed_fragment") {
    throw new Error(`Larger fallback created a duplicate: ${JSON.stringify(replacedFallbacks)}`);
  }
  if (!hasBoxCovering(replacedFallbacks, { x: 10, y: 10, width: 32, height: 32, tolerance: 2 })) {
    throw new Error(`Bounded fallback did not repair fragment bounds: ${JSON.stringify(replacedFallbacks)}`);
  }

  const edgePoints = [];
  addFrame(edgePoints, 18, 20, 42, 42);
  addFrame(edgePoints, 58, 22, 82, 48);
  for (let x = 7; x <= 9; x += 1) edgePoints.push({ x, y: 72, strength: 220 });
  for (let y = 72; y <= 74; y += 1) edgePoints.push({ x: 7, y, strength: 220 });

  const masks = buildMaskCandidatesFromEdges(edgePoints, bounds);
  if (masks.length < 2) throw new Error(`Expected at least two architectural masks: ${JSON.stringify(masks)}`);
  if (masks.some((mask) => mask.box.width < 6 || mask.box.height < 6)) {
    throw new Error(`Tiny fragment survived adapter filtering: ${JSON.stringify(masks)}`);
  }

  const duplicate = masks.some((mask, index) => {
    const area = mask.box.width * mask.box.height;
    return masks.slice(index + 1).some((other) => {
      const x1 = Math.max(mask.box.x, other.box.x);
      const y1 = Math.max(mask.box.y, other.box.y);
      const x2 = Math.min(mask.box.x + mask.box.width, other.box.x + other.box.width);
      const y2 = Math.min(mask.box.y + mask.box.height, other.box.y + other.box.height);
      if (x2 <= x1 || y2 <= y1) return false;
      const overlap = (x2 - x1) * (y2 - y1);
      const otherArea = other.box.width * other.box.height;
      return overlap / Math.max(Math.min(area, otherArea), 1) > 0.74;
    });
  });
  if (duplicate) throw new Error(`Duplicate overlapping masks survived dedupe: ${JSON.stringify(masks)}`);

  const groupedEdges = [];
  addFrame(groupedEdges, 42, 24, 62, 52);
  addFrame(groupedEdges, 32, 25, 40, 51, 190);
  addFrame(groupedEdges, 64, 25, 72, 51, 190);
  const groupedMasks = buildMaskCandidatesFromEdges(groupedEdges, bounds);
  const groupedMaskCount = groupedMasks.filter((mask) => mask.box.y < 58 && mask.box.y + mask.box.height > 20).length;
  if (groupedMaskCount > 1 || !hasBoxCovering(groupedMasks, { x: 32, y: 24, width: 40, height: 28, tolerance: 2 })) {
    throw new Error(`Nearby shutters/trim were not grouped: ${JSON.stringify(groupedMasks)}`);
  }

  const fallbackEdges = [];
  for (let x = 18; x <= 52; x += 1) fallbackEdges.push({ x, y: 62, strength: 190 });
  for (let y = 62; y <= 84; y += 1) fallbackEdges.push({ x: 18, y, strength: 190 });
  for (let x = 18; x <= 52; x += 1) fallbackEdges.push({ x, y: 84, strength: 185 });
  for (let y = 70; y <= 84; y += 1) fallbackEdges.push({ x: 52, y, strength: 185 });
  const fallbackMasks = buildMaskCandidatesFromEdges(fallbackEdges, bounds);
  const fallbackMask = fallbackMasks.find((mask) =>
    mask.box.x <= 21 && mask.box.y <= 65 &&
    mask.box.x + mask.box.width >= 49 && mask.box.y + mask.box.height >= 81
  );
  if (!fallbackMask) throw new Error(`Broken-edge fallback produced no conservative mask: ${JSON.stringify(fallbackMasks)}`);
  if (!Array.isArray(fallbackMask.points) || fallbackMask.points.length < 3) {
    throw new Error(`Broken-edge fallback lost outline points: ${JSON.stringify(fallbackMasks)}`);
  }

  const trimOnlyEdges = [];
  for (let x = 20; x <= 72; x += 1) trimOnlyEdges.push({ x, y: 88, strength: 210 });
  const trimOnlyMasks = buildMaskCandidatesFromEdges(trimOnlyEdges, bounds);
  if (trimOnlyMasks.length > 0) throw new Error(`Single trim line became a fallback mask: ${JSON.stringify(trimOnlyMasks)}`);

  console.log(
    `Mask adapter smoke test passed: ${masks.length} masks, no tiny fragments or duplicates, satellite grouping, bounded fallback replacement and fallback recovery ok.`
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
