import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const originalParentAreas = new Map";
if (source.includes(marker)) {
  console.log("cumulative satellite growth patch already applied");
  process.exit(0);
}

const groupedAnchor = "  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));";
if (!source.includes(groupedAnchor)) {
  throw new Error("Unable to locate grouped candidate initialization");
}
source = source.replace(
  groupedAnchor,
  `${groupedAnchor}\n  const originalParentAreas = new Map(\n    grouped.map((candidate) => [candidate.id, Math.max(candidate.box.width * candidate.box.height, 1)])\n  );\n  const blockedSatelliteAttachments = new Set<string>();`
);

const pairAnchor = "        if (i === j) continue;";
if (!source.includes(pairAnchor)) {
  throw new Error("Unable to locate satellite pair guard");
}
source = source.replace(
  pairAnchor,
  `${pairAnchor}\n\n        const attachmentKey = grouped[i].id + \":\" + grouped[j].id;\n        if (blockedSatelliteAttachments.has(attachmentKey)) continue;`
);

const mergedBoxAnchor = "    const mergedBox = mergeBoxes(parent.box, satellite.box);";
if (!source.includes(mergedBoxAnchor)) {
  throw new Error("Unable to locate selected satellite merge calculation");
}
source = source.replace(
  mergedBoxAnchor,
  `${mergedBoxAnchor}\n    const originalParentArea =\n      originalParentAreas.get(parent.id) ?? Math.max(parent.box.width * parent.box.height, 1);\n    const cumulativeGrowthRatio = (mergedBox.width * mergedBox.height) / originalParentArea;\n    if (cumulativeGrowthRatio > 1.72) {\n      blockedSatelliteAttachments.add(parent.id + \":\" + satellite.id);\n      continue;\n    }`
);

await fs.writeFile(adapterPath, source);
console.log("bounded cumulative satellite growth ready");
