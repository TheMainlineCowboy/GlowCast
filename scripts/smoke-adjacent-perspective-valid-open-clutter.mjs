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

  const runCase = async ({
    name,
    valid,
    open,
    validSlope,
    openSlope,
    validTaper = 0,
    openTaper = 0,
    validOcclusion = "top-left",
    openOcclusion = "top-left",
    diagnostic
  }) => {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    const addPerspectiveFrame = (frame, strength, slope, taper = 0, skip = () => false) => {
      const height = frame.bottom - frame.top;
      const drift = Math.abs(slope);
      for (let y = frame.top; y <= frame.bottom; y += 1) {
        const progress = (y - frame.top) / height;
        const shift = Math.floor(progress * drift) * Math.sign(slope);
        const inset = Math.round(progress * taper);
        const leftX = frame.left + shift + inset;
        const rightX = frame.right + shift - inset;
        if (!skip(leftX, y, "left")) addPoint(leftX, y, strength);
        if (!skip(rightX, y, "right")) addPoint(rightX, y, strength);
      }
      for (let x = frame.left; x <= frame.right; x += 1) {
        const progress = (x - frame.left) / (frame.right - frame.left);
        const edgeShift = Math.round(progress * drift) * Math.sign(slope);
        if (!skip(x, frame.top + Math.round(progress), "top")) addPoint(x, frame.top + Math.round(progress), strength);
        const bottomInset = Math.round(taper * Math.min(progress, 1 - progress) * 2);
        if (!skip(x + edgeShift, frame.bottom + Math.round(progress), "bottom")) {
          addPoint(x + edgeShift + Math.sign(0.5 - progress) * bottomInset, frame.bottom + Math.round(progress), strength);
        }
      }
    };

    const validSkip = (x, y, edge) => validOcclusion === "lower-right"
      ? (edge === "bottom" && x >= valid.right - 8) || (edge === "right" && y >= valid.bottom - 10)
      : (edge === "top" && x <= valid.left + 6) || (edge === "left" && y <= valid.top + 8);
    const openSkip = (x, y, edge) => openOcclusion === "lower-right"
      ? (edge === "bottom" && x >= open.right - 13) || (edge === "right" && y >= open.bottom - 20)
      : (edge === "top" && x <= open.left + 13) || (edge === "left" && y <= open.top + 22);

    addPerspectiveFrame(valid, 0.58, validSlope, validTaper, validSkip);
    addPerspectiveFrame(open, 0.55, openSlope, openTaper, openSkip);

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
      candidate.x >= expected.left - 5 && candidate.x <= expected.left + 7 &&
      candidate.y >= expected.top - 3 && candidate.y <= expected.top + 4 &&
      candidate.width >= expected.right - expected.left - 7 && candidate.width <= expected.right - expected.left + 12 &&
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

  const runThreeOutlineCase = async () => {
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
        if (!skip(x, frame.top + Math.round(progress), "top")) addPoint(x, frame.top + Math.round(progress), strength);
        if (!skip(x + Math.round(progress * slope), frame.bottom + Math.round(progress), "bottom")) {
          addPoint(x + Math.round(progress * slope), frame.bottom + Math.round(progress), strength);
        }
      }
    };

    const leftValid = { left: 8, right: 31, top: 8, bottom: 58 };
    const centerOpen = { left: 27, right: 51, top: 15, bottom: 61 };
    const rightValid = { left: 47, right: 70, top: 10, bottom: 55 };

    addFrame(leftValid, 0.58, 5, 4, (x, y, edge) =>
      (edge === "right" && y >= 29 && y <= 43) || (edge === "bottom" && x >= 25));
    addFrame(centerOpen, 0.55, -3, 2, (x, y, edge) =>
      (edge === "left" && y <= 39) || (edge === "top" && x <= 42) || (edge === "right" && y >= 44));
    addFrame(rightValid, 0.57, -4, 3, (x, y, edge) =>
      (edge === "left" && y >= 24 && y <= 37) || (edge === "top" && x <= 54));

    for (let offset = 0; offset <= 62; offset += 1) {
      const x = 7 + offset;
      const y = 20 + Math.floor(offset * 0.28);
      for (let thickness = -2; thickness <= 2; thickness += 1) addPoint(x, y + thickness, 0.32);
    }
    for (let offset = 0; offset <= 58; offset += 1) {
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
      await fs.writeFile("three-outline-overlapping-perspective-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
      console.error("Three-outline overlapping perspective regression failed.");
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

  await runCase({
    name: "Keystone perspective with lower-corner occlusion",
    valid: { left: 14, right: 39, top: 8, bottom: 58 },
    open: { left: 41, right: 64, top: 17, bottom: 50 },
    validSlope: 4,
    openSlope: -2,
    validTaper: 3,
    validOcclusion: "lower-right",
    diagnostic: "keystone-lower-corner-occlusion-diagnostic.json"
  });

  await runCase({
    name: "Open keystone lower corner stays rejected",
    valid: { left: 13, right: 35, top: 10, bottom: 55 },
    open: { left: 37, right: 64, top: 14, bottom: 53 },
    validSlope: 2,
    openSlope: -4,
    openTaper: 3,
    openOcclusion: "lower-right",
    diagnostic: "open-keystone-lower-corner-diagnostic.json"
  });

  await runCase({
    name: "Mixed valid and open keystone lower corners",
    valid: { left: 12, right: 37, top: 8, bottom: 58 },
    open: { left: 39, right: 66, top: 13, bottom: 54 },
    validSlope: 4,
    openSlope: -4,
    validTaper: 3,
    openTaper: 3,
    validOcclusion: "lower-right",
    openOcclusion: "lower-right",
    diagnostic: "mixed-keystone-lower-corners-diagnostic.json"
  });

  await runCase({
    name: "Mixed keystone taper with overlapping vertical spans",
    valid: { left: 11, right: 38, top: 7, bottom: 56 },
    open: { left: 40, right: 65, top: 16, bottom: 61 },
    validSlope: 5,
    openSlope: -2,
    validTaper: 5,
    openTaper: 1,
    validOcclusion: "lower-right",
    openOcclusion: "lower-right",
    diagnostic: "mixed-keystone-overlapping-spans-diagnostic.json"
  });

  await runCase({
    name: "Mixed keystone silhouettes with horizontal and vertical overlap",
    valid: { left: 10, right: 42, top: 7, bottom: 58 },
    open: { left: 38, right: 67, top: 15, bottom: 62 },
    validSlope: 5,
    openSlope: -3,
    validTaper: 5,
    openTaper: 2,
    validOcclusion: "lower-right",
    openOcclusion: "lower-right",
    diagnostic: "mixed-keystone-horizontal-overlap-diagnostic.json"
  });

  await runThreeOutlineCase();

  console.log("Adjacent perspective valid/open smoke passed: real skewed openings survived matching, opposing-slope, unequal-height, varied-keystone lower-corner occlusion, and three-outline overlap cases while incomplete neighbors stayed rejected without merged masks.");
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
