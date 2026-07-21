import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-occluded-staggered-windows-"));
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

  const windows = [
    { left: 8, right: 20, top: 10, bottom: 31, strength: 0.94, gaps: new Set(["top:14", "right:22"]) },
    { left: 25, right: 38, top: 18, bottom: 43, strength: 0.8, gaps: new Set(["left:29", "bottom:32"]) },
    { left: 43, right: 56, top: 7, bottom: 28, strength: 0.9, gaps: new Set(["top:49", "left:17"]) }
  ];

  for (const { left, right, top, bottom, strength, gaps } of windows) {
    for (let x = left; x <= right; x += 1) {
      if (!gaps.has(`top:${x}`)) addPoint(x, top, strength);
      if (!gaps.has(`bottom:${x}`)) addPoint(x, bottom, strength);
    }
    for (let y = top; y <= bottom; y += 1) {
      if (!gaps.has(`left:${y}`)) addPoint(left, y, strength);
      if (!gaps.has(`right:${y}`)) addPoint(right, y, strength);
    }
  }

  // Foreground branch / railing fragments cross near the openings without completing a perimeter.
  for (let offset = 0; offset <= 18; offset += 1) {
    addPoint(16 + offset, 14 + Math.floor(offset * 0.55), 0.42);
    addPoint(34 + offset, 34 - Math.floor(offset * 0.45), 0.38);
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 60
  });

  const openings = candidates.filter(
    (candidate) =>
      candidate.x >= 6 &&
      candidate.x <= 58 &&
      candidate.width >= 10 &&
      candidate.width <= 17 &&
      candidate.height >= 18 &&
      candidate.height <= 29
  );

  const upperLeft = openings.find(
    (candidate) => candidate.x <= 10 && candidate.y >= 8 && candidate.y <= 12 && candidate.height <= 24
  );
  const lowerMiddle = openings.find(
    (candidate) => candidate.x >= 23 && candidate.x <= 27 && candidate.y >= 16 && candidate.y <= 20 && candidate.height >= 23
  );
  const upperRight = openings.find(
    (candidate) => candidate.x >= 41 && candidate.x <= 45 && candidate.y <= 9 && candidate.height >= 19
  );
  const mergedSpan = candidates.find(
    (candidate) =>
      candidate.x <= 10 &&
      candidate.y <= 20 &&
      candidate.width >= 45 &&
      candidate.height >= 21
  );

  if (openings.length !== 3 || !upperLeft || !lowerMiddle || !upperRight || mergedSpan) {
    const failure = { candidates, openings, upperLeft, lowerMiddle, upperRight, mergedSpan };
    await fs.writeFile("occluded-staggered-windows-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Occluded staggered-window regression failed. Diagnostic artifact written.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Occluded staggered-window smoke test passed: fragmented frames remained separate despite nearby foreground clutter.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
