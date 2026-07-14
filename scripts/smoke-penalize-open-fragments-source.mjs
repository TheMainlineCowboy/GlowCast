import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const required of [
  "function polygonAreaRatio(",
  "const outlineFill = polygonAreaRatio(candidate.points, candidate.box);",
  "const closurePenalty = outlineFill >= 0.72 ? 1 : outlineFill >= 0.48 ? 0.82 : 0.5;",
  "* trimPenalty * closurePenalty"
]) {
  if (!source.includes(required)) {
    throw new Error(`open-fragment ranking source missing: ${required}`);
  }
}

console.log("open-fragment outline ranking source verified");
