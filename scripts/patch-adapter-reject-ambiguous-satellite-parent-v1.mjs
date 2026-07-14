import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const ambiguousSatelliteKeys = new Set<string>();";
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
  `${groupedAnchor}\n  const ambiguousSatelliteKeys = new Set<string>();\n  const satelliteGeometryKey = (candidate: MaskCandidateOutput) =>\n    [candidate.box.x, candidate.box.y, candidate.box.width, candidate.box.height]\n      .map((value) => value.toFixed(2))\n      .join(\":\");`
);

const bestAttachmentAnchor = `    let bestAttachment:
      | { parentIndex: number; satelliteIndex: number; score: number }
      | undefined;`;
if (!source.includes(bestAttachmentAnchor)) {
  throw new Error("Unable to locate best satellite attachment declaration");
}
source = source.replace(
  bestAttachmentAnchor,
  `${bestAttachmentAnchor}\n    const attachmentScoresBySatellite = new Map<\n      string,\n      Array<{ parentId: string; score: number }>\n    >();`
);

const satelliteAnchor = "        const satellite = grouped[j];";
if (!source.includes(satelliteAnchor)) {
  throw new Error("Unable to locate satellite candidate declaration");
}
source = source.replace(
  satelliteAnchor,
  `${satelliteAnchor}\n        const satelliteKey = satelliteGeometryKey(satellite);\n        if (ambiguousSatelliteKeys.has(satelliteKey)) continue;`
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
  `${scoreAnchor}\n        const satelliteScores = attachmentScoresBySatellite.get(satelliteKey) ?? [];\n        satelliteScores.push({ parentId: parent.id, score });\n        attachmentScoresBySatellite.set(satelliteKey, satelliteScores);`
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

    for (const [satelliteKey, scores] of attachmentScoresBySatellite) {
      const competingScores = [...scores].sort((a, b) => a.score - b.score);
      const ambiguityMargin = competingScores[1]?.score - competingScores[0]?.score;
      if (ambiguityMargin !== undefined && ambiguityMargin < 0.03) {
        ambiguousSatelliteKeys.add(satelliteKey);
      }
    }

    const selectedSatellite = grouped[bestAttachment.satelliteIndex];
    if (ambiguousSatelliteKeys.has(satelliteGeometryKey(selectedSatellite))) continue;

    const parent = grouped[bestAttachment.parentIndex];
    const satellite = selectedSatellite;`
);

await fs.writeFile(adapterPath, source);
console.log("ambiguous satellite parent rejection ready");
