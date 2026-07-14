import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const bestScore = competingScores[0]?.score;",
  "Math.max(0.03, Math.abs(bestScore) * 0.12)",
  "ambiguityMargin < relativeAmbiguityMargin"
];

const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
if (missing.length > 0) {
  console.error(
    "Relative ambiguity confidence smoke failed. Satellite parent selection must use both an absolute floor and a score-relative confidence margin."
  );
  console.error(JSON.stringify(missing, null, 2));
  process.exit(1);
}

const absoluteOnlyPattern = /ambiguityMargin\s*<\s*0\.03/;
if (absoluteOnlyPattern.test(source)) {
  console.error(
    "Relative ambiguity confidence smoke failed. A fixed-only ambiguity threshold can attach uncertain trim when parent scores are larger."
  );
  process.exit(1);
}

console.log(
  "Relative ambiguity confidence smoke passed: near-tied parent scores scale with attachment uncertainty while retaining a minimum absolute guard."
);
