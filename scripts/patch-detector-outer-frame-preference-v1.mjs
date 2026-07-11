import fs from "node:fs/promises";

const detectorPath = "src/core/architecturalDetector.ts";
let source = await fs.readFile(detectorPath, "utf8");

const oldBlock = `  const selected: CandidateZone[] = [];
  for (const candidate of rankedProposals) {
    const overlapsSelected = selected.some((existing) => getOverlapRatio(candidate, existing) > 0.82);
    if (!overlapsSelected) {
      selected.push(candidate);
    }
  }
`;

const newBlock = `  const selected: CandidateZone[] = [];
  for (const candidate of rankedProposals) {
    const overlappingIndex = selected.findIndex(
      (existing) => getOverlapRatio(candidate, existing) > 0.82
    );

    if (overlappingIndex < 0) {
      selected.push(candidate);
      continue;
    }

    const existing = selected[overlappingIndex];
    const candidateArea = candidate.width * candidate.height;
    const existingArea = existing.width * existing.height;
    const candidateIsOuterFrame = candidateArea > existingArea * 1.12;
    const confidenceIsComparable = candidate.confidence >= existing.confidence - 8;

    if (candidateIsOuterFrame && confidenceIsComparable) {
      selected[overlappingIndex] = candidate;
    }
  }
`;

if (source.includes(newBlock)) {
  console.log("outer-frame preference patch already applied");
} else if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  await fs.writeFile(detectorPath, source);
  console.log("applied outer-frame preference patch");
} else {
  throw new Error("architectural detector selection block not found");
}
