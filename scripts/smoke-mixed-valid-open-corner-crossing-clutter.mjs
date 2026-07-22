import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-mixed-valid-open-corner-clutter-"));
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

  const valid = { left: 10, right: 26, top: 16, bottom: 51 };
  const invalid = { left: 58, right: 74, top: 16, bottom: 51 };
  const weakStrength = 0.62;

  // Real weak window: its top-left corner and a long left-edge section are hidden.
  for (let x = valid.left; x <= valid.right; x += 1) {
    if (x < valid.left + 7) continue;
    addPoint(x, valid.top, weakStrength);
  }
  for (let x = valid.left; x <= valid.right; x += 1) addPoint(x, valid.bottom, weakStrength);
  for (let y = valid.top; y <= valid.bottom; y += 1) addPoint(valid.right, y, weakStrength);
  for (let y = valid.top + 14; y <= valid.bottom; y += 1) addPoint(valid.left, y, weakStrength);

  // Matching weak open fragment: similar missing corner, but deliberately lacks enough
  // coherent closure to qualify as an architectural opening.
  for (let x = invalid.left + 8; x <= invalid.right; x += 1) addPoint(x, invalid.top, weakStrength);
  for (let x = invalid.left; x <= invalid.right; x += 1) addPoint(x, invalid.bottom, weakStrength);
  for (let y = invalid.top; y <= invalid.bottom; y += 1) addPoint(invalid.right, y, weakStrength);
  for (let y = invalid.top + 20; y <= invalid.bottom; y += 1) addPoint(invalid.left, y, weakStrength);

  // Apply the same two foreground obstructions across both shapes.
  for (let offset = 0; offset <= 82; offset += 1) {
    const x = 4 + offset;
    const y = 18 + Math.floor(offset * 0.25);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.35);
  }
  for (let offset = 0; offset <= 72; offset += 1) {
    const x = 8 + offset;
    const y = 43 - Math.floor(offset * 0.31);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.33);
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
    candidate.y >= expected.top - 2 &&
    candidate.y <= expected.top + 3 &&
    candidate.width >= expected.right - expected.left - 2 &&
    candidate.width <= expected.right - expected.left + 5 &&
    candidate.height >= expected.bottom - expected.top - 3 &&
    candidate.height <= expected.bottom - expected.top + 5;

  const validOpening = candidates.find((candidate) => matches(candidate, valid));
  const falseOpening = candidates.find((candidate) => matches(candidate, invalid));

  if (!validOpening || falseOpening) {
    const failure = { validOpening, falseOpening, candidates };
    await fs.writeFile(
      "mixed-valid-open-corner-crossing-clutter-diagnostic.json",
      `${JSON.stringify(failure, null, 2)}\n`
    );
    console.error("Mixed valid/open-corner clutter regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(
    "Mixed valid/open-corner clutter smoke test passed: the real occluded window survived while the matching open fragment remained rejected."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
