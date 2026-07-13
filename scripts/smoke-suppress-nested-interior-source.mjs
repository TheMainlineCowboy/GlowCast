import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function suppressNestedInteriorDetails(",
  "candidateArea > boundsArea * 0.14",
  "outerArea < candidateArea * 1.7",
  "const fullyNested =",
  "return suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);"
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`nested interior suppression token missing: ${token}`);
  }
}

console.log("nested interior suppression source smoke passed");
