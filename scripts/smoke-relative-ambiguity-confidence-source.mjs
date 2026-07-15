import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const bestScore = competingScores[0]?.score;",
  "Math.max(0.03, Math.abs(bestScore) * 0.14)",
  "ambiguityMargin < relativeAmbiguityMargin"
];

const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
if (missing.length > 0) {
  console.error(
    "Relative ambiguity confidence smoke failed. Satellite parent selection must use the widened score-relative deadband plus its absolute floor."
  );
  console.error(JSON.stringify(missing, null, 2));
  process.exit(1);
}

const staleRelativeMarginPattern = /Math\.abs\(bestScore\)\s*\*\s*0\.12/;
if (staleRelativeMarginPattern.test(source)) {
  console.error(
    "Relative ambiguity confidence smoke failed. The older 12% deadband is too narrow around jitter-prone parent scores."
  );
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
  "Relative ambiguity confidence smoke passed: near-tied parent scores use a widened 14% deadband while retaining the minimum absolute guard."
);