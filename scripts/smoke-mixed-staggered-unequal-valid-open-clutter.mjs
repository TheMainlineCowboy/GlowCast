import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-mixed-staggered-unequal-"));
const tempPath = path.join(tempDir, "core", "architecturalDetector.js");

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", detectorPath, "--ignoreConfig", "--outDir", tempDir,
  "--module", "ES2020", "--target", "ES2020", "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);
  const scene = [];
  const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });
  const lowValid = { left: 8, right: 22, top: 25, bottom: 61 };
  const highOccluded = { left: 24, right: 44, top: 10, bottom: 43 };
  const midOpen = { left: 46, right: 66, top: 18, bottom: 53 };
  const perspectiveValid = { left: 70, right: 86, top: 12, bottom: 47 };

  const addFrame = (frame, strength, skip = () => false) => {
    for (let x = frame.left; x <= frame.right; x += 1) {
      if (!skip(x, frame.top)) addPoint(x, frame.top, strength);
      if (!skip(x, frame.bottom)) addPoint(x, frame.bottom, strength);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      if (!skip(frame.left, y)) addPoint(frame.left, y, strength);
      if (!skip(frame.right, y)) addPoint(frame.right, y, strength);
    }
  };

  const addPerspectiveFrame = (frame, strength, skip = () => false) => {
    const height = frame.bottom - frame.top;
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      const shift = Math.floor(((y - frame.top) / height) * 3);
      const leftX = frame.left + shift;
      const rightX = frame.right + shift;
      if (!skip(leftX, y, "left")) addPoint(leftX, y, strength);
      if (!skip(rightX, y, "right")) addPoint(rightX, y, strength);
    }
    for (let x = frame.left; x <= frame.right; x += 1) {
      const topOffset = Math.round((x - frame.left) / (frame.right - frame.left));
      const bottomOffset = Math.round((x - frame.left) / (frame.right - frame.left));
      const topY = frame.top + topOffset;
      const bottomX = x + 3;
      const bottomY = frame.bottom + bottomOffset;
      if (!skip(x, topY, "top")) addPoint(x, topY, strength);
      if (!skip(bottomX, bottomY, "bottom")) addPoint(bottomX, bottomY, strength);
    }
  };

  addFrame(lowValid, 0.64);
  addFrame(highOccluded, 0.55, (x, y) =>
    (y === highOccluded.top && x <= highOccluded.left + 7) ||
    (x === highOccluded.left && y <= highOccluded.top + 9)
  );
  addFrame(midOpen, 0.55, (x, y) =>
    (y === midOpen.top && x <= midOpen.left + 13) ||
    (x === midOpen.left && y <= midOpen.top + 22)
  );
  addPerspectiveFrame(perspectiveValid, 0.58, (x, y, edge) =>
    (edge === "top" && x <= perspectiveValid.left + 6) ||
    (edge === "left" && y <= perspectiveValid.top + 8)
  );

  // Shared diagonal clutter crosses all outlines and both one-cell gaps. It also
  // crosses the missing perspective corner, so the detector must reconstruct the
  // angled architectural perimeter without borrowing closure from the obstruction.
  for (let offset = 0; offset <= 84; offset += 1) {
    const x = 4 + offset;
    const y = 18 + Math.floor(offset * 0.31);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.33);
  }
  for (let offset = 0; offset <= 78; offset += 1) {
    const x = 8 + offset;
    const y = 54 - Math.floor(offset * 0.29);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.31);
  }
  for (let y = 20; y <= 45; y += 1) {
    addPoint(23, y, 0.3);
    addPoint(45, y, 0.3);
    addPoint(68, y, 0.3);
  }

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 100, minDensityThreshold: 1, minSizePercent: 5, maxSizePercent: 70
  });
  const matches = (candidate, expected) =>
    candidate.x >= expected.left - 2 && candidate.x <= expected.left + 4 &&
    candidate.y >= expected.top - 3 && candidate.y <= expected.top + 4 &&
    candidate.width >= expected.right - expected.left - 2 && candidate.width <= expected.right - expected.left + 8 &&
    candidate.height >= expected.bottom - expected.top - 3 && candidate.height <= expected.bottom - expected.top + 6;

  const lowCandidate = candidates.find((candidate) => matches(candidate, lowValid));
  const highCandidate = candidates.find((candidate) => matches(candidate, highOccluded));
  const perspectiveCandidate = candidates.find((candidate) => matches(candidate, perspectiveValid));
  const falseOpening = candidates.find((candidate) => matches(candidate, midOpen));
  const mergedOpening = candidates.find((candidate) =>
    candidate.x <= lowValid.left + 3 && candidate.x + candidate.width >= midOpen.right - 3 &&
    candidate.y <= highOccluded.top + 3 && candidate.y + candidate.height >= lowValid.bottom - 3
  );

  if (!lowCandidate || !highCandidate || !perspectiveCandidate || falseOpening || mergedOpening) {
    const failure = { lowCandidate, highCandidate, perspectiveCandidate, falseOpening, mergedOpening, candidates };
    await fs.writeFile("mixed-staggered-unequal-valid-open-clutter-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Mixed staggered unequal valid/open regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Mixed staggered unequal smoke passed: real openings survived at different heights, a perspective-skewed frame with an obscured corner remained detectable, the matching open fragment stayed rejected, and shared clutter produced no merged mask.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
