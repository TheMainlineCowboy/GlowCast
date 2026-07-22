import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-adjacent-perspective-valid-open-"));
const tempPath = path.join(tempDir, "core", "architecturalDetector.js");

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", detectorPath, "--ignoreConfig", "--outDir", tempDir,
  "--module", "ES2020", "--target", "ES2020", "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);
  const scene = [];
  const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });
  const valid = { left: 18, right: 38, top: 12, bottom: 52 };
  const open = { left: 40, right: 60, top: 14, bottom: 54 };

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
      const offset = Math.round((x - frame.left) / (frame.right - frame.left));
      if (!skip(x, frame.top + offset, "top")) addPoint(x, frame.top + offset, strength);
      if (!skip(x + 3, frame.bottom + offset, "bottom")) addPoint(x + 3, frame.bottom + offset, strength);
    }
  };

  addPerspectiveFrame(valid, 0.58, (x, y, edge) =>
    (edge === "top" && x <= valid.left + 6) ||
    (edge === "left" && y <= valid.top + 8)
  );
  addPerspectiveFrame(open, 0.55, (x, y, edge) =>
    (edge === "top" && x <= open.left + 13) ||
    (edge === "left" && y <= open.top + 22)
  );

  // The same foreground clutter crosses both outlines and their one-cell gap.
  // It may obscure the real window, but must not lend closure to the open neighbor.
  for (let offset = 0; offset <= 52; offset += 1) {
    const x = 13 + offset;
    const y = 18 + Math.floor(offset * 0.34);
    for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.33);
  }
  for (let offset = 0; offset <= 48; offset += 1) {
    const x = 16 + offset;
    const y = 49 - Math.floor(offset * 0.27);
    for (let thickness = -1; thickness <= 1; thickness += 1) addPoint(x, y + thickness, 0.31);
  }
  for (let y = 20; y <= 45; y += 1) addPoint(39, y, 0.3);

  const candidates = detectArchitecturalCandidates(scene, {
    gridResolution: 80, minDensityThreshold: 1, minSizePercent: 5, maxSizePercent: 70
  });
  const matches = (candidate, expected) =>
    candidate.x >= expected.left - 2 && candidate.x <= expected.left + 4 &&
    candidate.y >= expected.top - 3 && candidate.y <= expected.top + 4 &&
    candidate.width >= expected.right - expected.left - 2 && candidate.width <= expected.right - expected.left + 8 &&
    candidate.height >= expected.bottom - expected.top - 3 && candidate.height <= expected.bottom - expected.top + 6;

  const validCandidate = candidates.find((candidate) => matches(candidate, valid));
  const falseOpening = candidates.find((candidate) => matches(candidate, open));
  const mergedOpening = candidates.find((candidate) =>
    candidate.x <= valid.left + 3 && candidate.x + candidate.width >= open.right - 3 &&
    candidate.y <= valid.top + 4 && candidate.y + candidate.height >= open.bottom - 4
  );

  if (!validCandidate || falseOpening || mergedOpening) {
    const failure = { validCandidate, falseOpening, mergedOpening, candidates };
    await fs.writeFile("adjacent-perspective-valid-open-clutter-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
    console.error("Adjacent perspective valid/open regression failed.");
    console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log("Adjacent perspective valid/open smoke passed: the real skewed opening survived, the matching open neighbor stayed rejected, and shared clutter produced no merged mask.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
