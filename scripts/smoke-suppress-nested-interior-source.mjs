import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function suppressNestedInteriorDetails(",
  "candidateArea > boundsArea * 0.14",
  "outerArea < candidateArea * 1.7",
  "const fullyNested ="
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`nested interior suppression token missing: ${token}`);
  }
}

const outputWiringPresent =
  source.includes("const finalMasks = suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);") ||
  source.includes("return suppressNestedInteriorDetails(grouped, bounds).slice(0, 10);");

if (!outputWiringPresent) {
  throw new Error("nested interior suppression output wiring missing");
}

console.log("nested interior suppression source smoke passed");
