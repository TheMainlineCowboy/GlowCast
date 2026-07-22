import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-mixed-one-cell-gap-unequal-valid-open-"));
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

  const tallValidOpening = { left: 8, right: 21, top: 17, bottom: 55 };
  const weakOccludedOpening = { left: 23, right: 42, top: 12, bottom: 47 };
  const weakOpenFragment = { left: 44, right: 64, top: 15, bottom: 50 };

  const addFrame = (frame, strength, shouldSkip = () => false) => {
    for (let x = frame.left; x <= frame.right; x += 1) {
      if (!shouldSkip(x, frame.top)) addPoint(x, frame.top, strength);
      if (!shouldSkip(x, frame.bottom)) addPoint(x, frame.bottom, strength);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      if (!shouldSkip(frame.left, y)) addPoint(frame.left, y, strength);
      if (!shouldSkip(frame.right, y)) addPoint(frame.right, y, strength);
    }
  };

  addFrame(tallValidOpening, 0.65);
  addFrame(
    weakOccludedOpening,
    0.56,
    (x, y) =>
      (y === weakOccludedOpening.top && x <= weakOccludedOpening.left + 6) ||
      (x === weakOccludedOpening.left && y <= weakOccludedOpening.top + 8)
  );
  addFrame(
    weakOpenFragment,
    0.56,
    (x, y) =>
      (y === weakOpenFragment.top && x <= weakOpenFragment.left + 12) ||
      (x === weakOpenFragment.left && y <= weakOpenFragment.top + 21)
  );

  // The same foreground clutter crosses all three outlines and both one-cell gaps.
  // Closure evidence must remain local: preserve both real openings, reject the open
  // fragment, and never merge the row through the obstructions.
  for (let offset = 0; offset <= 64; offset += 1) {
    const x = 4 + offset;
    const y = 20 + Math.floor(offset * 0.28);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.34);
  }
  for (let offset = 0; offset <= 56; offset += 1) {
    const x = 8 + offset;
    const y = 49 - Math.floor(offset * 0.27);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.32);
  }
  for (let y = 20; y <= 42; y += 1) {
    addPoint(22, y, 0.31);
    addPoint(43, y, 0.31);
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
    candidate.y >= expected.top - 3 &&
    candidate.y <= expected.top + 4 &&
    candidate.width >= expected.right - expected.left - 2 &&
    candidate.width <= expected.right - expected.left + 5 &&
    candidate.height >= expected.bottom - expected.top - 3 &&
    candidate.height <= expected.bottom - expected.top + 5;

  const tallCandidate = candidates.find((candidate) => matches(candidate, tallValidOpening));
  const occludedCandidate = candidates.find((candidate) => matches(candidate, weakOccludedOpening));
  const falseOpening = candidates.find((candidate) => matches(candidate, weakOpenFragment));
  const mergedOpening = candidates.find(
    (candidate) =>
      candidate.x <= tallValidOpening.left + 3 &&
      candidate.x + candidate.width >= weakOpenFragment.right - 3 &&
      candidate.y <= weakOccludedOpening.top + 3 &&
      candidate.y + candidate.height >= tallValidOpening.bottom - 3
  );

  if (!tallCandidate || !occludedCandidate || falseOpening || mergedOpening) {
    const failure = { tallCandidate, occludedCandidate, falseOpening, mergedOpening, candidates };
    await fs.writeFile(
      "mixed-one-cell-gap-unequal-valid-open-occluded-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("Mixed one-cell-gap unequal valid/open regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "Mixed one-cell-gap unequal smoke passed: both real openings survived, the matching incomplete neighbor stayed rejected, and shared clutter produced no merged row mask."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}

await import("./smoke-mixed-staggered-unequal-valid-open-clutter.mjs");
