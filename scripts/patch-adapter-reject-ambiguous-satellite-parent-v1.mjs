import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const ambiguousSatelliteIds = new Set<string>();";
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
  `${groupedAnchor}\n  const ambiguousSatelliteIds = new Set<string>();`
);

const bestAttachmentAnchor = `    let bestAttachment:\n      | { parentIndex: number; satelliteIndex: number; score: number }\n      | undefined;`;
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
  `${satelliteAnchor}\n        if (ambiguousSatelliteIds.has(satellite.id)) continue;`
);

const scoreAnchor = `        const score =\n          normalizedGap * 4 +\n          normalizedCenterOffset +\n          crossAxisSpanMismatch * 2.5 +\n          crossAxisOverlapDeficit * 8 -\n          parentProminencePenalty;`;
if (!source.includes(scoreAnchor)) {
  throw new Error("Unable to locate satellite parent score");
}
source = source.replace(
  scoreAnchor,
  `${scoreAnchor}\n        const satelliteScores = attachmentScoresBySatellite.get(satellite.id) ?? [];\n        satelliteScores.push({ parentId: parent.id, score });\n        attachmentScoresBySatellite.set(satellite.id, satelliteScores);`
);

const selectionAnchor = `    if (!bestAttachment) break;\n\n    const parent = grouped[bestAttachment.parentIndex];\n    const satellite = grouped[bestAttachment.satelliteIndex];`;
if (!source.includes(selectionAnchor)) {
  throw new Error("Unable to locate selected satellite attachment");
}
source = source.replace(
  selectionAnchor,
  `    if (!bestAttachment) break;\n\n    const parent = grouped[bestAttachment.parentIndex];\n    const satellite = grouped[bestAttachment.satelliteIndex];\n    const competingScores = [...(attachmentScoresBySatellite.get(satellite.id) ?? [])].sort(\n      (a, b) => a.score - b.score\n    );\n    const ambiguityMargin = competingScores[1]?.score - competingScores[0]?.score;\n    if (ambiguityMargin !== undefined && ambiguityMargin < 0.16) {\n      ambiguousSatelliteIds.add(satellite.id);\n      continue;\n    }`
);

await fs.writeFile(adapterPath, source);
console.log("ambiguous satellite parent rejection ready");
