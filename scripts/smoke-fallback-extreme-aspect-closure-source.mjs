import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "const extremeAspect = aspect < 0.35 || aspect > 3.2;",
  "if (extremeAspect && sideCoverage.sides < 4) continue;"
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing extreme-aspect closure safeguard: ${fragment}`);
  }
}

console.log("Extreme-aspect fallback masks require four-sided closure.");
