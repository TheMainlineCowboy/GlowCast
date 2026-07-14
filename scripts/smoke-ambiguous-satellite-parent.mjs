import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-ambiguous-satellite-parent-"));
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
  const leftBox = { x: 22, y: 25, width: 20, height: 30 };
  const rightBox = { x: 58, y: 25, width: 20, height: 30 };
  const ambiguousTrimBox = { x: 46.5, y: 29, width: 7, height: 22 };

  const grouped = groupNearbySatellites(
    [
      candidate("left_window", leftBox),
      candidate("right_window", rightBox),
      candidate("ambiguous_trim", ambiguousTrimBox)
    ],
    bounds
  );

  const byId = new Map(grouped.map((mask) => [mask.id, mask]));
  const unchanged = (actual, expected) =>
    actual &&
    actual.box.x === expected.x &&
    actual.box.y === expected.y &&
    actual.box.width === expected.width &&
    actual.box.height === expected.height;

  if (
    grouped.length !== 3 ||
    !unchanged(byId.get("left_window"), leftBox) ||
    !unchanged(byId.get("right_window"), rightBox) ||
    !unchanged(byId.get("ambiguous_trim"), ambiguousTrimBox)
  ) {
    console.error(
      "Ambiguous-satellite-parent smoke failed. A narrow fragment with nearly equal parent scores must remain separate instead of attaching arbitrarily to either neighboring opening."
    );
    console.error(JSON.stringify(grouped, null, 2));
    process.exit(1);
  }

  const leftInnerTrimBox = { x: 43.5, y: 27, width: 1.5, height: 26 };
  const groupedAfterNearbyMerge = groupNearbySatellites(
    [
      candidate("left_window", leftBox),
      candidate("right_window", rightBox),
      candidate("left_inner_trim", leftInnerTrimBox),
      candidate("ambiguous_trim", ambiguousTrimBox)
    ],
    bounds
  );
  const afterMergeById = new Map(groupedAfterNearbyMerge.map((mask) => [mask.id, mask]));
  const mergedLeft = afterMergeById.get("left_window");
  const preservedAmbiguous = afterMergeById.get("ambiguous_trim");

  if (
    groupedAfterNearbyMerge.length !== 3 ||
    !mergedLeft ||
    mergedLeft.box.x !== leftBox.x ||
    mergedLeft.box.x + mergedLeft.box.width < leftInnerTrimBox.x + leftInnerTrimBox.width ||
    !unchanged(afterMergeById.get("right_window"), rightBox) ||
    !unchanged(preservedAmbiguous, ambiguousTrimBox)
  ) {
    console.error(
      "Ambiguous-satellite-parent smoke failed. An initially ambiguous fragment was reconsidered after a different nearby trim merged and changed the parent geometry."
    );
    console.error(JSON.stringify(groupedAfterNearbyMerge, null, 2));
    process.exit(1);
  }

  const groupedWithRegeneratedId = groupNearbySatellites(
    [
      candidate("left_window", leftBox),
      candidate("right_window", rightBox),
      candidate("ambiguous_trim_original", ambiguousTrimBox),
      candidate("ambiguous_trim_regenerated", { ...ambiguousTrimBox })
    ],
    bounds
  );
  const regeneratedById = new Map(groupedWithRegeneratedId.map((mask) => [mask.id, mask]));

  if (
    groupedWithRegeneratedId.length !== 4 ||
    !unchanged(regeneratedById.get("left_window"), leftBox) ||
    !unchanged(regeneratedById.get("right_window"), rightBox) ||
    !unchanged(regeneratedById.get("ambiguous_trim_original"), ambiguousTrimBox) ||
    !unchanged(regeneratedById.get("ambiguous_trim_regenerated"), ambiguousTrimBox)
  ) {
    console.error(
      "Ambiguous-satellite-parent smoke failed. A geometrically identical fragment regenerated under a different ID escaped the frozen ambiguity decision."
    );
    console.error(JSON.stringify(groupedWithRegeneratedId, null, 2));
    process.exit(1);
  }

  console.log(
    "Ambiguous-satellite-parent smoke passed: equally eligible trim stays separate through nearby merges and regenerated candidate IDs."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
