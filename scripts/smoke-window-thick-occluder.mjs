import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-window-thick-occluder-"));
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
  const frame = { left: 18, right: 52, top: 12, bottom: 58 };

  const runCase = async ({
    name,
    hiddenEdgeStart = null,
    hiddenEdgeEnd = null,
    occluderStartY = 23,
    occluderSlope = 0.52,
    occluderStrength = 0.48
  }) => {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    for (let x = frame.left; x <= frame.right; x += 1) {
      addPoint(x, frame.top, 0.9);
      addPoint(x, frame.bottom, 0.9);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      const hidesLeftEdge = hiddenEdgeStart !== null && hiddenEdgeEnd !== null && y >= hiddenEdgeStart && y <= hiddenEdgeEnd;
      if (!hidesLeftEdge) {
        addPoint(frame.left, y, 0.9);
      }
      addPoint(frame.right, y, 0.9);
    }

    // A thick foreground limb or railing crosses the opening diagonally. Harder
    // cases also hide part of the outer-left frame, including a longer section
    // near the top-left corner. It must remain clutter rather than a false mullion.
    for (let offset = 0; offset <= 42; offset += 1) {
      const x = 14 + offset;
      const y = occluderStartY + Math.floor(offset * occluderSlope);
      for (let thickness = -2; thickness <= 2; thickness += 1) {
        addPoint(x, y + thickness, occluderStrength);
      }
    }

    const candidates = detectArchitecturalCandidates(scene, {
      gridResolution: 100,
      minDensityThreshold: 1,
      minSizePercent: 5,
      maxSizePercent: 70
    });

    const fullFrame = candidates.find(
      (candidate) =>
        candidate.x >= 16 &&
        candidate.x <= 20 &&
        candidate.y >= 10 &&
        candidate.y <= 14 &&
        candidate.width >= 31 &&
        candidate.width <= 38 &&
        candidate.height >= 43 &&
        candidate.height <= 50
    );

    const splitFragments = candidates.filter(
      (candidate) =>
        candidate.x >= 16 &&
        candidate.x <= 54 &&
        candidate.y >= 10 &&
        candidate.y <= 60 &&
        candidate.width >= 10 &&
        candidate.width < 28 &&
        candidate.height >= 12 &&
        candidate.height < 42
    );

    if (!fullFrame || splitFragments.length > 0) {
      const failure = { name, candidates, fullFrame, splitFragments };
      await fs.writeFile("window-thick-occluder-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
      console.error(`${name} regression failed. Diagnostic artifact written.`);
      console.error(JSON.stringify(failure));
      process.exit(1);
    }
  };

  const runOpenFragmentCase = async () => {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    // Three strong sides and only short corner stubs on the fourth side form a
    // genuinely open wall fragment. A nearby thick diagonal obstruction must not
    // be used as invented closure for a false architectural opening.
    for (let x = frame.left; x <= frame.right; x += 1) {
      addPoint(x, frame.top, 0.9);
      addPoint(x, frame.bottom, 0.9);
    }
    for (let y = frame.top; y <= frame.bottom; y += 1) {
      addPoint(frame.right, y, 0.9);
      if (y <= frame.top + 3 || y >= frame.bottom - 3) {
        addPoint(frame.left, y, 0.9);
      }
    }

    for (let offset = 0; offset <= 30; offset += 1) {
      const x = 13 + offset;
      const y = 10 + Math.floor(offset * 0.3);
      for (let thickness = -2; thickness <= 2; thickness += 1) {
        addPoint(x, y + thickness, 0.44);
      }
    }

    const candidates = detectArchitecturalCandidates(scene, {
      gridResolution: 100,
      minDensityThreshold: 1,
      minSizePercent: 5,
      maxSizePercent: 70
    });

    const falseClosure = candidates.find(
      (candidate) =>
        candidate.x >= 16 &&
        candidate.x <= 20 &&
        candidate.y >= 10 &&
        candidate.y <= 14 &&
        candidate.width >= 31 &&
        candidate.width <= 38 &&
        candidate.height >= 43 &&
        candidate.height <= 50
    );

    if (falseClosure) {
      const failure = { name: "Open corner fragment near thick occluder", candidates, falseClosure };
      await fs.writeFile("window-thick-occluder-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
      console.error("Open corner fragment regression failed: clutter was treated as architectural closure.");
      console.error(JSON.stringify(failure));
      process.exit(1);
    }
  };

  await runCase({ name: "Thick-occluder window" });
  await runCase({
    name: "Hidden-edge thick-occluder window",
    hiddenEdgeStart: 31,
    hiddenEdgeEnd: 35,
    occluderStartY: 30,
    occluderSlope: 0.34,
    occluderStrength: 0.46
  });
  await runCase({
    name: "Long corner-edge thick-occluder window",
    hiddenEdgeStart: 13,
    hiddenEdgeEnd: 21,
    occluderStartY: 12,
    occluderSlope: 0.28,
    occluderStrength: 0.44
  });
  await runOpenFragmentCase();

  console.log(
    "Thick-occluder window smoke test passed: occluded frames remained whole while a genuinely open corner fragment stayed rejected."
  );
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
