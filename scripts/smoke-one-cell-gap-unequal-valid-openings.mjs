import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-one-cell-gap-unequal-valid-openings-"));
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

  const tallNarrowOpening = { left: 12, right: 27, top: 16, bottom: 55 };
  const wideRaisedOpening = { left: 29, right: 52, top: 12, bottom: 47 };

  const addFrame = (frame, strength) => {
    for (let x = frame.left; x <= frame.right; x += 1) {
      addPoint(x, frame.top, strength);
      addPoint(x, frame.bottom, strength);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      addPoint(frame.left, y, strength);
      addPoint(frame.right, y, strength);
    }
  };

  // Two legitimate windows with different widths, heights, header levels, sill levels,
  // and edge strengths, separated by only one empty grid column.
  addFrame(tallNarrowOpening, 0.61);
  addFrame(wideRaisedOpening, 0.68);

  // Foreground clutter crosses both frames and fills the sole gap column. The detector
  // must preserve each frame's independent geometry instead of forcing a uniform merge.
  for (let offset = 0; offset <= 50; offset += 1) {
    const x = 8 + offset;
    const y = 20 + Math.floor(offset * 0.3);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.34);
  }
  for (let offset = 0; offset <= 43; offset += 1) {
    const x = 12 + offset;
    const y = 49 - Math.floor(offset * 0.3);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.32);
  }
  for (let y = 22; y <= 42; y += 1) addPoint(28, y, 0.31);

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

  const tallCandidate = candidates.find((candidate) => matches(candidate, tallNarrowOpening));
  const wideCandidate = candidates.find((candidate) => matches(candidate, wideRaisedOpening));
  const mergedOpening = candidates.find(
    (candidate) =>
      candidate.x <= tallNarrowOpening.left + 3 &&
      candidate.x + candidate.width >= wideRaisedOpening.right - 3 &&
      candidate.y <= wideRaisedOpening.top + 3 &&
      candidate.y + candidate.height >= tallNarrowOpening.bottom - 3
  );

  if (!tallCandidate || !wideCandidate || mergedOpening) {
    const failure = { tallCandidate, wideCandidate, mergedOpening, candidates };
    await fs.writeFile(
      "one-cell-gap-unequal-valid-openings-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("One-cell-gap unequal-valid-openings regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "One-cell-gap unequal-valid-openings smoke passed: both differently sized and vertically offset frames survived independently, and no broad mask crossed the shared clutter."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}

await import("./smoke-one-cell-gap-unequal-occluded-opening.mjs");
