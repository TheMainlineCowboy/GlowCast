import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-neighboring-windows-shared-occluder-"));
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
    { left: 12, right: 30, top: 12, bottom: 46, strength: 0.92, hiddenSideStart: 25, hiddenSideEnd: 31 },
    { left: 38, right: 56, top: 15, bottom: 49, strength: 0.86, hiddenSideStart: 28, hiddenSideEnd: 34 }
  ];

  for (const { left, right, top, bottom, strength, hiddenSideStart, hiddenSideEnd } of windows) {
    for (let x = left; x <= right; x += 1) {
      addPoint(x, top, strength);
      addPoint(x, bottom, strength);
    }
    for (let y = top; y <= bottom; y += 1) {
      addPoint(left, y, strength);
      if (y < hiddenSideStart || y > hiddenSideEnd) {
        addPoint(right, y, strength);
      }
    }
  }

  // One foreground limb or railing crosses both openings and hides separate sections
  // of their facing outer edges. It must not become a bridge that merges the windows.
  for (let offset = 0; offset <= 54; offset += 1) {
    const x = 8 + offset;
    const y = 20 + Math.floor(offset * 0.28);
    for (let thickness = -2; thickness <= 2; thickness += 1) {
      addPoint(x, y + thickness, 0.41);
    }
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 70
  });

  const leftWindow = candidates.find(
    (candidate) =>
      candidate.x >= 10 &&
      candidate.x <= 14 &&
      candidate.y >= 10 &&
      candidate.y <= 14 &&
      candidate.width >= 16 &&
      candidate.width <= 22 &&
      candidate.height >= 31 &&
      candidate.height <= 38
  );
  const rightWindow = candidates.find(
    (candidate) =>
      candidate.x >= 36 &&
      candidate.x <= 40 &&
      candidate.y >= 13 &&
      candidate.y <= 17 &&
      candidate.width >= 16 &&
      candidate.width <= 22 &&
      candidate.height >= 31 &&
      candidate.height <= 38
  );
  const mergedSpan = candidates.find(
    (candidate) =>
      candidate.x <= 14 &&
      candidate.y <= 17 &&
      candidate.width >= 42 &&
      candidate.height >= 31
  );

  if (!leftWindow || !rightWindow || mergedSpan) {
    const failure = { candidates, leftWindow, rightWindow, mergedSpan };
    await fs.writeFile("neighboring-windows-shared-occluder-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Neighboring-window shared-occluder regression failed. Diagnostic artifact written.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Neighboring-window shared-occluder smoke test passed: both openings remained distinct through one foreground obstruction.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
