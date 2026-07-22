import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-one-cell-gap-two-valid-openings-"));
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

  const leftOpening = { left: 12, right: 30, top: 17, bottom: 53 };
  const rightOpening = { left: 32, right: 50, top: 17, bottom: 53 };
  const weakStrength = 0.62;

  const addWeakFrame = (frame) => {
    for (let x = frame.left; x <= frame.right; x += 1) {
      addPoint(x, frame.top, weakStrength);
      addPoint(x, frame.bottom, weakStrength);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      addPoint(frame.left, y, weakStrength);
      addPoint(frame.right, y, weakStrength);
    }
  };

  // Two legitimate weak windows separated by only one empty grid column.
  addWeakFrame(leftOpening);
  addWeakFrame(rightOpening);

  // Shared foreground clutter crosses both openings and occupies the sole gap column.
  // It must not collapse the two valid frames into one broad automatic mask.
  for (let offset = 0; offset <= 49; offset += 1) {
    const x = 8 + offset;
    const y = 21 + Math.floor(offset * 0.31);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.34);
  }
  for (let offset = 0; offset <= 42; offset += 1) {
    const x = 12 + offset;
    const y = 47 - Math.floor(offset * 0.28);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.32);
  }
  for (let y = 24; y <= 41; y += 1) addPoint(31, y, 0.31);

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

  const leftCandidate = candidates.find((candidate) => matches(candidate, leftOpening));
  const rightCandidate = candidates.find((candidate) => matches(candidate, rightOpening));
  const mergedOpening = candidates.find(
    (candidate) =>
      candidate.x <= leftOpening.left + 3 &&
      candidate.x + candidate.width >= rightOpening.right - 3 &&
      candidate.y <= leftOpening.top + 3 &&
      candidate.y + candidate.height >= leftOpening.bottom - 3
  );

  if (!leftCandidate || !rightCandidate || mergedOpening) {
    const failure = { leftCandidate, rightCandidate, mergedOpening, candidates };
    await fs.writeFile(
      "one-cell-gap-two-valid-openings-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("One-cell-gap two-valid-openings regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "One-cell-gap two-valid-openings smoke passed: both tightly spaced architectural frames survived as distinct candidates and no broad mask crossed the shared clutter."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
