import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "let bestAttachment:";
if (source.includes(marker)) {
  console.log("nearest satellite parent patch already applied");
  process.exit(0);
}

const start = source.indexOf("function groupNearbySatellites(");
const end = source.indexOf("\nfunction getFallbackSideCoverage", start);
if (start < 0 || end < 0) throw new Error("Unable to locate satellite grouping function");

const replacement = `function groupNearbySatellites(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {
  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));
  let changed = true;

  while (changed) {
    changed = false;
    let bestAttachment:
      | { parentIndex: number; satelliteIndex: number; score: number }
      | undefined;

    for (let i = 0; i < grouped.length; i += 1) {
      for (let j = 0; j < grouped.length; j += 1) {
        if (i === j) continue;

        const parent = grouped[i];
        const satellite = grouped[j];
        if (!shouldAttachSatellite(parent.box, satellite.box, bounds)) continue;

        const gap = gapBetween(parent.box, satellite.box);
        const parentCenterX = parent.box.x + parent.box.width / 2;
        const parentCenterY = parent.box.y + parent.box.height / 2;
        const satelliteCenterX = satellite.box.x + satellite.box.width / 2;
        const satelliteCenterY = satellite.box.y + satellite.box.height / 2;
        const normalizedCenterOffset =
          Math.abs(parentCenterX - satelliteCenterX) / Math.max(parent.box.width, 1) +
          Math.abs(parentCenterY - satelliteCenterY) / Math.max(parent.box.height, 1);
        const normalizedGap = gap.x / Math.max(bounds.width, 1) + gap.y / Math.max(bounds.height, 1);
        const score = normalizedGap * 4 + normalizedCenterOffset;

        if (!bestAttachment || score < bestAttachment.score) {
          bestAttachment = { parentIndex: i, satelliteIndex: j, score };
        }
      }
    }

    if (!bestAttachment) break;

    const parent = grouped[bestAttachment.parentIndex];
    const satellite = grouped[bestAttachment.satelliteIndex];
    const mergedBox = mergeBoxes(parent.box, satellite.box);
    grouped[bestAttachment.parentIndex] = {
      ...parent,
      box: mergedBox,
      points: buildOutlineFromPoints([...parent.points, ...satellite.points], mergedBox, 12)
    };
    grouped.splice(bestAttachment.satelliteIndex, 1);
    changed = true;
  }

  return grouped;
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
await fs.writeFile(adapterPath, source);
console.log("applied nearest satellite parent patch");
