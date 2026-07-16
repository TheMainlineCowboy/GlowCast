import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-stronger-mullion-evidence-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(sourcePath, adapterSource.replace("function groupNearbySatellites", "export function groupNearbySatellites"));
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", sourcePath, "--ignoreConfig", "--rootDir", sourceRoot,
  "--outDir", outDir, "--module", "ES2020", "--target", "ES2020",
  "--moduleResolution", "Bundler", "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
await fs.writeFile(emittedAdapterPath, (await fs.readFile(emittedAdapterPath, "utf8")).replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, (await fs.readFile(emittedDetectorPath, "utf8")).replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

function candidate(id, box) {
  return { id, box, points: [
    { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }
  ] };
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const left = { x: 18, y: 24, width: 22, height: 32 };
  const right = { x: 60, y: 24, width: 22, height: 32 };

  const ambiguous = { x: 47.5, y: 28, width: 5, height: 24 };
  const ambiguousResult = groupNearbySatellites([
    candidate("left", left), candidate("right", right), candidate("trim", ambiguous)
  ], bounds);
  if (ambiguousResult.length !== 3 || !ambiguousResult.some((mask) => mask.id === "trim")) {
    console.error("Stronger-evidence smoke failed: near-tied trim must remain independent.");
    process.exit(1);
  }

  const clearlyRight = { x: 57.8, y: 28, width: 3.2, height: 24 };
  const strongerResult = groupNearbySatellites([
    candidate("left", left), candidate("right", right), candidate("trim", clearlyRight)
  ], bounds);
  const mergedRight = strongerResult.find((mask) => mask.id === "right");
  if (
    strongerResult.length !== 2 ||
    strongerResult.some((mask) => mask.id === "trim") ||
    !mergedRight ||
    mergedRight.box.x > clearlyRight.x + 0.001
  ) {
    console.error("Stronger-evidence smoke failed: clearly stronger right-side evidence must attach trim to the right opening.");
    console.error(JSON.stringify(strongerResult, null, 2));
    process.exit(1);
  }

  console.log("Stronger-evidence mullion smoke passed: ambiguous trim stays independent, while clearly stronger evidence attaches it to the correct opening.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
