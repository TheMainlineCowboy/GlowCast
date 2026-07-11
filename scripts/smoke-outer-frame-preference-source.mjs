import fs from "node:fs/promises";

const source = await fs.readFile("src/core/architecturalDetector.ts", "utf8");

const requiredFragments = [
  "const candidateIsOuterFrame = candidateArea > existingArea * 1.12;",
  "const confidenceIsComparable = candidate.confidence >= existing.confidence - 8;",
  "selected[overlappingIndex] = candidate;"
];

const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
if (missing.length > 0) {
  throw new Error(`Outer-frame preference source smoke failed: missing ${missing.join(", ")}`);
}

console.log("outer-frame preference source smoke passed");
