import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const centerTolerance = Math.max(",
  "const geometryAligned = sizeSimilar && areaRatio >= 0.62 && centerDistance <= centerTolerance;",
  "return geometryAligned && overlap >= 0.68;"
];

const missing = required.filter((entry) => !source.includes(entry));
if (missing.length) {
  throw new Error(`Near-duplicate automatic-mask suppression smoke failed; missing: ${missing.join(", ")}`);
}

console.log("Near-duplicate automatic-mask suppression source smoke passed.");
