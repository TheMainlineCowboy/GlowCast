import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-jittered-nearby-mullions-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");
const tempPath = path.join(outDir, "core", "maskCandidateAdapter.js");

await fs.mkdir(coreDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n');
await fs.writeFile(
  sourcePath,
  adapterSource.replace("function groupNearbySatellites", "export function groupNearbySatellites")
);
await fs.copyFile(detectorPath, path.join(coreDir, "architecturalDetector.ts"));
await fs.copyFile(edgeDetectPath, path.join(sourceRoot, "edgeDetect.ts"));

execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    sourcePath,
    "--ignoreConfig",
    "--rootDir",
    sourceRoot,
    "--outDir",
    outDir,
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

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
const emittedAdapter = await fs.readFile(emittedAdapterPath, "utf8");
const emittedDetector = await fs.readFile(emittedDetectorPath, "utf8");
await fs.writeFile(
  emittedAdapterPath,
  emittedAdapter.replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"')
);
await fs.writeFile(
  emittedDetectorPath,
  emittedDetector.replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"')
);

function candidate(id, box) {
  return {
    id,
    box,
    points: [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      { x: box.x, y: box.y + box.height }
    ]
  };
}

function unchanged(actual, expected, tolerance = 0.001) {
  return (
    actual &&
    Math.abs(actual.box.x - expected.x) <= tolerance &&
    Math.abs(actual.box.y - expected.y) <= tolerance &&
    Math.abs(actual.box.width - expected.width) <= tolerance &&
    Math.abs(actual.box.height - expected.height) <= tolerance
  );
}

function verifyScenario(groupNearbySatellites, suffix, jitter) {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const leftWindow = { x: 22 + jitter.x, y: 25 + jitter.y, width: 20 + jitter.size, height: 30 + jitter.size };
  const rightWindow = { x: 58 - jitter.x, y: 25 - jitter.y, width: 20 - jitter.size, height: 30 - jitter.size };
  const confidentLeftMullion = { x: 43.4 + jitter.x, y: 27 + jitter.y, width: 1.4 + jitter.size, height: 26 - jitter.size };
  const ambiguousSharedMullion = { x: 46.1 - jitter.x, y: 28 - jitter.y, width: 3.6 - jitter.size, height: 24 + jitter.size };

  const grouped = groupNearbySatellites(
    [
      candidate(`left_window_${suffix}`, leftWindow),
      candidate(`right_window_${suffix}`, rightWindow),
      candidate(`confident_left_mullion_${suffix}`, confidentLeftMullion),
      candidate(`ambiguous_shared_mullion_${suffix}`, ambiguousSharedMullion)
    ],
    bounds
  );

  const byId = new Map(grouped.map((mask) => [mask.id, mask]));
  const mergedLeft = byId.get(`left_window_${suffix}`);
  const preservedShared = byId.get(`ambiguous_shared_mullion_${suffix}`);

  if (
    grouped.length !== 3 ||
    !mergedLeft ||
    mergedLeft.box.x > leftWindow.x + 0.001 ||
    mergedLeft.box.x + mergedLeft.box.width + 0.001 < confidentLeftMullion.x + confidentLeftMullion.width ||
    !unchanged(byId.get(`right_window_${suffix}`), rightWindow) ||
    !unchanged(preservedShared, ambiguousSharedMullion) ||
    byId.has(`confident_left_mullion_${suffix}`)
  ) {
    console.error(
      `Jittered-nearby-mullions smoke failed for ${suffix}. Confident trim should retain its parent while nearby ambiguous trim stays independent.`
    );
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(tempPath).href);
  verifyScenario(groupNearbySatellites, "baseline", { x: 0, y: 0, size: 0 });
  verifyScenario(groupNearbySatellites, "jittered", { x: 0.12, y: -0.09, size: 0.08 });

  console.log(
    "Jittered-nearby-mullions smoke passed: confident trim keeps its correct parent while adjacent ambiguous trim remains separate under coordinate and scale jitter."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
