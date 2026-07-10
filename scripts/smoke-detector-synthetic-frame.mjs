import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const typescriptModule = require("typescript");
const ts = typescriptModule?.transpileModule
  ? typescriptModule
  : typescriptModule?.default?.transpileModule
    ? typescriptModule.default
    : null;

if (!ts) {
  throw new TypeError("Unable to load the TypeScript compiler API");
}

const requestedCase = process.argv[2] ?? "all";
const validCases = new Set(["all", "broken-corner", "thin-gap", "l-fragment"]);

if (!validCases.has(requestedCase)) {
  console.error(`Unknown synthetic detector smoke case: ${requestedCase}`);
  process.exit(2);
}

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
} finally {
  await fs.rm(tempPath, { force: true });
}
