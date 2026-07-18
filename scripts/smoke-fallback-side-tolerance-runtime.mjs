import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-side-tolerance-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function getFallbackSideCoverage", "export function getFallbackSideCoverage")
);
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", sourcePath, "--ignoreConfig", "--rootDir", sourceRoot,
  "--outDir", outDir, "--module", "ES2020", "--target", "ES2020",
  "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
const emittedAdapter = await fs.readFile(emittedAdapterPath, "utf8");
const emittedDetector = await fs.readFile(emittedDetectorPath, "utf8");
await fs.writeFile(emittedAdapterPath, emittedAdapter.replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, emittedDetector.replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

function addFrame(points, box, inset = 0) {
  const x1 = box.x + inset;
  const y1 = box.y + inset;
  const x2 = box.x + box.width - inset;
  const y2 = box.y + box.height - inset;
  for (let x = x1; x <= x2; x += 8) points.push({ x, y: y1, strength: 220 }, { x, y: y2, strength: 220 });
  for (let y = y1; y <= y2; y += 8) points.push({ x: x1, y, strength: 220 }, { x: x2, y, strength: 220 });
}

try {
  const { getFallbackSideCoverage } = await import(pathToFileURL(emittedAdapterPath).href);
  const box = { x: 100, y: 100, width: 800, height: 600 };

  const exactPerimeter = [];
  addFrame(exactPerimeter, box, 0);
  const exactCoverage = getFallbackSideCoverage(exactPerimeter, box);
  if (exactCoverage.sides !== 4) {
    throw new Error(`Actual architectural perimeter should support all four sides, got ${JSON.stringify(exactCoverage)}`);
  }

  const insetTrim = [];
  addFrame(insetTrim, box, 20);
  const insetCoverage = getFallbackSideCoverage(insetTrim, box);
  if (insetCoverage.sides !== 0) {
    throw new Error(`Inset trim must not close the outer fallback mask, got ${JSON.stringify(insetCoverage)}`);
  }

  console.log("Fallback side tolerance runtime smoke passed: actual perimeter accepted; inset trim rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
