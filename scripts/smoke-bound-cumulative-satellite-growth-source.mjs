import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const expected of [
  "const originalParentAreas = new Map",
  "const cumulativeGrowthRatio =",
  "if (cumulativeGrowthRatio > 1.72) continue;"
]) {
  if (!source.includes(expected)) {
    throw new Error(`Missing cumulative satellite growth safeguard: ${expected}`);
  }
}

console.log("cumulative satellite growth source verified");
