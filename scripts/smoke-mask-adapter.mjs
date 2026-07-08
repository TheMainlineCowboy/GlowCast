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

try {
  const { buildMaskCandidatesFromEdges } = await import(pathToFileURL(tempPath).href);

  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const edgePoints = [];
  const add = (x, y, strength = 180) => edgePoints.push({ x, y, strength });

  // Two plausible architectural frames.
  for (let x = 18; x <= 42; x += 1) {
    add(x, 20);
    add(x, 42);
  }
  for (let y = 20; y <= 42; y += 1) {
    add(18, y);
    add(42, y);
  }

  for (let x = 58; x <= 82; x += 1) {
    add(x, 22);
    add(x, 48);
  }
  for (let y = 22; y <= 48; y += 1) {
    add(58, y);
    add(82, y);
  }

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

  console.log(`Mask adapter smoke test passed: ${masks.length} masks, no tiny fragments or duplicates.`);
} finally {
  await fs.rm(tempPath, { force: true });
}
