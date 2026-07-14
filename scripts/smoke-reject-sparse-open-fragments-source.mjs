import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

for (const required of [
  "function suppressWeakOpenFragments(",
  "const outlineFill = polygonAreaRatio(candidate.points, candidate.box);",
  "return outlineFill >= 0.28 || areaRatio >= 0.12;",
  "suppressWeakOpenFragments(suppressNestedInteriorDetails(grouped, bounds), bounds)"
]) {
  if (!source.includes(required)) {
    throw new Error(`sparse open-fragment rejection source missing: ${required}`);
  }
}

console.log("sparse open-fragment rejection source verified");
