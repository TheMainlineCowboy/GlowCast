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
  console.log("applied nested-detail selection patch");
} else {
  throw new Error("outer-frame detector selection block not found");
}

const textureMarker = "const broadDirectionalTexture";
if (!source.includes(textureMarker)) {
  const structuralAnchor = `    const totalStructural = component.horizontalStrength + component.verticalStrength;
    if (totalStructural > 0) {
      const balanceRatio =
        Math.min(component.horizontalStrength, component.verticalStrength) /
        Math.max(component.horizontalStrength, component.verticalStrength);
      score += Math.floor(balanceRatio * 20);
    }
`;
  const structuralReplacement = `    const totalStructural = component.horizontalStrength + component.verticalStrength;
    const structuralBalance =
      totalStructural > 0
        ? Math.min(component.horizontalStrength, component.verticalStrength) /
          Math.max(component.horizontalStrength, component.verticalStrength)
        : 0;
    const componentAreaPercent = wPct * hPct;
    const broadDirectionalTexture = componentAreaPercent >= 1200 && structuralBalance < 0.08;

    // Large reflections and wall texture often connect strongly in only one direction.
    // Real architectural frames retain meaningful horizontal and vertical structure.
    if (broadDirectionalTexture) {
      diagnostics.rejectedConfidence += 1;
      return;
    }

    if (totalStructural > 0) {
      score += Math.floor(structuralBalance * 20);
    }
`;

  if (!source.includes(structuralAnchor)) {
    throw new Error("architectural structural-balance block not found");
  }
  source = source.replace(structuralAnchor, structuralReplacement);
  console.log("applied broad directional texture rejection");
}

for (const marker of [
  "const structuralBalance =",
  "const componentAreaPercent = wPct * hPct;",
  "const broadDirectionalTexture = componentAreaPercent >= 1200 && structuralBalance < 0.08;",
  "if (broadDirectionalTexture)"
]) {
  if (!source.includes(marker)) throw new Error(`broad texture source marker missing: ${marker}`);
}

await fs.writeFile(detectorPath, source);
