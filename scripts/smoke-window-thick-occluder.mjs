import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-window-thick-occluder-"));
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

  const frame = { left: 18, right: 52, top: 12, bottom: 58 };

  for (let x = frame.left; x <= frame.right; x += 1) {
    addPoint(x, frame.top, 0.9);
    addPoint(x, frame.bottom, 0.9);
  }
  for (let y = frame.top; y <= frame.bottom; y += 1) {
    addPoint(frame.left, y, 0.9);
    addPoint(frame.right, y, 0.9);
  }

  // A thick foreground limb or railing crosses the opening diagonally. It should
  // remain clutter, not become a mullion and not split the real frame into masks.
  for (let offset = 0; offset <= 42; offset += 1) {
    const x = 14 + offset;
    const y = 23 + Math.floor(offset * 0.52);
    for (let thickness = -2; thickness <= 2; thickness += 1) {
      addPoint(x, y + thickness, 0.48);
    }
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 70
  });

  const fullFrame = candidates.find(
    (candidate) =>
      candidate.x >= 16 &&
      candidate.x <= 20 &&
      candidate.y >= 10 &&
      candidate.y <= 14 &&
      candidate.width >= 31 &&
      candidate.width <= 38 &&
      candidate.height >= 43 &&
      candidate.height <= 50
  );

  const splitFragments = candidates.filter(
    (candidate) =>
      candidate.x >= 16 &&
      candidate.x <= 54 &&
      candidate.y >= 10 &&
      candidate.y <= 60 &&
      candidate.width >= 10 &&
      candidate.width < 28 &&
      candidate.height >= 12 &&
      candidate.height < 42
  );

  if (!fullFrame || splitFragments.length > 0) {
    const failure = { candidates, fullFrame, splitFragments };
    await fs.writeFile("window-thick-occluder-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Thick-occluder window regression failed. Diagnostic artifact written.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Thick-occluder window smoke test passed: the architectural frame remained whole and unsplit.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
