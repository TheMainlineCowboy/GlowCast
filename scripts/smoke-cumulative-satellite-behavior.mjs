import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-cumulative-satellite-behavior-"));
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

try {
  const { groupNearbySatellites } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const originalArea = 20 * 28;

  const grouped = groupNearbySatellites(
    [
      candidate("window", { x: 42, y: 24, width: 20, height: 28 }),
      candidate("left_shutter", { x: 34, y: 25, width: 4, height: 26 }),
      candidate("right_shutter", { x: 66, y: 25, width: 4, height: 26 }),
      candidate("excess_top_trim", { x: 42, y: 18, width: 20, height: 4 })
    ],
    bounds
  );

  const parent = grouped.find((mask) => mask.id === "window");
  const retainedExcess = grouped.find((mask) => mask.id === "excess_top_trim");
  const parentArea = parent ? parent.box.width * parent.box.height : Number.POSITIVE_INFINITY;

  if (!parent || !retainedExcess || grouped.length !== 2 || parentArea > originalArea * 2.05 + 0.01) {
    console.error(
      "Cumulative satellite behavior smoke failed. Useful paired trim must merge while excess trim remains separate and the parent stays within its original-area growth bound."
    );
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  console.log(
    "Cumulative satellite behavior smoke passed: useful paired trim merged, excess trim remained separate, and parent growth stayed within 2.05x of its original area."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
