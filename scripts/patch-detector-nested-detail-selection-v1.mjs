import fs from "node:fs/promises";

const detectorPath = "src/core/architecturalDetector.ts";
let source = await fs.readFile(detectorPath, "utf8");

const oldBlock = `  const selected: CandidateZone[] = [];
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

const newBlock = `  const selected: CandidateZone[] = [];
  for (const candidate of rankedProposals) {
    const overlappingIndex = selected.findIndex((existing) => {
      const overlapRatio = getOverlapRatio(candidate, existing);
      if (overlapRatio <= 0.82) return false;

      const tolerance = 1.2;
      const candidateInsideExisting =
        candidate.x >= existing.x - tolerance &&
        candidate.y >= existing.y - tolerance &&
        candidate.x + candidate.width <= existing.x + existing.width + tolerance &&
        candidate.y + candidate.height <= existing.y + existing.height + tolerance;
      const existingInsideCandidate =
        existing.x >= candidate.x - tolerance &&
        existing.y >= candidate.y - tolerance &&
        existing.x + existing.width <= candidate.x + candidate.width + tolerance &&
        existing.y + existing.height <= candidate.y + candidate.height + tolerance;
      const nearDuplicateBounds =
        Math.abs(candidate.x - existing.x) <= tolerance &&
        Math.abs(candidate.y - existing.y) <= tolerance &&
        Math.abs(candidate.width - existing.width) <= tolerance * 2 &&
        Math.abs(candidate.height - existing.height) <= tolerance * 2;

      return candidateInsideExisting || existingInsideCandidate || nearDuplicateBounds;
    });

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
  console.log("nested-detail selection patch already applied");
} else if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  await fs.writeFile(detectorPath, source);
  console.log("applied nested-detail selection patch");
} else {
  throw new Error("outer-frame detector selection block not found");
}
