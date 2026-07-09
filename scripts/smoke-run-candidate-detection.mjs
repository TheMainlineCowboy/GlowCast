import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const detectorSource = await fs.readFile("src/core/architecturalDetector.ts", "utf8");
let adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
let runnerSource = await fs.readFile("src/core/runCandidateDetection.ts", "utf8");

adapterSource = adapterSource
  .replace(/import type \{ EdgePoint \} from "\.\.\/edgeDetect";\n/, "")
  .replace(/import \{ detectArchitecturalCandidates \} from "\.\/architecturalDetector";\n/, "");
runnerSource = runnerSource
  .replace(/import type \{ EdgePoint \} from "\.\.\/edgeDetect";\n/, "")
  .replace(/import type \{ Bounds, CandidateZone, Point \} from "\.\/architecturalDetector";\n/, "")
  .replace(/import \{ buildMaskCandidatesFromEdges, type SimpleBox \} from "\.\/maskCandidateAdapter";\n/, "");

const composedSource = `${detectorSource}\n${adapterSource}\n${runnerSource}\n`;
const transpiled = ts.transpileModule(composedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const tempPath = path.join(os.tmpdir(), `glowcast-run-candidate-detection-${Date.now()}.mjs`);
await fs.writeFile(tempPath, transpiled);

function addFrame(edgePoints, x1, y1, x2, y2, strength = 180) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength });
    edgePoints.push({ x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength });
    edgePoints.push({ x: x2, y, strength });
  }
}

function addCornerFragment(edgePoints, x1, y1, x2, y2, strength = 190) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength });
  }
}

try {
  const { runCandidateDetection } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const groupedEdges = [];
  addFrame(groupedEdges, 42, 24, 62, 52);
  addFrame(groupedEdges, 34, 25, 38, 51, 190);
  addFrame(groupedEdges, 66, 25, 70, 51, 190);

  const masks = runCandidateDetection(groupedEdges, bounds);
  const groupedMask = masks.find((mask) => mask.x <= 36 && mask.x + mask.width >= 68 && mask.y <= 26 && mask.y + mask.height >= 50);

  if (!groupedMask) {
    console.error("Run candidate detection smoke test failed. Adapter grouping was not exposed by the exported runner.");
    console.error(JSON.stringify(masks, null, 2));
    process.exit(1);
  }

  if (!Array.isArray(groupedMask.points) || groupedMask.points.length < 3) {
    console.error("Run candidate detection smoke test failed. Exported runner discarded custom outline points.");
    console.error(JSON.stringify(masks, null, 2));
    process.exit(1);
  }

  const pointsAreLocal = groupedMask.points.every(
    (point) => point.x >= -0.01 && point.x <= 100.01 && point.y >= -0.01 && point.y <= 100.01
  );
  const touchesLocalBounds = groupedMask.points.some((point) => point.x <= 0.01 || point.y <= 0.01 || point.x >= 99.99 || point.y >= 99.99);

  if (!pointsAreLocal || !touchesLocalBounds) {
    console.error("Run candidate detection smoke test failed. Custom outline points were not normalized for zone-local clip paths.");
    console.error(JSON.stringify(groupedMask, null, 2));
    process.exit(1);
  }

  const scopedMasks = runCandidateDetection(groupedEdges, bounds, [
    { x: 40, y: 18 },
    { x: 88, y: 18 },
    { x: 88, y: 58 },
    { x: 40, y: 58 }
  ]);

  if (scopedMasks.some((mask) => mask.x < 40)) {
    console.error("Run candidate detection smoke test failed. Polygon scoping leaked outside the selected surface.");
    console.error(JSON.stringify(scopedMasks, null, 2));
    process.exit(1);
  }

  const cornerNoise = [];
  addCornerFragment(cornerNoise, 12, 18, 34, 48);
  const cornerMasks = runCandidateDetection(cornerNoise, bounds);
  if (cornerMasks.length) {
    console.error("Run candidate detection smoke test failed. Fallback accepted an open corner fragment as a mask.");
    console.error(JSON.stringify(cornerMasks, null, 2));
    process.exit(1);
  }

  console.log(`Run candidate detection smoke test passed: ${masks.length} adapter-backed masks exposed with local outline points and corner fragments rejected.`);
} finally {
  await fs.rm(tempPath, { force: true });
}
