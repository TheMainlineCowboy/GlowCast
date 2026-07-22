import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-one-cell-gap-unequal-open-occluded-fragment-"));
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
  const weakOpenFragment = { left: 29, right: 52, top: 12, bottom: 47 };

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

  addFrame(tallNarrowOpening, 0.64);

  // Negative companion to the valid corner-occluded opening: this similarly sized,
  // similarly weak neighbor is genuinely open along most of its top-left perimeter.
  // Shared foreground clutter must not be borrowed as replacement frame evidence.
  addFrame(
    weakOpenFragment,
    0.56,
    (x, y) =>
      (y === weakOpenFragment.top && x >= weakOpenFragment.left && x <= weakOpenFragment.left + 12) ||
      (x === weakOpenFragment.left && y >= weakOpenFragment.top && y <= weakOpenFragment.top + 20)
  );

  // Match the positive case: two crossing obstructions plus evidence in the sole gap
  // column. They may cross the outlines, but must not close the incomplete neighbor.
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
  for (let y = 18; y <= 42; y += 1) addPoint(28, y, 0.31);

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

  const tallCandidate = candidates.find((candidate) => matches(candidate, tallNarrowOpening));
  const falseOpening = candidates.find((candidate) => matches(candidate, weakOpenFragment));
  const mergedOpening = candidates.find(
    (candidate) =>
      candidate.x <= tallNarrowOpening.left + 3 &&
      candidate.x + candidate.width >= weakOpenFragment.right - 3 &&
      candidate.y <= weakOpenFragment.top + 3 &&
      candidate.y + candidate.height >= tallNarrowOpening.bottom - 3
  );

  if (!tallCandidate || falseOpening || mergedOpening) {
    const failure = { tallCandidate, falseOpening, mergedOpening, candidates };
    await fs.writeFile(
      "one-cell-gap-unequal-open-occluded-fragment-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("One-cell-gap unequal open-fragment regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "One-cell-gap unequal open-fragment smoke passed: the valid tall opening survived, the weak incomplete neighbor stayed rejected, and shared clutter created no merged mask."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}

await import("./smoke-mixed-one-cell-gap-unequal-valid-open-occluded.mjs");
