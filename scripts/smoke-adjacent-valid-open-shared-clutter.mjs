import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-adjacent-valid-open-shared-clutter-"));
const tempPath = path.join(tempDir, "core", "architecturalDetector.js");

execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    detectorPath,
    "--ignoreConfig",
    "--outDir",
    tempDir,
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

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);
  const scene = [];
  const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

  const valid = { left: 12, right: 30, top: 17, bottom: 53 };
  const invalid = { left: 35, right: 53, top: 17, bottom: 53 };
  const weakStrength = 0.62;

  // Real opening: a weak frame with a corner and short facing-edge section hidden.
  for (let x = valid.left + 6; x <= valid.right; x += 1) addPoint(x, valid.top, weakStrength);
  for (let x = valid.left; x <= valid.right; x += 1) addPoint(x, valid.bottom, weakStrength);
  for (let y = valid.top; y <= valid.bottom; y += 1) {
    if (y >= 29 && y <= 36) continue;
    addPoint(valid.right, y, weakStrength);
  }
  for (let y = valid.top + 13; y <= valid.bottom; y += 1) addPoint(valid.left, y, weakStrength);

  // Adjacent false outline: comparable size and strength, but genuinely open along its
  // top-left corner and most of its outer-left edge.
  for (let x = invalid.left + 10; x <= invalid.right; x += 1) addPoint(x, invalid.top, weakStrength);
  for (let x = invalid.left; x <= invalid.right; x += 1) addPoint(x, invalid.bottom, weakStrength);
  for (let y = invalid.top; y <= invalid.bottom; y += 1) addPoint(invalid.right, y, weakStrength);
  for (let y = invalid.top + 24; y <= invalid.bottom; y += 1) addPoint(invalid.left, y, weakStrength);

  // Shared foreground clutter crosses the real opening, the narrow gap, and the open
  // fragment. It must not transfer closure evidence from the valid frame to its neighbor.
  for (let offset = 0; offset <= 52; offset += 1) {
    const x = 8 + offset;
    const y = 21 + Math.floor(offset * 0.31);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.34);
  }
  for (let offset = 0; offset <= 45; offset += 1) {
    const x = 14 + offset;
    const y = 47 - Math.floor(offset * 0.28);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.32);
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 70
  });

  const matches = (candidate, expected) =>
    candidate.x >= expected.left - 2 &&
    candidate.x <= expected.left + 3 &&
    candidate.y >= expected.top - 2 &&
    candidate.y <= expected.top + 3 &&
    candidate.width >= expected.right - expected.left - 2 &&
    candidate.width <= expected.right - expected.left + 5 &&
    candidate.height >= expected.bottom - expected.top - 3 &&
    candidate.height <= expected.bottom - expected.top + 5;

  const validOpening = candidates.find((candidate) => matches(candidate, valid));
  const falseOpening = candidates.find((candidate) => matches(candidate, invalid));
  const mergedOpening = candidates.find(
    (candidate) =>
      candidate.x <= valid.left + 3 &&
      candidate.x + candidate.width >= invalid.right - 3 &&
      candidate.y <= valid.top + 3 &&
      candidate.y + candidate.height >= valid.bottom - 3
  );

  if (!validOpening || falseOpening || mergedOpening) {
    const failure = { validOpening, falseOpening, mergedOpening, candidates };
    await fs.writeFile(
      "adjacent-valid-open-shared-clutter-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("Adjacent valid/open shared-clutter regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "Adjacent valid/open shared-clutter smoke passed: the real opening survived, the neighboring open fragment stayed rejected, and no merged mask borrowed closure through the clutter."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}

await import("./smoke-tight-gap-valid-open-shared-clutter.mjs");
