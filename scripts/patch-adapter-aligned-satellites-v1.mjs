import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const verticalCenterOffsetRatio =";
if (source.includes(marker)) {
  console.log("aligned satellite grouping patch already applied");
  process.exit(0);
}

const alignmentAnchor = `  const verticalAlignment = verticalOverlap / Math.max(Math.min(parent.height, satellite.height), 1);
  const horizontalAlignment = horizontalOverlap / Math.max(Math.min(parent.width, satellite.width), 1);
`;

const alignmentReplacement = `  const verticalAlignment = verticalOverlap / Math.max(Math.min(parent.height, satellite.height), 1);
  const horizontalAlignment = horizontalOverlap / Math.max(Math.min(parent.width, satellite.width), 1);
  const parentCenterX = parent.x + parent.width / 2;
  const parentCenterY = parent.y + parent.height / 2;
  const satelliteCenterX = satellite.x + satellite.width / 2;
  const satelliteCenterY = satellite.y + satellite.height / 2;
  const verticalCenterOffsetRatio =
    Math.abs(parentCenterY - satelliteCenterY) / Math.max(parent.height, satellite.height, 1);
  const horizontalCenterOffsetRatio =
    Math.abs(parentCenterX - satelliteCenterX) / Math.max(parent.width, satellite.width, 1);
`;

const sideBySideAnchor = `    verticalAlignment >= 0.52 &&
    satellite.height >= parent.height * 0.45;`;
const sideBySideReplacement = `    verticalAlignment >= 0.52 &&
    verticalCenterOffsetRatio <= 0.28 &&
    satellite.height >= parent.height * 0.45;`;

const stackedAnchor = `    horizontalAlignment >= 0.52 &&
    satellite.width >= parent.width * 0.45;`;
const stackedReplacement = `    horizontalAlignment >= 0.52 &&
    horizontalCenterOffsetRatio <= 0.28 &&
    satellite.width >= parent.width * 0.45;`;

for (const [anchor, replacement, label] of [
  [alignmentAnchor, alignmentReplacement, "alignment metrics"],
  [sideBySideAnchor, sideBySideReplacement, "side-by-side gate"],
  [stackedAnchor, stackedReplacement, "stacked gate"]
]) {
  if (!source.includes(anchor)) {
    throw new Error(`Unable to locate satellite ${label} anchor`);
  }
  source = source.replace(anchor, replacement);
}

await fs.writeFile(adapterPath, source);
console.log("applied aligned satellite grouping patch");
