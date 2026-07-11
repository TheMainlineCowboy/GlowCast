import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "combined.width <= parent.width * 1.68",
  "combined.height <= parent.height * 1.68",
  "boundedCrossAxisGrowth &&"
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length > 0) {
  throw new Error(`Bounded satellite growth source smoke failed; missing: ${missing.join(", ")}`);
}

console.log("bounded satellite growth source smoke passed");
