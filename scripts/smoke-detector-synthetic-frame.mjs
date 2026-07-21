import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const requestedCase = process.argv[2] ?? "all";
const validCases = new Set(["all", "broken-corner", "thin-gap", "l-fragment", "directional-texture"]);

if (!validCases.has(requestedCase)) {
  console.error(`Unknown synthetic detector smoke case: ${requestedCase}`);
  process.exit(2);
}

const detectorPath = "src/core/architecturalDetector.ts";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-detector-"));
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

  function getCandidates(edgePoints, onDiagnostics) {
    return detectArchitecturalCandidates(edgePoints, {
      gridResolution: 100,
      minDensityThreshold: 1,
      minSizePercent: 5,
      maxSizePercent: 60,
      onDiagnostics
    });
  }

  async function assertCompleteFrame(name, edgePoints, expected) {
    let diagnostics = null;
    const candidates = getCandidates(edgePoints, (value) => {
      diagnostics = value;
    });
    const completeCandidate = candidates.find(
      (candidate) =>
        candidate.confidence >= 70 &&
        candidate.width >= expected.minWidth &&
        candidate.height >= expected.minHeight
    );

    if (!completeCandidate) {
      const failure = {
        requestedCase,
        name,
        expected,
        edgePointCount: edgePoints.length,
        diagnostics,
        candidates
      };
      await fs.writeFile("synthetic-frame-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
      console.error(`${name} synthetic frame smoke test failed. Diagnostic artifact written.`);
      console.error(JSON.stringify(failure));
      throw new Error(`${name} synthetic frame smoke test failed`);
    }

    console.log(`${name} synthetic frame smoke test passed:`, completeCandidate.label);
  }

  if (requestedCase === "all" || requestedCase === "broken-corner") {
    const cornerBreakFrame = [];
    const addCorner = (x, y) => cornerBreakFrame.push({ x, y, strength: 1 });
    for (let x = 20; x <= 49; x += 1) addCorner(x, 20);
    for (let y = 21; y <= 50; y += 1) addCorner(50, y);
    for (let x = 21; x <= 50; x += 1) addCorner(x, 50);
    for (let y = 20; y <= 49; y += 1) addCorner(20, y);
    await assertCompleteFrame("Broken-corner", cornerBreakFrame, { minWidth: 28, minHeight: 28 });
  }

  if (requestedCase === "all" || requestedCase === "thin-gap") {
    const thinGapFrame = [];
    const addThinGap = (x, y) => thinGapFrame.push({ x, y, strength: 1 });
    for (let x = 15; x <= 65; x += 1) if (x < 33 || x > 35) addThinGap(x, 18);
    for (let y = 18; y <= 58; y += 1) if (y < 37 || y > 39) addThinGap(65, y);
    for (let x = 15; x <= 65; x += 1) if (x < 42 || x > 44) addThinGap(x, 58);
    for (let y = 18; y <= 58; y += 1) if (y < 27 || y > 29) addThinGap(15, y);
    await assertCompleteFrame("Thin-gap", thinGapFrame, { minWidth: 48, minHeight: 38 });
  }

  if (requestedCase === "all" || requestedCase === "l-fragment") {
    const lFragment = [];
    for (let x = 20; x <= 50; x += 1) lFragment.push({ x, y: 20, strength: 1 });
    for (let y = 20; y <= 50; y += 1) lFragment.push({ x: 20, y, strength: 1 });
    let lFragmentDiagnostics = null;
    const lFragmentCandidates = getCandidates(lFragment, (diagnostics) => {
      lFragmentDiagnostics = diagnostics;
    });
    if (lFragmentCandidates.length > 0) {
      console.error("Two-sided L-fragment smoke test failed. Open corner fragment became an architectural candidate.");
      console.error(JSON.stringify(lFragmentCandidates));
      process.exit(1);
    }
    if (!lFragmentDiagnostics || lFragmentDiagnostics.rejectedClosure < 1 || lFragmentDiagnostics.selected !== 0) {
      console.error("Detector diagnostics smoke test failed. Closure rejection was not counted.");
      console.error(JSON.stringify(lFragmentDiagnostics));
      process.exit(1);
    }
    console.log("Two-sided L-fragment smoke test passed: open corner fragment rejected and counted.");
  }

  if (requestedCase === "all" || requestedCase === "directional-texture") {
    const scene = [];
    const addPoint = (x, y, strength = 1) => scene.push({ x, y, strength });

    // A glare-obscured window with fragmented edges and nearby vegetation clutter.
    for (let x = 27; x <= 55; x += 1) {
      if (x < 38 || x > 42) addPoint(x, 9, 0.82);
      if (x < 45 || x > 48) addPoint(x, 39, 0.9);
    }
    for (let y = 9; y <= 39; y += 1) {
      if (y < 22 || y > 25) addPoint(27, y, 0.9);
      if (y < 15 || y > 19) addPoint(55, y, 0.72);
    }
    for (let offset = 0; offset <= 12; offset += 1) {
      addPoint(12 + offset, 14 + offset, 0.45);
      if (offset % 2 === 0) addPoint(18 + offset, 31 - offset, 0.4);
    }

    // A valid balanced architectural frame in the upper-right of the scene.
    for (let x = 68; x <= 92; x += 1) {
      addPoint(x, 10);
      addPoint(x, 36);
    }
    for (let y = 10; y <= 36; y += 1) {
      addPoint(68, y);
      addPoint(92, y);
    }

    // A partially shadowed doorway with short gaps and weaker evidence on its shaded side.
    for (let x = 70; x <= 90; x += 1) {
      if (x < 78 || x > 80) addPoint(x, 52, 1);
      if (x < 83 || x > 85) addPoint(x, 94, 1);
    }
    for (let y = 52; y <= 94; y += 1) {
      if (y < 68 || y > 70) addPoint(70, y, 1);
      if (y < 78 || y > 80) addPoint(90, y, 0.7);
    }

    // A broad connected reflection/texture component dominated by horizontal evidence.
    for (let y = 65; y <= 89; y += 4) {
      for (let x = 5; x <= 55; x += 1) addPoint(x, y);
    }
    for (let y = 65; y <= 89; y += 1) addPoint(5, y);

    let diagnostics = null;
    const candidates = getCandidates(scene, (value) => {
      diagnostics = value;
    });
    const preservedGlareWindow = candidates.find(
      (candidate) =>
        candidate.x >= 24 &&
        candidate.x <= 30 &&
        candidate.y <= 12 &&
        candidate.width >= 26 &&
        candidate.height >= 28
    );
    const preservedFrame = candidates.find(
      (candidate) =>
        candidate.x >= 65 &&
        candidate.y <= 12 &&
        candidate.width >= 22 &&
        candidate.height >= 24
    );
    const preservedShadowedDoorway = candidates.find(
      (candidate) =>
        candidate.x >= 67 &&
        candidate.y >= 49 &&
        candidate.width >= 18 &&
        candidate.height >= 39
    );
    const leakedTexture = candidates.find(
      (candidate) =>
        candidate.x <= 8 &&
        candidate.y >= 60 &&
        candidate.width >= 45 &&
        candidate.height >= 20
    );

    if (!preservedGlareWindow || !preservedFrame || !preservedShadowedDoorway || leakedTexture) {
      const failure = {
        requestedCase,
        diagnostics,
        candidates,
        preservedGlareWindow,
        preservedFrame,
        preservedShadowedDoorway,
        leakedTexture
      };
      await fs.writeFile("directional-texture-diagnostic.json", `${JSON.stringify(failure, null, 2)}\n`);
      console.error("Directional-texture regression failed. Diagnostic artifact written.");
      console.error(JSON.stringify(failure));
      process.exit(1);
    }

    console.log(
      "Directional-texture smoke test passed: broad texture rejected while glare-obscured window, balanced frame, and shadowed doorway were preserved."
    );
  }
} finally {
  await fs.rm(tempDir, { force: true, recursive: true });
}
