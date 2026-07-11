import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const comparableArchitecturalOpening =",
  "satelliteArea >= parentArea * 0.55",
  "widthRatio >= 0.72 && widthRatio <= 1.38",
  "heightRatio >= 0.72 && heightRatio <= 1.38",
  "if (comparableArchitecturalOpening) return false;"
];

const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  throw new Error(`Repeated opening source smoke failed; missing: ${missing.join(", ")}`);
}
console.log("repeated opening source smoke passed");
