import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-ambiguity-boundary-"));
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

function classify(groupNearbySatellites, x) {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  const leftBox = { x: 22, y: 25, width: 20, height: 30 };
  const rightBox = { x: 58, y: 25, width: 20, height: 30 };
  const trimBox = { x, y: 29, width: 7, height: 22 };
  const grouped = groupNearbySatellites(
    [candidate("left_window", leftBox), candidate("right_window", rightBox), candidate("boundary_trim", trimBox)],
    bounds
  );
  const byId = new Map(grouped.map((mask) => [mask.id, mask]));
  const right = byId.get("right_window");
  const independent = grouped.length === 3 && byId.has("boundary_trim");
  const attachedRight =
    grouped.length === 2 &&
    !byId.has("boundary_trim") &&
    right &&
    right.box.x <= trimBox.x &&
    right.box.x + right.box.width === rightBox.x + rightBox.width;
  return { independent, attachedRight, grouped };
}

try {
  const { groupNearbySatellites } = await import(pathToFileURL(emittedAdapterPath).href);
  const samples = [];
  for (let x = 46.7; x <= 51.5; x += 0.05) {
    const roundedX = Number(x.toFixed(2));
    samples.push({ x: roundedX, ...classify(groupNearbySatellites, roundedX) });
  }

  const firstAttachedIndex = samples.findIndex((sample) => sample.attachedRight);
  if (firstAttachedIndex <= 0) {
    console.error("Ambiguity-boundary smoke failed. No measurable independent-to-attached transition was found.");
    console.error(JSON.stringify(samples, null, 2));
    process.exit(1);
  }

  const belowBoundary = samples[firstAttachedIndex - 1];
  const aboveBoundary = samples[firstAttachedIndex];
  if (!belowBoundary.independent || !aboveBoundary.attachedRight) {
    console.error("Ambiguity-boundary smoke failed. The sample immediately below the boundary was not independent or the sample above it did not attach right.");
    console.error(JSON.stringify({ belowBoundary, aboveBoundary }, null, 2));
    process.exit(1);
  }

  const wrongOrUnstable = samples.some((sample, index) => {
    const valid = sample.independent || sample.attachedRight;
    const reverted = index > firstAttachedIndex && sample.independent;
    return !valid || reverted;
  });
  if (wrongOrUnstable) {
    console.error("Ambiguity-boundary smoke failed. A sample attached to the wrong parent or reverted after crossing the confidence boundary.");
    console.error(JSON.stringify(samples, null, 2));
    process.exit(1);
  }

  console.log(
    `Ambiguity-boundary smoke passed: x=${belowBoundary.x.toFixed(2)} remains independent and x=${aboveBoundary.x.toFixed(2)} attaches to the clearly preferred right parent.`
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
