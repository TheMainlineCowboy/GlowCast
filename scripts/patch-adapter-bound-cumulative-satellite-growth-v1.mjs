import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const originalParentAreas = new Map";
if (source.includes(marker)) {
  console.log("cumulative satellite growth patch already applied");
  process.exit(0);
}

const setupAnchor = `function groupNearbySatellites(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {\n  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));\n  let changed = true;`;
const setupReplacement = `function groupNearbySatellites(candidates: MaskCandidateOutput[], bounds: SimpleBox): MaskCandidateOutput[] {\n  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));\n  const originalParentAreas = new Map(\n    grouped.map((candidate) => [candidate.id, Math.max(candidate.box.width * candidate.box.height, 1)])\n  );\n  let changed = true;`;

if (!source.includes(setupAnchor)) {
  throw new Error("Unable to locate satellite grouping setup anchor");
}
source = source.replace(setupAnchor, setupReplacement);

const mergeAnchor = `        const mergedBox = mergeBoxes(parent.box, satellite.box);\n        grouped[i] = {`;
const mergeReplacement = `        const mergedBox = mergeBoxes(parent.box, satellite.box);\n        const originalParentArea = originalParentAreas.get(parent.id) ?? Math.max(parent.box.width * parent.box.height, 1);\n        const cumulativeGrowthRatio = (mergedBox.width * mergedBox.height) / originalParentArea;\n        if (cumulativeGrowthRatio > 1.72) continue;\n\n        grouped[i] = {`;

if (!source.includes(mergeAnchor)) {
  throw new Error("Unable to locate satellite merge anchor");
}
source = source.replace(mergeAnchor, mergeReplacement);

await fs.writeFile(adapterPath, source);
console.log("bounded cumulative satellite growth ready");
