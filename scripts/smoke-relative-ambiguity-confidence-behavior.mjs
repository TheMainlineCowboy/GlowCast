import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
const edgeDetectPath = "src/edgeDetect.ts";
const adapterSource = await fs.readFile(adapterPath, "utf8");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glowcast-relative-ambiguity-confidence-"));
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
  const leftBox = { x: 22, y: 25, width: 20, height: 30 };
  const rightBox = { x: 58, y: 25, width: 20, height: 30 };

  // This fragment favors the right opening by more than the old fixed 0.03
  // threshold, but the two scores remain close relative to their overall cost.
  // The scale-aware ambiguity margin must therefore keep it independent.
  const relativelyAmbiguousTrimBox = { x: 46.7, y: 29, width: 7, height: 22 };
  const ambiguousGrouped = groupNearbySatellites(
    [
      candidate("left_window", leftBox),
      candidate("right_window", rightBox),
      candidate("relative_ambiguity_trim", relativelyAmbiguousTrimBox)
    ],
    bounds
  );

  const ambiguousById = new Map(ambiguousGrouped.map((mask) => [mask.id, mask]));
  if (
    ambiguousGrouped.length !== 3 ||
    !unchanged(ambiguousById.get("left_window"), leftBox) ||
    !unchanged(ambiguousById.get("right_window"), rightBox) ||
    !unchanged(ambiguousById.get("relative_ambiguity_trim"), relativelyAmbiguousTrimBox)
  ) {
    console.error(
      "Relative-ambiguity behavior smoke failed. A high-cost near-tie exceeded the old fixed margin and attached to a neighboring opening instead of remaining independent."
    );
    console.error(JSON.stringify(ambiguousGrouped, null, 2));
    process.exit(1);
  }

  // This fragment is close enough to the right opening to be a confident parent
  // match. The safer relative threshold must not become so conservative that it
  // leaves clearly associated architectural trim detached.
  const confidentTrimBox = { x: 51.5, y: 29, width: 5, height: 22 };
  const confidentGrouped = groupNearbySatellites(
    [
      candidate("left_window", leftBox),
      candidate("right_window", rightBox),
      candidate("confident_right_trim", confidentTrimBox)
    ],
    bounds
  );

  const confidentById = new Map(confidentGrouped.map((mask) => [mask.id, mask]));
  const mergedRight = confidentById.get("right_window");
  const rightExpandedTowardTrim =
    mergedRight &&
    mergedRight.box.x < rightBox.x &&
    mergedRight.box.x <= confidentTrimBox.x &&
    mergedRight.box.x + mergedRight.box.width === rightBox.x + rightBox.width;

  if (
    confidentGrouped.length !== 2 ||
    !unchanged(confidentById.get("left_window"), leftBox) ||
    confidentById.has("confident_right_trim") ||
    !rightExpandedTowardTrim
  ) {
    console.error(
      "Relative-ambiguity behavior smoke failed. A clearly better parent match stayed detached or attached to the wrong opening."
    );
    console.error(JSON.stringify(confidentGrouped, null, 2));
    process.exit(1);
  }

  // Move the same trim steadily from the ambiguous zone toward the right opening.
  // The decision may transition once from independent to right-attached, but it
  // must never attach to the wrong opening or flicker back to independent afterward.
  const transitionXs = [46.7, 47.5, 48.3, 49.1, 50.3, 51.5];
  let rightAttachmentSeen = false;

  for (const x of transitionXs) {
    const trimBox = { x, y: 29, width: x === 51.5 ? 5 : 7, height: 22 };
    const grouped = groupNearbySatellites(
      [
        candidate("left_window", leftBox),
        candidate("right_window", rightBox),
        candidate("transition_trim", trimBox)
      ],
      bounds
    );
    const byId = new Map(grouped.map((mask) => [mask.id, mask]));
    const currentRight = byId.get("right_window");
    const independent =
      grouped.length === 3 &&
      unchanged(byId.get("left_window"), leftBox) &&
      unchanged(currentRight, rightBox) &&
      unchanged(byId.get("transition_trim"), trimBox);
    const attachedRight =
      grouped.length === 2 &&
      unchanged(byId.get("left_window"), leftBox) &&
      !byId.has("transition_trim") &&
      currentRight &&
      currentRight.box.x <= trimBox.x &&
      currentRight.box.x + currentRight.box.width === rightBox.x + rightBox.width;

    if ((!independent && !attachedRight) || (rightAttachmentSeen && independent)) {
      console.error(
        "Relative-ambiguity transition smoke failed. Trim attached to the wrong parent or ownership flickered while confidence increased."
      );
      console.error(JSON.stringify({ x, grouped }, null, 2));
      process.exit(1);
    }

    rightAttachmentSeen ||= attachedRight;
  }

  if (!rightAttachmentSeen) {
    console.error(
      "Relative-ambiguity transition smoke failed. Increasing confidence never produced the expected right-parent attachment."
    );
    process.exit(1);
  }

  console.log(
    "Relative-ambiguity behavior smoke passed: near-ties remain independent, clearly better matches attach, and the confidence transition is stable."
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
