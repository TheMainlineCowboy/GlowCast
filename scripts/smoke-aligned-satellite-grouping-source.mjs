import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const verticalCenterOffsetRatio =",
  "const horizontalCenterOffsetRatio =",
  "verticalCenterOffsetRatio <= 0.28",
  "horizontalCenterOffsetRatio <= 0.28"
];

const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
if (missing.length > 0) {
  throw new Error(`Aligned satellite grouping source smoke failed: missing ${missing.join(", ")}`);
}

console.log("aligned satellite grouping source smoke passed");
