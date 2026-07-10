import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const detectorPath = "src/core/architecturalDetector.ts";
const source = await fs.readFile(detectorPath, "utf8");

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const tempPath = path.join(os.tmpdir(), `glowcast-detector-${Date.now()}.mjs`);
await fs.writeFile(tempPath, transpiled);

try {
  const { detectArchitecturalCandidates } = await import(pathToFileURL(tempPath).href);

  function getCandidates(edgePoints, onDiagnostics) {
    return detectArchitecturalCandidates(edgePoints, {
      gridResolution: 100,
      minDensityThreshold: 1,
      minSizePercent: 5,
      maxSizePercent: 50,
      onDiagnostics
    });
  }

  function assertCompleteFrame(name, edgePoints, expected) {
    const candidates = getCandidates(edgePoints);

    const completeCandidate = candidates.find(
      (candidate) =>
        candidate.confidence >= 70 &&
        candidate.width >= expected.minWidth &&
        candidate.height >= expected.minHeight &&
        /Complete (Window|Door|Structure)/.test(candidate.label)
    );

    if (!completeCandidate) {
      console.error(`${name} synthetic frame smoke test failed. Expected one complete architectural frame candidate.`);
      console.error(JSON.stringify(candidates, null, 2));
      process.exit(1);
    }

    console.log(`${name} synthetic frame smoke test passed:`, completeCandidate.label);
  }

  const cornerBreakFrame = [];
  const addCorner = (x, y) => cornerBreakFrame.push({ x, y, strength: 1 });

  // A rectangular architectural frame with one-cell corner breaks.
  // The expected behavior is that diagonal bridging + 8-connected labeling
  // keeps this as one full window/door candidate instead of separate fragments.
  for (let x = 20; x <= 49; x += 1) addCorner(x, 20);
  for (let y = 21; y <= 50; y += 1) addCorner(50, y);
  for (let x = 21; x <= 50; x += 1) addCorner(x, 50);
  for (let y = 20; y <= 49; y += 1) addCorner(20, y);
  assertCompleteFrame("Broken-corner", cornerBreakFrame, { minWidth: 28, minHeight: 28 });

  const thinGapFrame = [];
  const addThinGap = (x, y) => thinGapFrame.push({ x, y, strength: 1 });

  // A larger window/door frame with repeated 3-cell breaks along straight trim.
  // Real photos often have broken painted edges, glare, shadows, or mullions that
  // interrupt the edge trace. The detector should still close these into one mask.
  for (let x = 15; x <= 65; x += 1) if (x < 33 || x > 36) addThinGap(x, 18);
  for (let y = 18; y <= 58; y += 1) if (y < 37 || y > 40) addThinGap(65, y);
  for (let x = 15; x <= 65; x += 1) if (x < 42 || x > 45) addThinGap(x, 58);
  for (let y = 18; y <= 58; y += 1) if (y < 27 || y > 30) addThinGap(15, y);
  assertCompleteFrame("Thin-gap", thinGapFrame, { minWidth: 48, minHeight: 38 });

  const lFragment = [];
  for (let x = 20; x <= 50; x += 1) lFragment.push({ x, y: 20, strength: 1 });
  for (let y = 20; y <= 50; y += 1) lFragment.push({ x: 20, y, strength: 1 });
  let lFragmentDiagnostics = null;
  const lFragmentCandidates = getCandidates(lFragment, (diagnostics) => {
    lFragmentDiagnostics = diagnostics;
  });
  if (lFragmentCandidates.length > 0) {
    console.error("Two-sided L-fragment smoke test failed. Open corner fragment became an architectural candidate.");
    console.error(JSON.stringify(lFragmentCandidates, null, 2));
    process.exit(1);
  }
  if (!lFragmentDiagnostics || lFragmentDiagnostics.rejectedClosure < 1 || lFragmentDiagnostics.selected !== 0) {
    console.error("Detector diagnostics smoke test failed. Closure rejection was not counted.");
    console.error(JSON.stringify(lFragmentDiagnostics, null, 2));
    process.exit(1);
  }
  console.log("Two-sided L-fragment smoke test passed: open corner fragment rejected and counted.");
} finally {
  await fs.rm(tempPath, { force: true });
}
