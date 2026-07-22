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

  const runCase = async ({ name, valid, open, validSlope, openSlope, diagnostic }) => {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    const addPerspectiveFrame = (frame, strength, slope, skip = () => false) => {
      const height = frame.bottom - frame.top;
      const drift = Math.abs(slope);
      for (let y = frame.top; y <= frame.bottom; y += 1) {
        const shift = Math.floor(((y - frame.top) / height) * drift) * Math.sign(slope);
        const leftX = frame.left + shift;
        const rightX = frame.right + shift;
        if (!skip(leftX, y, "left")) addPoint(leftX, y, strength);
        if (!skip(rightX, y, "right")) addPoint(rightX, y, strength);
      }
      for (let x = frame.left; x <= frame.right; x += 1) {
        const progress = (x - frame.left) / (frame.right - frame.left);
        const edgeShift = Math.round(progress * drift) * Math.sign(slope);
        if (!skip(x, frame.top + Math.round(progress), "top")) addPoint(x, frame.top + Math.round(progress), strength);
        if (!skip(x + edgeShift, frame.bottom + Math.round(progress), "bottom")) {
          addPoint(x + edgeShift, frame.bottom + Math.round(progress), strength);
        }
      }
    };

    addPerspectiveFrame(valid, 0.58, validSlope, (x, y, edge) =>
      (edge === "top" && x <= valid.left + 6) ||
      (edge === "left" && y <= valid.top + 8)
    );
    addPerspectiveFrame(open, 0.55, openSlope, (x, y, edge) =>
      (edge === "top" && x <= open.left + 13) ||
      (edge === "left" && y <= open.top + 22)
    );

    // Shared foreground clutter crosses both outlines and their narrow gap.
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
    const gapX = Math.round((valid.right + open.left) / 2);
    for (let y = Math.max(valid.top, open.top) + 6; y <= Math.min(valid.bottom, open.bottom) - 6; y += 1) {
      addPoint(gapX, y, 0.3);
    }

    const candidates = detectArchitecturalCandidates(scene, {
      gridResolution: 80, minDensityThreshold: 1, minSizePercent: 5, maxSizePercent: 70
    });
    const matches = (candidate, expected) =>
      candidate.x >= expected.left - 5 && candidate.x <= expected.left + 5 &&
      candidate.y >= expected.top - 3 && candidate.y <= expected.top + 4 &&
      candidate.width >= expected.right - expected.left - 3 && candidate.width <= expected.right - expected.left + 10 &&
      candidate.height >= expected.bottom - expected.top - 3 && candidate.height <= expected.bottom - expected.top + 6;

    const validCandidate = candidates.find((candidate) => matches(candidate, valid));
    const falseOpening = candidates.find((candidate) => matches(candidate, open));
    const mergedOpening = candidates.find((candidate) =>
      candidate.x <= valid.left + 3 && candidate.x + candidate.width >= open.right - 3 &&
      candidate.y <= Math.min(valid.top, open.top) + 4 &&
      candidate.y + candidate.height >= Math.max(valid.bottom, open.bottom) - 4
    );

    if (!validCandidate || falseOpening || mergedOpening) {
      const failure = { name, validCandidate, falseOpening, mergedOpening, candidates };
      await fs.writeFile(diagnostic, `${JSON.stringify(failure, null, 2)}\n`);
      console.error(`${name} regression failed.`);
      console.error(JSON.stringify(failure));
      process.exit(1);
    }
  };

  await runCase({
    name: "Adjacent perspective valid/open",
    valid: { left: 18, right: 38, top: 12, bottom: 52 },
    open: { left: 40, right: 60, top: 14, bottom: 54 },
    validSlope: 3,
    openSlope: 3,
    diagnostic: "adjacent-perspective-valid-open-clutter-diagnostic.json"
  });

  await runCase({
    name: "Adjacent opposing-slope perspective valid/open",
    valid: { left: 18, right: 38, top: 12, bottom: 52 },
    open: { left: 40, right: 60, top: 14, bottom: 54 },
    validSlope: 3,
    openSlope: -3,
    diagnostic: "adjacent-opposing-perspective-slopes-diagnostic.json"
  });

  await runCase({
    name: "Unequal-height asymmetric perspective valid/open",
    valid: { left: 15, right: 35, top: 8, bottom: 57 },
    open: { left: 37, right: 62, top: 18, bottom: 49 },
    validSlope: 5,
    openSlope: -2,
    diagnostic: "unequal-height-asymmetric-perspective-diagnostic.json"
  });

  console.log("Adjacent perspective valid/open smoke passed: real skewed openings survived while matching, opposing-slope, and unequal-height incomplete neighbors stayed rejected without merged masks.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
