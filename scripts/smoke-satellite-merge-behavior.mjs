import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const detectorPath = "src/core/architecturalDetector.ts";
let adapterSource = await fs.readFile(adapterPath, "utf8");
const detectorSource = await fs.readFile(detectorPath, "utf8");

adapterSource = adapterSource
  .replace(/import type \{ EdgePoint \} from "\.\.\/edgeDetect";\n/, "")
  .replace(/import \{ detectArchitecturalCandidates \} from "\.\/architecturalDetector";\n/, "")
  .replace("function groupNearbySatellites", "export function groupNearbySatellites");

const composedSource = `${detectorSource}\n${adapterSource}\n`;
const transpiled = ts.transpileModule(composedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const tempPath = path.join(os.tmpdir(), `glowcast-satellite-behavior-${Date.now()}.mjs`);
await fs.writeFile(tempPath, transpiled);

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

  console.log("Satellite behavior smoke passed: useful trim merges, thin inflated fragments are rejected.");
} finally {
  await fs.rm(tempPath, { force: true });
}
