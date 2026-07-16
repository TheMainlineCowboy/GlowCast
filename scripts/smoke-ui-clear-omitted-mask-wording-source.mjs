import fs from "node:fs/promises";

const source = await fs.readFile("src/App.tsx", "utf8");

const requiredMarkers = [
  "const omittedMaskCount = getLastMaskCandidateStats().total - getLastMaskCandidateStats().returned",
  "const omittedMaskLabel = omittedMaskCount === 1 ? \"mask\" : \"masks\"",
  "const resultLabel = omittedMaskCount === 1 ? \"result\" : \"results\"",
  "{omittedMaskCount} additional {omittedMaskLabel} need manual review",
  "lower-ranked ${resultLabel}"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Clear omitted-mask wording marker missing: ${marker}`);
  }
}

if (source.includes("additional mask(s) need manual review") || source.includes("lower-ranked result(s)")) {
  throw new Error("Placeholder plural wording returned to the omitted-mask warning");
}

console.log("Clear omitted automatic-mask wording source regression passed.");
