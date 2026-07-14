import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const ambiguousSatelliteBoxes: SimpleBox[] = [];";
if (source.includes(marker)) {
  console.log("ambiguous satellite parent patch already applied");
  process.exit(0);
}

const groupedAnchor = "  const blockedSatelliteAttachments = new Set<string>();";
if (!source.includes(groupedAnchor)) {
  throw new Error("Unable to locate blocked satellite attachment state");
}
source = source.replace(
  groupedAnchor,
  `${groupedAnchor}
  const ambiguousSatelliteBoxes: SimpleBox[] = [];
  const isSameSatelliteGeometry = (a: SimpleBox, b: SimpleBox) => {
    const shortestSide = Math.max(1, Math.min(a.width, a.height, b.width, b.height));
    const centerTolerance = Math.max(0.18, shortestSide * 0.025);
    const sizeTolerance = Math.max(0.24, shortestSide * 0.04);
    const centerAX = a.x + a.width / 2;
    const centerAY = a.y + a.height / 2;
    const centerBX = b.x + b.width / 2;
    const centerBY = b.y + b.height / 2;
    const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlapArea = overlapWidth * overlapHeight;
    const smallerArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    const overlapRatio = overlapArea / smallerArea;

    return (
      Math.abs(centerAX - centerBX) <= centerTolerance &&
      Math.abs(centerAY - centerBY) <= centerTolerance &&
      Math.abs(a.width - b.width) <= sizeTolerance &&
      Math.abs(a.height - b.height) <= sizeTolerance &&
      overlapRatio >= 0.88
    );
  };
  const isAmbiguousSatellite = (candidate: MaskCandidateOutput) =>
    ambiguousSatelliteBoxes.some((box) => isSameSatelliteGeometry(box, candidate.box));`
);

const bestAttachmentAnchor = `    let bestAttachment:
      | { parentIndex: number; satelliteIndex: number; score: number }
      | undefined;`;
if (!source.includes(bestAttachmentAnchor)) {
  throw new Error("Unable to locate best satellite attachment declaration");
}
source = source.replace(
  bestAttachmentAnchor,
  `${bestAttachmentAnchor}
    const attachmentScoresBySatellite = new Map<
      string,
      { box: SimpleBox; scores: Array<{ parentId: string; score: number }> }
    >();`
);

const satelliteAnchor = "        const satellite = grouped[j];";
if (!source.includes(satelliteAnchor)) {
  throw new Error("Unable to locate satellite candidate declaration");
}
source = source.replace(
  satelliteAnchor,
  `${satelliteAnchor}
        if (isAmbiguousSatellite(satellite)) continue;`
);

const scoreAnchor = `        const score =
          normalizedGap * 4 +
          normalizedCenterOffset +
          crossAxisSpanMismatch * 2.5 +
          crossAxisOverlapDeficit * 8 -
          parentProminencePenalty;`;
if (!source.includes(scoreAnchor)) {
  throw new Error("Unable to locate satellite parent score");
}
source = source.replace(
  scoreAnchor,
  `${scoreAnchor}
        const satelliteScores = attachmentScoresBySatellite.get(satellite.id) ?? {
          box: { ...satellite.box },
          scores: []
        };
        satelliteScores.scores.push({ parentId: parent.id, score });
        attachmentScoresBySatellite.set(satellite.id, satelliteScores);`
);

const selectionAnchor = `    if (!bestAttachment) break;

    const parent = grouped[bestAttachment.parentIndex];
    const satellite = grouped[bestAttachment.satelliteIndex];`;
if (!source.includes(selectionAnchor)) {
  throw new Error("Unable to locate selected satellite attachment");
}
source = source.replace(
  selectionAnchor,
  `    if (!bestAttachment) break;

    for (const { box, scores } of attachmentScoresBySatellite.values()) {
      const competingScores = [...scores].sort((a, b) => a.score - b.score);
      const ambiguityMargin = competingScores[1]?.score - competingScores[0]?.score;
      if (
        ambiguityMargin !== undefined &&
        ambiguityMargin < 0.03 &&
        !ambiguousSatelliteBoxes.some((ambiguousBox) => isSameSatelliteGeometry(ambiguousBox, box))
      ) {
        ambiguousSatelliteBoxes.push({ ...box });
      }
    }

    const selectedSatellite = grouped[bestAttachment.satelliteIndex];
    if (isAmbiguousSatellite(selectedSatellite)) continue;

    const parent = grouped[bestAttachment.parentIndex];
    const satellite = selectedSatellite;`
);

await fs.writeFile(adapterPath, source);
console.log("ambiguous satellite parent rejection ready");
