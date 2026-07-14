import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldSide = `    satellite.height >= parent.height * 0.62 &&
    satellite.width <= parent.width * 0.58;`;
const newSide = `    satellite.height >= parent.height * 0.62 &&
    satellite.width <= parent.width * 0.58 &&
    satellite.width * satellite.height >= parent.width * parent.height * 0.06;`;

const oldStacked = `    satellite.width >= parent.width * 0.62 &&
    satellite.height <= parent.height * 0.58;`;
const newStacked = `    satellite.width >= parent.width * 0.62 &&
    satellite.height <= parent.height * 0.58 &&
    satellite.width * satellite.height >= parent.width * parent.height * 0.06;`;

if (source.includes(oldSide)) {
  source = source.replace(oldSide, newSide);
} else if (!source.includes("satellite.width * satellite.height >= parent.width * parent.height * 0.06;")) {
  throw new Error("side satellite area gate anchor not found");
}

if (source.includes(oldStacked)) {
  source = source.replace(oldStacked, newStacked);
} else if ((source.match(/satellite\.width \* satellite\.height >= parent\.width \* parent\.height \* 0\.06;/g) ?? []).length < 2) {
  throw new Error("stacked satellite area gate anchor not found");
}

await fs.writeFile(path, source);
console.log("negligible satellite rejection ready");
