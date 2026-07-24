import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-bridge-recovery-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function recoverSparseBridgeComponents", "export function recoverSparseBridgeComponents")
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

function addClosedFrame(points, x1, y1, x2, y2) {
  for (let x = x1; x <= x2; x += 1) points.push({ x, y: y1, strength: 220 }, { x, y: y2, strength: 220 });
  for (let y = y1; y <= y2; y += 1) points.push({ x: x1, y, strength: 220 }, { x: x2, y, strength: 220 });
}

try {
  const { recoverSparseBridgeComponents } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const bridgedOpenings = [];
  addClosedFrame(bridgedOpenings, 12, 28, 31, 62);
  addClosedFrame(bridgedOpenings, 69, 28, 88, 62);
  for (let x = 32; x < 69; x += 1) bridgedOpenings.push({ x, y: 45, strength: 220 });

  const recovered = recoverSparseBridgeComponents(
    bridgedOpenings,
    { x: 12, y: 28, width: 76, height: 34 },
    bounds
  );
  if (recovered.length !== 2) {
    throw new Error(`Expected two recovered openings, received ${recovered.length}.`);
  }
  if (recovered.some((candidate) => candidate.width > 28 || candidate.height < 25)) {
    throw new Error("Recovered regions should remain compact around the individual architectural openings.");
  }

  const continuousFrame = [];
  addClosedFrame(continuousFrame, 12, 28, 88, 62);
  const continuousRecovery = recoverSparseBridgeComponents(
    continuousFrame,
    { x: 12, y: 28, width: 76, height: 34 },
    bounds
  );
  if (continuousRecovery.length !== 0) {
    throw new Error("A continuous large architectural frame must not be split into artificial openings.");
  }

  console.log("Thin-bridge recovery runtime smoke passed: two closed openings are recovered from sparse bridge clutter while a continuous large frame remains intact.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
