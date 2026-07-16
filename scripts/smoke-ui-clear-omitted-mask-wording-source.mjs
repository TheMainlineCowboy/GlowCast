import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "const omittedMaskCount = getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned",
  "const omittedMaskLabel = omittedMaskCount === 1 ? \"mask\" : \"masks\"",
  "const resultLabel = omittedMaskCount === 1 ? \"result\" : \"results\"",
  "{omittedMaskCount} additional {omittedMaskLabel} need manual review — check image for missed openings",
  "lower-ranked ${resultLabel}",
  'role="status"',
  'aria-live="polite"'
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Actionable omitted-mask wording marker missing: ${marker}`);
  }
}

if (source.includes("additional mask(s) need manual review") || source.includes("lower-ranked result(s)")) {
  throw new Error("Placeholder plural wording returned to the omitted-mask warning");
}

if (source.includes("additional {omittedMaskLabel} need manual review</strong>")) {
  throw new Error("Non-actionable omitted-mask warning returned");
}

console.log("Actionable omitted automatic-mask wording source regression passed.");
