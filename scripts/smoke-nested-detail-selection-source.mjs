import fs from "node:fs/promises";

const source = await fs.readFile("src/core/architecturalDetector.ts", "utf8");

const requiredFragments = [
  "const candidateInsideExisting =",
  "const existingInsideCandidate =",
  "const nearDuplicateBounds =",
  "return candidateInsideExisting || existingInsideCandidate || nearDuplicateBounds;"
];

const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
if (missing.length > 0) {
  throw new Error(`Nested-detail selection source smoke failed: missing ${missing.join(", ")}`);
}

console.log("nested-detail selection source smoke passed");
