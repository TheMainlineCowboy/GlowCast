import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function prioritizeArchitecturalOpenings(",
  "const architecturalScore = areaRatio * (0.78 + balance * 0.22);",
  ".sort((a, b) => b.architecturalScore - a.architecturalScore || a.index - b.index)",
  "prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10)"
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`architectural opening priority token missing: ${token}`);
  }
}

console.log("architectural opening priority source smoke passed");
