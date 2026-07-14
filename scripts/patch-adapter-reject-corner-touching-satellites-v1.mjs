import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldSideBySide = `  const sideBySideTrim =
    gap.x <= Math.max(2.5, bounds.width * 0.045) &&
    gap.y <= Math.max(1.2, bounds.height * 0.02) &&
    verticalAlignment >= 0.52 &&
    satellite.height >= parent.height * 0.45;`;
const newSideBySide = `  const sideBySideTrim =
    gap.x <= Math.max(2.5, bounds.width * 0.045) &&
    gap.y <= Math.max(1.2, bounds.height * 0.02) &&
    verticalAlignment >= 0.62 &&
    satellite.height >= parent.height * 0.62 &&
    satellite.width <= parent.width * 0.58;`;

const oldStacked = `  const stackedTrim =
    gap.y <= Math.max(2.5, bounds.height * 0.045) &&
    gap.x <= Math.max(1.2, bounds.width * 0.02) &&
    horizontalAlignment >= 0.52 &&
    satellite.width >= parent.width * 0.45;`;
const newStacked = `  const stackedTrim =
    gap.y <= Math.max(2.5, bounds.height * 0.045) &&
    gap.x <= Math.max(1.2, bounds.width * 0.02) &&
    horizontalAlignment >= 0.62 &&
    satellite.width >= parent.width * 0.62 &&
    satellite.height <= parent.height * 0.58;`;

if (source.includes(oldSideBySide)) {
  source = source.replace(oldSideBySide, newSideBySide);
} else if (!source.includes("satellite.width <= parent.width * 0.58;")) {
  throw new Error("side-by-side satellite gate anchor not found");
}

if (source.includes(oldStacked)) {
  source = source.replace(oldStacked, newStacked);
} else if (!source.includes("satellite.height <= parent.height * 0.58;")) {
  throw new Error("stacked satellite gate anchor not found");
}

await fs.writeFile(path, source);
console.log("corner-touching satellite rejection ready");
