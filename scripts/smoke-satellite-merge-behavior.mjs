import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-satellite-behavior-"));
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

function covers(box, expected) {
  return (
    box.x <= expected.x + expected.tolerance &&
    box.y <= expected.y + expected.tolerance &&
    box.x + box.width >= expected.x + expected.width - expected.tolerance &&
    box.y + box.height >= expected.y + expected.height - expected.tolerance
  );
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  const grouped = groupNearbySatellites(
    [
      candidate("window", { x: 42, y: 24, width: 20, height: 28 }),
      candidate("left_shutter", { x: 34, y: 25, width: 4, height: 26 }),
      candidate("right_shutter", { x: 66, y: 25, width: 4, height: 26 })
    ],
    bounds
  );

  if (grouped.length !== 1 || !covers(grouped[0].box, { x: 34, y: 24, width: 36, height: 28, tolerance: 0.1 })) {
    console.error("Satellite behavior smoke failed. Useful shutters/trim did not merge into the parent mask.");
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  const rejected = groupNearbySatellites(
    [
      candidate("window", { x: 42, y: 24, width: 20, height: 28 }),
      candidate("thin_fragment", { x: 66, y: 25, width: 1.5, height: 26 })
    ],
    bounds
  );

  const inflatedParent = rejected.find((mask) => mask.id === "window" && mask.box.width > 22);
  if (rejected.length !== 2 || inflatedParent) {
    console.error("Satellite behavior smoke failed. Thin aligned fragment inflated the parent mask.");
    console.error(JSON.stringify(rejected, null, 2));
    process.exit(1);
  }

  const repeatedRow = groupNearbySatellites(
    [
      candidate("window_left", { x: 12, y: 28, width: 18, height: 30 }),
      candidate("window_center", { x: 34, y: 28, width: 18, height: 30 }),
      candidate("window_right", { x: 56, y: 28, width: 18, height: 30 })
    ],
    bounds
  );

  const repeatedRowChanged = repeatedRow.some(
    (mask) => mask.box.width !== 18 || mask.box.height !== 30
  );
  if (repeatedRow.length !== 3 || repeatedRowChanged) {
    console.error("Satellite behavior smoke failed. Repeated adjacent openings collapsed into an oversized row mask.");
    console.error(JSON.stringify(repeatedRow, null, 2));
    process.exit(1);
  }

  const repeatedRowWithTrim = groupNearbySatellites(
    [
      candidate("window_left", { x: 10, y: 28, width: 18, height: 30 }),
      candidate("left_shutter", { x: 5, y: 29, width: 3, height: 28 }),
      candidate("window_center", { x: 34, y: 28, width: 18, height: 30 }),
      candidate("window_right", { x: 58, y: 28, width: 18, height: 30 })
    ],
    bounds
  );

  const trimmedLeft = repeatedRowWithTrim.find((mask) => mask.id === "window_left");
  const untouchedCenter = repeatedRowWithTrim.find((mask) => mask.id === "window_center");
  const untouchedRight = repeatedRowWithTrim.find((mask) => mask.id === "window_right");
  if (
    repeatedRowWithTrim.length !== 3 ||
    !trimmedLeft ||
    !covers(trimmedLeft.box, { x: 5, y: 28, width: 23, height: 30, tolerance: 0.1 }) ||
    !untouchedCenter ||
    untouchedCenter.box.width !== 18 ||
    !untouchedRight ||
    untouchedRight.box.width !== 18
  ) {
    console.error("Satellite behavior smoke failed. Trim grouping damaged neighboring openings in a repeated row.");
    console.error(JSON.stringify(repeatedRowWithTrim, null, 2));
    process.exit(1);
  }

  console.log(
    "Satellite behavior smoke passed: useful trim merges, thin fragments are rejected, and repeated openings stay separate."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
