import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-full-span-border-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function buildFallbackComponents", "export function buildFallbackComponents"));
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

function addClosedFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  for (let x = x1; x <= x2; x += 1) {
    edgePoints.push({ x, y: y1, strength }, { x, y: y2, strength });
  }
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
}

function addCornerConcentratedFrame(edgePoints, x1, y1, x2, y2, strength = 220) {
  for (let y = y1; y <= y2; y += 1) {
    edgePoints.push({ x: x1, y, strength }, { x: x2, y, strength });
  }
  for (let offset = 0; offset <= 5; offset += 1) {
    edgePoints.push(
      { x: x1 + offset, y: y1, strength },
      { x: x2 - offset, y: y1, strength },
      { x: x1 + offset, y: y2, strength },
      { x: x2 - offset, y: y2, strength }
    );
  }
}

try {
  const { buildFallbackComponents } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const normalDoorEdges = [];
  addClosedFrame(normalDoorEdges, 40, 15, 60, 82);
  const normalDoor = buildFallbackComponents(normalDoorEdges, bounds);
  if (normalDoor.length !== 1) {
    throw new Error(`Normal closed doorway should remain eligible, got ${JSON.stringify(normalDoor)}`);
  }

  const largeTallOpeningEdges = [];
  addClosedFrame(largeTallOpeningEdges, 35, 5, 65, 95);
  const largeTallOpening = buildFallbackComponents(largeTallOpeningEdges, bounds);
  if (largeTallOpening.length !== 1) {
    throw new Error(`Large closed architectural opening with distributed perimeter evidence should remain eligible, got ${JSON.stringify(largeTallOpening)}`);
  }

  const cornerConcentratedOpeningEdges = [];
  addCornerConcentratedFrame(cornerConcentratedOpeningEdges, 35, 5, 65, 95);
  const cornerConcentratedOpening = buildFallbackComponents(cornerConcentratedOpeningEdges, bounds);
  if (cornerConcentratedOpening.length !== 0) {
    throw new Error(`Full-span outline with perimeter evidence concentrated near corners should be rejected, got ${JSON.stringify(cornerConcentratedOpening)}`);
  }

  const fullHeightBorderEdges = [];
  addClosedFrame(fullHeightBorderEdges, 45, 5, 55, 95);
  const fullHeightBorder = buildFallbackComponents(fullHeightBorderEdges, bounds);
  if (fullHeightBorder.length !== 0) {
    throw new Error(`Near-full-height narrow wall border should be rejected, got ${JSON.stringify(fullHeightBorder)}`);
  }

  const fullWidthBorderEdges = [];
  addClosedFrame(fullWidthBorderEdges, 5, 45, 95, 55);
  const fullWidthBorder = buildFallbackComponents(fullWidthBorderEdges, bounds);
  if (fullWidthBorder.length !== 0) {
    throw new Error(`Near-full-width narrow facade border should be rejected, got ${JSON.stringify(fullWidthBorder)}`);
  }

  console.log("Full-span fallback runtime smoke passed: distributed large openings accepted; corner-concentrated and narrow border masks rejected.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
