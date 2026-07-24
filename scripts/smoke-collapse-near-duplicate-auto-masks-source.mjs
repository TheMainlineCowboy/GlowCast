import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const centerTolerance = Math.max(",
  "overlap >= 0.84 || (overlap >= 0.68",
  "sizeSimilar && areaRatio >= 0.62",
  "centerDistance <= centerTolerance"
];

const missing = required.filter((entry) => !source.includes(entry));
if (missing.length) {
  throw new Error(`Near-duplicate automatic-mask suppression smoke failed; missing: ${missing.join(", ")}`);
}

console.log("Near-duplicate automatic-mask suppression source smoke passed.");
