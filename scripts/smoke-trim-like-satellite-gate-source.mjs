import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const sideBySideTrimProportion = satellite.width <= parent.width * 0.58;",
  "const stackedTrimProportion = satellite.height <= parent.height * 0.58;",
  "const trimLikeSatellite =",
  "if (!trimLikeSatellite) return false;"
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  throw new Error(`Trim-like satellite source smoke failed; missing: ${missing.join(", ")}`);
}
console.log("trim-like satellite source smoke passed");
