import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-distinct-nearby-mullions-"));
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

function unchanged(actual, expected) {
  return (
    actual &&
    actual.box.x === expected.x &&
    actual.box.y === expected.y &&
    actual.box.width === expected.width &&
    actual.box.height === expected.height
  );
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const leftWindow = { x: 22, y: 25, width: 20, height: 30 };
  const rightWindow = { x: 58, y: 25, width: 20, height: 30 };
  const confidentLeftMullion = { x: 43.4, y: 27, width: 1.4, height: 26 };
  const ambiguousSharedMullion = { x: 46.1, y: 28, width: 3.6, height: 24 };

  const grouped = groupNearbySatellites(
    [
      candidate("left_window", leftWindow),
      candidate("right_window", rightWindow),
      candidate("confident_left_mullion", confidentLeftMullion),
      candidate("ambiguous_shared_mullion", ambiguousSharedMullion)
    ],
    bounds
  );

  const byId = new Map(grouped.map((mask) => [mask.id, mask]));
  const mergedLeft = byId.get("left_window");
  const preservedShared = byId.get("ambiguous_shared_mullion");

  if (
    grouped.length !== 3 ||
    !mergedLeft ||
    mergedLeft.box.x !== leftWindow.x ||
    mergedLeft.box.x + mergedLeft.box.width < confidentLeftMullion.x + confidentLeftMullion.width ||
    !unchanged(byId.get("right_window"), rightWindow) ||
    !unchanged(preservedShared, ambiguousSharedMullion) ||
    byId.has("confident_left_mullion")
  ) {
    console.error(
      "Distinct-nearby-mullions smoke failed. Confident trim should merge with its single parent while nearby shared trim remains an independent ambiguous mask."
    );
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  console.log(
    "Distinct-nearby-mullions smoke passed: confident single-parent trim merges without absorbing or conflating nearby ambiguous shared trim."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
