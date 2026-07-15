import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-stable-mullion-order-"));
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
  "node_modules/typescript/bin/tsc",
  sourcePath,
  "--ignoreConfig",
  "--rootDir", sourceRoot,
  "--outDir", outDir,
  "--module", "ES2020",
  "--target", "ES2020",
  "--moduleResolution", "Bundler",
  "--skipLibCheck"
], { stdio: "inherit" });

const emittedAdapterPath = path.join(outDir, "core", "maskCandidateAdapter.js");
const emittedDetectorPath = path.join(outDir, "core", "architecturalDetector.js");
await fs.writeFile(emittedAdapterPath, (await fs.readFile(emittedAdapterPath, "utf8")).replace(/from\s+["']\.\/architecturalDetector["']/g, 'from "./architecturalDetector.js"'));
await fs.writeFile(emittedDetectorPath, (await fs.readFile(emittedDetectorPath, "utf8")).replace(/from\s+["']\.\.\/edgeDetect["']/g, 'from "../edgeDetect.js"'));

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

function boxSignature(mask) {
  return [mask.box.x, mask.box.y, mask.box.width, mask.box.height].map((value) => value.toFixed(3)).join(":");
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const items = [
    candidate("left_window", { x: 22, y: 25, width: 20, height: 30 }),
    candidate("right_window", { x: 58, y: 25, width: 20, height: 30 }),
    candidate("confident_left_mullion", { x: 43.4, y: 27, width: 1.4, height: 26 }),
    candidate("ambiguous_shared_mullion", { x: 46.1, y: 28, width: 3.6, height: 24 })
  ];
  const permutations = [
    items,
    [items[3], items[1], items[2], items[0]],
    [items[2], items[0], items[3], items[1]],
    [...items].reverse()
  ];

  const snapshots = permutations.map((input) => {
    const grouped = groupNearbySatellites(input, bounds);
    const byId = new Map(grouped.map((mask) => [mask.id, mask]));
    if (grouped.length !== 3 || byId.has("confident_left_mullion") || !byId.has("ambiguous_shared_mullion")) {
      console.error("Stable input-order smoke failed: parent ownership changed when detector candidates were reordered.");
      console.error(JSON.stringify(grouped, null, 2));
      process.exit(1);
    }
    return [...grouped].map((mask) => `${mask.id}:${boxSignature(mask)}`).sort().join("|");
  });

  if (new Set(snapshots).size !== 1) {
    console.error("Stable input-order smoke failed: identical geometry produced different architectural masks after candidate reordering.");
    console.error(JSON.stringify(snapshots, null, 2));
    process.exit(1);
  }

  console.log("Stable input-order smoke passed: confident trim retains its parent and ambiguous trim remains independent regardless of detector candidate order.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
