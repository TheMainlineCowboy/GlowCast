import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-strong-open-center-"));
const tempPath = path.join(tempDir, "core", "architecturalDetector.js");

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", detectorPath, "--ignoreConfig", "--outDir", tempDir,
  "--module", "ES2020", "--target", "ES2020", "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);
  const scene = [];
  const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });
  const addFrame = (frame, strength, slope, taper, skip = () => false) => {
    const height = frame.bottom - frame.top;
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      const progress = (y - frame.top) / height;
      const shift = Math.round(progress * slope);
      const inset = Math.round(progress * taper);
      const left = frame.left + shift + inset;
      const right = frame.right + shift - inset;
      if (!skip(left, y, "left")) addPoint(left, y, strength);
      if (!skip(right, y, "right")) addPoint(right, y, strength);
    }
    for (let x = frame.left; x <= frame.right; x += 1) {
      const progress = (x - frame.left) / (frame.right - frame.left);
      const topY = frame.top + Math.round(progress);
      const bottomX = x + Math.round(progress * slope);
      const bottomY = frame.bottom + Math.round(progress);
      if (!skip(x, topY, "top")) addPoint(x, topY, strength);
      if (!skip(bottomX, bottomY, "bottom")) addPoint(bottomX, bottomY, strength);
    }
  };

  const leftValid = { left: 8, right: 31, top: 8, bottom: 58 };
  const centerOpen = { left: 27, right: 52, top: 14, bottom: 61 };
  const rightValid = { left: 48, right: 71, top: 10, bottom: 55 };

  addFrame(leftValid, 0.56, 5, 4, (x, y, edge) =>
    (edge === "right" && y >= 29 && y <= 43) || (edge === "bottom" && x >= 25));
  addFrame(centerOpen, 0.76, -3, 2, (x, y, edge) =>
    (edge === "left" && y <= 42) || (edge === "top" && x <= 44) ||
    (edge === "right" && y >= 42) || (edge === "bottom" && x >= 39));
  addFrame(rightValid, 0.55, -4, 3, (x, y, edge) =>
    (edge === "left" && y >= 24 && y <= 37) || (edge === "top" && x <= 55));

  // The incomplete center silhouette deliberately borrows recognizable pieces from
  // both neighboring sash layouts: an upper two-over-one divider similar to the left
  // window and a lower offset divider similar to the right. Pattern alignment must
  // not transfer closure evidence into its missing exterior perimeter.
  for (let y = 21; y <= 54; y += 1) {
    addPoint(35 + Math.round((y - 21) * 0.38), y, 0.86);
    if (y <= 35) addPoint(42 - Math.round((y - 21) * 0.08), y, 0.82);
    if (y >= 34) addPoint(45 - Math.round((y - 34) * 0.14), y, 0.81);
  }
  for (let x = 31; x <= 49; x += 1) {
    addPoint(x, 30 + Math.round((x - 31) * 0.1), 0.83);
    addPoint(x, 46 - Math.round((x - 31) * 0.08), 0.79);
  }

  // Give each coherent outer frame a distinctly different real-world sash layout:
  // the left uses an asymmetric two-over-one arrangement, while the right uses a
  // single offset vertical divider and a high transom. The detector must preserve
  // both even though the open center partially matches each interior pattern.
  for (let y = 17; y <= 50; y += 1) {
    addPoint(18 + Math.round((y - 17) * 0.11), y, 0.68);
    if (y <= 33) addPoint(24 + Math.round((y - 17) * 0.07), y, 0.64);
  }
  for (let x = 12; x <= 28; x += 1) {
    addPoint(x, 31 + Math.round((x - 12) * 0.12), 0.65);
  }
  for (let y = 16; y <= 49; y += 1) {
    addPoint(62 - Math.round((y - 16) * 0.09), y, 0.67);
  }
  for (let x = 53; x <= 68; x += 1) {
    addPoint(x, 25 - Math.round((x - 53) * 0.06), 0.65);
  }

  for (let offset = 0; offset <= 63; offset += 1) {
    const x = 7 + offset;
    const y = 20 + Math.floor(offset * 0.28);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.32);
  }
  for (let offset = 0; offset <= 59; offset += 1) {
    const x = 10 + offset;
    const y = 50 - Math.floor(offset * 0.24);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.3);
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 80, minDensityThreshold: 1, minSizePercent: 5, maxSizePercent: 70
  });
  const matches = (candidate, expected) =>
    candidate.x >= expected.left - 5 && candidate.x <= expected.left + 7 &&
    candidate.y >= expected.top - 4 && candidate.y <= expected.top + 5 &&
    candidate.width >= expected.right - expected.left - 7 && candidate.width <= expected.right - expected.left + 12 &&
    candidate.height >= expected.bottom - expected.top - 4 && candidate.height <= expected.bottom - expected.top + 7;

  const leftCandidate = candidates.find((candidate) => matches(candidate, leftValid));
  const rightCandidate = candidates.find((candidate) => matches(candidate, rightValid));
  const falseCenter = candidates.find((candidate) => matches(candidate, centerOpen));
  const merged = candidates.find((candidate) =>
    candidate.x <= leftValid.left + 4 && candidate.x + candidate.width >= rightValid.right - 4 &&
    candidate.y <= 14 && candidate.y + candidate.height >= 54);

  if (!leftCandidate || !rightCandidate || falseCenter || merged) {
    const failure = { leftCandidate, rightCandidate, falseCenter, merged, candidates };
    await fs.writeFile("three-outline-strong-open-center-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Strong open-center perspective regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Strong open-center perspective smoke passed: coherent windows survived while the stronger incomplete center silhouette, partially matching sash patterns, and broad merged masks stayed rejected.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
