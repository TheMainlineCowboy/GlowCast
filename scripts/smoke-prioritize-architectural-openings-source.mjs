import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function prioritizeArchitecturalOpenings(",
  "const looksLikeThinTrim = balance < 0.14 && areaRatio < 0.08;",
  "const trimPenalty = looksLikeThinTrim ? 0.45 : 1;",
  "const architecturalScore = areaRatio * (0.78 + balance * 0.22) * trimPenalty;",
  ".sort((a, b) => b.architecturalScore - a.architecturalScore || a.index - b.index)",
  "prioritizeArchitecturalOpenings(suppressNestedInteriorDetails(grouped, bounds), bounds).slice(0, 10)"
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`architectural opening priority token missing: ${token}`);
  }
}

console.log("architectural opening priority and thin-trim penalty source smoke passed");
