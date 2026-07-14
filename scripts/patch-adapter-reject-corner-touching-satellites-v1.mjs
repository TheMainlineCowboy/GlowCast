import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const sideBlockPattern = /  const sideBySideTrim =\n(?:    .*\n){4}/;
const stackedBlockPattern = /  const stackedTrim =\n(?:    .*\n){4}/;

const desiredSide = `  const sideBySideTrim =
    gap.x <= Math.max(2.5, bounds.width * 0.045) &&
    gap.y <= Math.max(1.2, bounds.height * 0.02) &&
    verticalAlignment >= 0.62 &&
    satellite.height >= parent.height * 0.62 &&
    satellite.width <= parent.width * 0.58;\n`;

const desiredStacked = `  const stackedTrim =
    gap.y <= Math.max(2.5, bounds.height * 0.045) &&
    gap.x <= Math.max(1.2, bounds.width * 0.02) &&
    horizontalAlignment >= 0.62 &&
    satellite.width >= parent.width * 0.62 &&
    satellite.height <= parent.height * 0.58;\n`;

if (!source.includes(desiredSide)) {
  if (!sideBlockPattern.test(source)) {
    throw new Error("side-by-side satellite gate block not found");
  }
  source = source.replace(sideBlockPattern, desiredSide);
}

if (!source.includes(desiredStacked)) {
  if (!stackedBlockPattern.test(source)) {
    throw new Error("stacked satellite gate block not found");
  }
  source = source.replace(stackedBlockPattern, desiredStacked);
}

await fs.writeFile(path, source);
console.log("corner-touching satellite rejection ready");
