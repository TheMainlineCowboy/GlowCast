import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "satellite.height <= parent.height * 1.55";
if (source.includes(marker)) {
  console.log("bounded satellite span patch already applied");
  process.exit(0);
}

const sideBySideAnchor = `    verticalCenterOffsetRatio <= 0.28 &&
    satellite.height >= parent.height * 0.45;`;
const sideBySideReplacement = `    verticalCenterOffsetRatio <= 0.28 &&
    satellite.height >= parent.height * 0.45 &&
    satellite.height <= parent.height * 1.55;`;

const stackedAnchor = `    horizontalCenterOffsetRatio <= 0.28 &&
    satellite.width >= parent.width * 0.45;`;
const stackedReplacement = `    horizontalCenterOffsetRatio <= 0.28 &&
    satellite.width >= parent.width * 0.45 &&
    satellite.width <= parent.width * 1.55;`;

for (const [anchor, replacement, label] of [
  [sideBySideAnchor, sideBySideReplacement, "side-by-side span gate"],
  [stackedAnchor, stackedReplacement, "stacked span gate"]
]) {
  if (!source.includes(anchor)) {
    throw new Error(`Unable to locate satellite ${label} anchor`);
  }
  source = source.replace(anchor, replacement);
}

await fs.writeFile(adapterPath, source);
console.log("applied bounded satellite span patch");
