import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
let adapterSource = await fs.readFile(adapterPath, "utf8");
const detectorSource = await fs.readFile(detectorPath, "utf8");

// The adapter imports the detector through TypeScript path resolution in the app.
// This smoke test composes both files into one temporary module so Node can execute
// the same exported adapter function without a bundler.
adapterSource = adapterSource
  .replace(/import type \{ EdgePoint \} from "\.\.\/edgeDetect";\n/, "")
  .replace(/import \{ detectArchitecturalCandidates \} from "\.\/architecturalDetector";\n/, "");

const composedSource = `${detectorSource}\n${adapterSource}\n`;
const transpiled = ts.transpileModule(composedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const tempPath = path.join(os.tmpdir(), `glowcast-mask-adapter-${Date.now()}.mjs`);
await fs.writeFile(tempPath, transpiled);

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
  const { buildMaskCandidatesFromEdges } = await import(pathToFileURL(tempPath).href);

  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const edgePoints = [];
  const add = (x, y, strength = 180) => edgePoints.push({ x, y, strength });

  // Two plausible architectural frames.
  addFrame(edgePoints, 18, 20, 42, 42);
  addFrame(edgePoints, 58, 22, 82, 48);

  // A tiny trim/noise fragment that should not become a user-facing mask.
  for (let x = 7; x <= 9; x += 1) add(x, 72, 220);
  for (let y = 72; y <= 74; y += 1) add(7, y, 220);

  const masks = buildMaskCandidatesFromEdges(edgePoints, bounds);

  if (masks.length < 2) {
    console.error("Mask adapter smoke test failed. Expected at least two architectural masks.");
    console.error(JSON.stringify(masks, null, 2));
    process.exit(1);
  }

  const tinyMask = masks.find((mask) => mask.box.width < 6 || mask.box.height < 6);
  if (tinyMask) {
    console.error("Mask adapter smoke test failed. Tiny fragment survived adapter filtering.");
    console.error(JSON.stringify(masks, null, 2));
    process.exit(1);
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

  if (duplicate) {
    console.error("Mask adapter smoke test failed. Duplicate overlapping masks survived adapter dedupe.");
    console.error(JSON.stringify(masks, null, 2));
    process.exit(1);
  }

  const groupedEdges = [];
  // Central window frame plus two close side shutters/trim strips. These should
  // become one user-facing mask instead of three separate projection holes.
  addFrame(groupedEdges, 42, 24, 62, 52);
  addFrame(groupedEdges, 34, 25, 38, 51, 190);
  addFrame(groupedEdges, 66, 25, 70, 51, 190);

  const groupedMasks = buildMaskCandidatesFromEdges(groupedEdges, bounds);
  const groupedMaskCount = groupedMasks.filter((mask) => mask.box.y < 58 && mask.box.y + mask.box.height > 20).length;

  if (groupedMaskCount > 1 || !hasBoxCovering(groupedMasks, { x: 34, y: 24, width: 36, height: 28, tolerance: 2 })) {
    console.error("Mask adapter smoke test failed. Nearby shutters/trim were not grouped into the parent mask.");
    console.error(JSON.stringify(groupedMasks, null, 2));
    process.exit(1);
  }

  const fallbackEdges = [];
  // Deliberately incomplete edges: only an L-shape and partial lower/right traces.
  // The main closed-frame detector may miss this, but the adapter fallback should
  // still produce one conservative rectangular user-facing mask.
  for (let x = 18; x <= 52; x += 1) fallbackEdges.push({ x, y: 62, strength: 190 });
  for (let y = 62; y <= 84; y += 1) fallbackEdges.push({ x: 18, y, strength: 190 });
  for (let x = 35; x <= 52; x += 1) fallbackEdges.push({ x, y: 84, strength: 185 });
  for (let y = 70; y <= 84; y += 1) fallbackEdges.push({ x: 52, y, strength: 185 });

  const fallbackMasks = buildMaskCandidatesFromEdges(fallbackEdges, bounds);
  if (!hasBoxCovering(fallbackMasks, { x: 18, y: 62, width: 34, height: 22, tolerance: 3 })) {
    console.error("Mask adapter smoke test failed. Broken-edge fallback did not produce a conservative mask.");
    console.error(JSON.stringify(fallbackMasks, null, 2));
    process.exit(1);
  }

  console.log(
    `Mask adapter smoke test passed: ${masks.length} masks, no tiny fragments or duplicates, satellite grouping and fallback ok.`
  );
} finally {
  await fs.rm(tempPath, { force: true });
}
