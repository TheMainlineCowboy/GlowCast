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

  const edgePoints = [];
  const add = (x, y) => edgePoints.push({ x, y, strength: 1 });

  // A rectangular architectural frame with one-cell corner breaks.
  // The expected behavior is that diagonal bridging + 8-connected labeling
  // keeps this as one full window/door candidate instead of separate fragments.
  for (let x = 20; x <= 49; x += 1) add(x, 20);
  for (let y = 21; y <= 50; y += 1) add(50, y);
  for (let x = 21; x <= 50; x += 1) add(x, 50);
  for (let y = 20; y <= 49; y += 1) add(20, y);

  const candidates = detectArchitecturalCandidates(edgePoints, {
    gridResolution: 100,
    minDensityThreshold: 1,
    minSizePercent: 5,
    maxSizePercent: 50
  });

  const completeCandidate = candidates.find(
    (candidate) =>
      candidate.confidence >= 70 &&
      candidate.width >= 28 &&
      candidate.height >= 28 &&
      /Complete (Window|Door|Structure)/.test(candidate.label)
  );

  if (!completeCandidate) {
    console.error("Synthetic frame smoke test failed. Expected one complete broken-corner frame candidate.");
    console.error(JSON.stringify(candidates, null, 2));
    process.exit(1);
  }

  console.log("Synthetic frame smoke test passed:", completeCandidate.label);
} finally {
  await fs.rm(tempPath, { force: true });
}
