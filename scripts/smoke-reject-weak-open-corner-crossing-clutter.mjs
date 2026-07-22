import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-open-corner-crossing-clutter-"));
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

  const left = 29;
  const right = 45;
  const top = 16;
  const bottom = 51;
  const weakStrength = 0.62;

  // A genuinely open, weak three-sided fragment: the top-left corner and a long
  // section of the left edge are absent. Foreground clutter must not complete it.
  for (let x = 37; x <= right; x += 1) addPoint(x, top, weakStrength);
  for (let x = left; x <= right; x += 1) addPoint(x, bottom, weakStrength);
  for (let y = top; y <= bottom; y += 1) addPoint(right, y, weakStrength);
  for (let y = 31; y <= bottom; y += 1) addPoint(left, y, weakStrength);

  // Match the two crossing foreground obstructions used by the positive case.
  for (let offset = 0; offset <= 68; offset += 1) {
    const x = 4 + offset;
    const y = 18 + Math.floor(offset * 0.25);
    for (let thickness = -2; thickness <= 2; thickness += 1) {
      addPoint(x, y + thickness, 0.35);
    }
  }
  for (let offset = 0; offset <= 54; offset += 1) {
    const x = 12 + offset;
    const y = 42 - Math.floor(offset * 0.31);
    for (let thickness = -1; thickness <= 1; thickness += 1) {
      addPoint(x, y + thickness, 0.33);
    }
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 70
  });

  const falseOpening = candidates.find(
    (candidate) =>
      candidate.x >= left - 2 &&
      candidate.x <= left + 3 &&
      candidate.y >= top - 2 &&
      candidate.y <= top + 3 &&
      candidate.width >= right - left - 2 &&
      candidate.width <= right - left + 5 &&
      candidate.height >= bottom - top - 3 &&
      candidate.height <= bottom - top + 5
  );

  if (falseOpening) {
    const failure = { falseOpening, candidates };
    await fs.writeFile(
      "weak-open-corner-crossing-clutter-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("Weak open-corner fragment was incorrectly completed by crossing foreground clutter.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "Weak open-corner crossing-clutter smoke test passed: intersecting foreground objects did not create a false architectural opening."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}

await import("./smoke-mixed-valid-open-corner-crossing-clutter.mjs");
