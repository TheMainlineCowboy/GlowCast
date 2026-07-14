import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const replacements = [
  ["verticalAlignment >= 0.52", "verticalAlignment >= 0.62"],
  [
    "satellite.height >= parent.height * 0.45;",
    "satellite.height >= parent.height * 0.62 &&\n    satellite.width <= parent.width * 0.58;",
  ],
  ["horizontalAlignment >= 0.52", "horizontalAlignment >= 0.62"],
  [
    "satellite.width >= parent.width * 0.45;",
    "satellite.width >= parent.width * 0.62 &&\n    satellite.height <= parent.height * 0.58;",
  ],
];

for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
  } else if (!source.includes(to)) {
    throw new Error(`corner-touching satellite gate anchor not found: ${from}`);
  }
}

await fs.writeFile(path, source);
console.log("corner-touching satellite rejection ready");
