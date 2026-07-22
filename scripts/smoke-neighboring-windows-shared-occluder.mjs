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

const locateWindows = (candidates, expected) => {
  const matches = expected.map(({ left, right, top, bottom }) =>
    candidates.find(
      (candidate) =>
        candidate.x >= left - 2 &&
        candidate.x <= left + 2 &&
        candidate.y >= top - 2 &&
        candidate.y <= top + 2 &&
        candidate.width >= right - left - 2 &&
        candidate.width <= right - left + 4 &&
        candidate.height >= bottom - top - 3 &&
        candidate.height <= bottom - top + 4
    )
  );
  const leftmost = Math.min(...expected.map((window) => window.left));
  const rightmost = Math.max(...expected.map((window) => window.right));
  const topmost = Math.min(...expected.map((window) => window.top));
  const minimumHeight = Math.min(...expected.map((window) => window.bottom - window.top)) - 3;
  const mergedSpan = candidates.find(
    (candidate) =>
      candidate.x <= leftmost + 2 &&
      candidate.y <= topmost + 3 &&
      candidate.width >= rightmost - leftmost - 2 &&
      candidate.height >= minimumHeight
  );
  return { matches, mergedSpan };
};

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);

  const runCase = async ({ name, windows, addOccluder }) => {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    for (const { left, right, top, bottom, strength, hiddenSide, hiddenSideStart, hiddenSideEnd } of windows) {
      for (let x = left; x <= right; x += 1) {
        addPoint(x, top, strength);
        addPoint(x, bottom, strength);
      }
      for (let y = top; y <= bottom; y += 1) {
        if (hiddenSide !== "left" || y < hiddenSideStart || y > hiddenSideEnd) {
          addPoint(left, y, strength);
        }
        if (hiddenSide !== "right" || y < hiddenSideStart || y > hiddenSideEnd) {
          addPoint(right, y, strength);
        }
      }
    }

    addOccluder(addPoint);

    const candidates = detectArchitecturalCandidates(scene, {
      gridResolution: 100,
      minDensityThreshold: 1,
      minSizePercent: 5,
      maxSizePercent: 70
    });

    const { matches, mergedSpan } = locateWindows(candidates, windows);
    if (matches.some((match) => !match) || mergedSpan) {
      const failure = { name, candidates, matches, mergedSpan };
      await fs.writeFile(
        "neighboring-windows-shared-occluder-diagnostic.json",
        `${JSON.stringify(failure, null, 2)}\n`
      );
      console.error(`Neighboring-window shared-occluder regression failed for ${name}. Diagnostic artifact written.`);
      console.error(JSON.stringify(failure));
      process.exit(1);
    }
  };

  await runCase({
    name: "shared diagonal occluder",
    windows: [
      { left: 12, right: 30, top: 12, bottom: 46, strength: 0.92, hiddenSide: "right", hiddenSideStart: 25, hiddenSideEnd: 31 },
      { left: 38, right: 56, top: 15, bottom: 49, strength: 0.86, hiddenSide: "left", hiddenSideStart: 28, hiddenSideEnd: 34 }
    ],
    addOccluder: (addPoint) => {
      for (let offset = 0; offset <= 54; offset += 1) {
        const x = 8 + offset;
        const y = 20 + Math.floor(offset * 0.28);
        for (let thickness = -2; thickness <= 2; thickness += 1) {
          addPoint(x, y + thickness, 0.41);
        }
      }
    }
  });

  await runCase({
    name: "narrow gap crossed like a false mullion",
    windows: [
      { left: 12, right: 30, top: 12, bottom: 46, strength: 0.92, hiddenSide: "right", hiddenSideStart: 24, hiddenSideEnd: 34 },
      { left: 35, right: 53, top: 14, bottom: 48, strength: 0.84, hiddenSide: "left", hiddenSideStart: 25, hiddenSideEnd: 35 }
    ],
    addOccluder: (addPoint) => {
      // This thick foreground element crosses both windows and fills the narrow gap
      // between them. It must not be treated as a shared architectural mullion.
      for (let offset = 0; offset <= 50; offset += 1) {
        const x = 8 + offset;
        const y = 22 + Math.floor(offset * 0.24);
        for (let thickness = -2; thickness <= 2; thickness += 1) {
          addPoint(x, y + thickness, 0.39);
        }
      }
      for (let y = 23; y <= 39; y += 1) {
        for (let x = 31; x <= 34; x += 1) {
          addPoint(x, y, 0.37);
        }
      }
    }
  });

  console.log(
    "Neighboring-window shared-occluder smoke test passed: both openings remained distinct and a foreground obstruction crossing their narrow gap was not mistaken for a mullion."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
