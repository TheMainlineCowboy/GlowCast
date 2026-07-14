import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-borderline-mullion-"));
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

try {
  const { groupNearbySatellites } = await import(pathToFileURL(tempPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const leftWindow = { x: 20, y: 24, width: 20, height: 32 };
  const rightWindow = { x: 60, y: 24, width: 20, height: 32 };
  const borderlineMullion = { x: 48.6, y: 34, width: 2.8, height: 12 };

  const grouped = groupNearbySatellites(
    [
      candidate("left_window", leftWindow),
      candidate("right_window", rightWindow),
      candidate("borderline_mullion", borderlineMullion)
    ],
    bounds
  );
  const byId = new Map(grouped.map((mask) => [mask.id, mask]));

  if (
    grouped.length !== 3 ||
    !unchanged(byId.get("left_window"), leftWindow) ||
    !unchanged(byId.get("right_window"), rightWindow) ||
    !unchanged(byId.get("borderline_mullion"), borderlineMullion)
  ) {
    console.error(
      "Borderline-mullion smoke failed. A weak, short fragment between repeated openings must remain independent instead of attaching to either neighboring opening."
    );
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  console.log(
    "Borderline-mullion smoke passed: a short, weak fragment between repeated openings remains independent and cannot enlarge the wrong window mask."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
