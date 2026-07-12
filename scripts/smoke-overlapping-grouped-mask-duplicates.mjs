import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-grouped-duplicate-smoke-"));
const sourceRoot = path.join(tempDir, "src");
const coreDir = path.join(sourceRoot, "core");
const outDir = path.join(tempDir, "out");
const sourcePath = path.join(coreDir, "maskCandidateAdapter.ts");

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
  const { groupNearbySatellites } = await import(pathToFileURL(emittedAdapterPath).href);
  const grouped = groupNearbySatellites(
    [
      candidate("outer_window", { x: 12, y: 20, width: 20, height: 30 }),
      candidate("duplicate_inner_frame", { x: 12.5, y: 20.5, width: 19, height: 29 }),
      candidate("separate_window", { x: 48, y: 20, width: 20, height: 30 })
    ],
    { x: 0, y: 0, width: 100, height: 100 }
  );

  if (grouped.length !== 2) {
    console.error("Grouped duplicate smoke failed. Nested near-identical masks were not suppressed.");
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  if (!grouped.some((item) => item.id === "outer_window") || !grouped.some((item) => item.id === "separate_window")) {
    console.error("Grouped duplicate smoke failed. The strongest outer frame or separate opening was lost.");
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  console.log("Grouped duplicate smoke passed: near-identical nested masks collapse while separate openings remain.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
