import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-stronger-mullion-order-"));
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

function normalize(result) {
  return result
    .map((mask) => ({
      id: mask.id,
      box: Object.fromEntries(Object.entries(mask.box).map(([key, value]) => [key, Number(value.toFixed(4))]))
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(emittedAdapterPath).href);
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const left = candidate("left", { x: 18, y: 24, width: 22, height: 32 });
  const right = candidate("right", { x: 60, y: 24, width: 22, height: 32 });
  const trim = candidate("trim", { x: 57.8, y: 28, width: 3.2, height: 24 });

  const forward = normalize(groupNearbySatellites([left, right, trim], bounds));
  const reversed = normalize(groupNearbySatellites([trim, right, left], bounds));

  if (JSON.stringify(forward) !== JSON.stringify(reversed)) {
    console.error("Stronger-evidence input-order smoke failed: reversing candidates changed the selected parent or merged geometry.");
    console.error(JSON.stringify({ forward, reversed }, null, 2));
    process.exit(1);
  }

  if (forward.length !== 2 || forward.some((mask) => mask.id === "trim") || !forward.some((mask) => mask.id === "right")) {
    console.error("Stronger-evidence input-order smoke failed: clearly stronger trim evidence must consistently attach to the right opening.");
    console.error(JSON.stringify(forward, null, 2));
    process.exit(1);
  }

  console.log("Stronger-evidence input-order smoke passed: clearly stronger trim attaches to the same opening regardless of candidate order.");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
