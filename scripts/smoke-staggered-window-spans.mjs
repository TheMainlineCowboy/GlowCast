import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-staggered-windows-"));
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

  // Three nearby windows whose vertical spans overlap only partially.
  // This models staggered facade openings without giving the detector a uniform row.
  for (const [left, right, top, bottom, strength] of [
    [8, 20, 10, 30, 0.94],
    [25, 38, 18, 42, 0.78],
    [43, 55, 6, 27, 0.9]
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

  const staggeredWindows = candidates.filter(
    (candidate) =>
      candidate.x >= 6 &&
      candidate.x <= 57 &&
      candidate.width >= 10 &&
      candidate.width <= 16 &&
      candidate.height >= 18 &&
      candidate.height <= 28
  );

  const upperLeft = staggeredWindows.find(
    (candidate) => candidate.x <= 10 && candidate.y >= 8 && candidate.y <= 12 && candidate.height <= 22
  );
  const lowerMiddle = staggeredWindows.find(
    (candidate) => candidate.x >= 23 && candidate.x <= 27 && candidate.y >= 16 && candidate.y <= 20 && candidate.height >= 22
  );
  const upperRight = staggeredWindows.find(
    (candidate) => candidate.x >= 41 && candidate.x <= 45 && candidate.y <= 8 && candidate.height >= 19
  );
  const mergedSpan = candidates.find(
    (candidate) =>
      candidate.x <= 10 &&
      candidate.y <= 20 &&
      candidate.width >= 44 &&
      candidate.height >= 20
  );

  if (staggeredWindows.length !== 3 || !upperLeft || !lowerMiddle || !upperRight || mergedSpan) {
    const failure = {
      candidates,
      staggeredWindows,
      upperLeft,
      lowerMiddle,
      upperRight,
      mergedSpan
    };
    await fs.writeFile("staggered-window-spans-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Staggered window-span regression failed. Diagnostic artifact written.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Staggered window-span smoke test passed: partially overlapping vertical spans remained three distinct architectural openings.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
