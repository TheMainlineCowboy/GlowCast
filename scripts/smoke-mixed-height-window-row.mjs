import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-mixed-height-row-"));
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

  // Three neighboring windows with intentionally different sill and header heights.
  for (const [left, right, top, bottom, strength] of [
    [8, 20, 14, 34, 0.94],
    [25, 37, 20, 43, 0.72],
    [42, 54, 9, 37, 0.9]
  ]) {
    for (let x = left; x <= right; x += 1) {
      addPoint(x, top, strength);
      addPoint(x, bottom, strength);
    }
    for (let y = top; y <= bottom; y += 1) {
      addPoint(left, y, strength);
      addPoint(right, y, strength);
    }
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 60
  });

  const mixedHeightWindows = candidates.filter(
    (candidate) =>
      candidate.x >= 6 &&
      candidate.x <= 56 &&
      candidate.width >= 10 &&
      candidate.width <= 15 &&
      candidate.height >= 18 &&
      candidate.height <= 31
  );
  const preservedShortWindow = mixedHeightWindows.find(
    (candidate) => candidate.x <= 10 && candidate.y >= 12 && candidate.y <= 16 && candidate.height <= 22
  );
  const preservedLowWindow = mixedHeightWindows.find(
    (candidate) => candidate.x >= 23 && candidate.x <= 27 && candidate.y >= 18 && candidate.height >= 21
  );
  const preservedTallWindow = mixedHeightWindows.find(
    (candidate) => candidate.x >= 40 && candidate.x <= 44 && candidate.y <= 11 && candidate.height >= 26
  );
  const mergedRow = candidates.find(
    (candidate) => candidate.x <= 10 && candidate.y <= 22 && candidate.width >= 44 && candidate.height >= 18
  );

  if (
    mixedHeightWindows.length !== 3 ||
    !preservedShortWindow ||
    !preservedLowWindow ||
    !preservedTallWindow ||
    mergedRow
  ) {
    const failure = {
      candidates,
      mixedHeightWindows,
      preservedShortWindow,
      preservedLowWindow,
      preservedTallWindow,
      mergedRow
    };
    await fs.writeFile("mixed-height-window-row-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Mixed-height window row regression failed. Diagnostic artifact written.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Mixed-height window row smoke test passed: all three openings stayed distinct despite different header and sill heights.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
