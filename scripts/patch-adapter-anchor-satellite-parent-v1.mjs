import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const attachmentAnchors = new Map";
if (source.includes(marker)) {
  console.log("anchored satellite parent patch already applied");
  process.exit(0);
}

const start = source.indexOf("function groupNearbySatellites(");
const end = source.indexOf("\nfunction getFallbackSideCoverage", start);
if (start < 0 || end < 0) throw new Error("Unable to locate satellite grouping function");

let groupSource = source.slice(start, end);
const replacements = [
  [
    "  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));",
    "  const grouped = candidates.map((candidate) => ({ ...candidate, points: [...candidate.points] }));\n  const attachmentAnchors = new Map(candidates.map((candidate) => [candidate.id, { ...candidate.box }]));"
  ],
  [
    "        const satellite = grouped[j];\n        if (!shouldAttachSatellite(parent.box, satellite.box, bounds)) continue;\n\n        const gap = gapBetween(parent.box, satellite.box);",
    "        const satellite = grouped[j];\n        const attachmentBox = attachmentAnchors.get(parent.id) ?? parent.box;\n        if (!shouldAttachSatellite(attachmentBox, satellite.box, bounds)) continue;\n\n        const gap = gapBetween(attachmentBox, satellite.box);"
  ],
  ["        const parentCenterX = parent.box.x + parent.box.width / 2;", "        const parentCenterX = attachmentBox.x + attachmentBox.width / 2;"],
  ["        const parentCenterY = parent.box.y + parent.box.height / 2;", "        const parentCenterY = attachmentBox.y + attachmentBox.height / 2;"],
  ["          Math.abs(parentCenterX - satelliteCenterX) / Math.max(parent.box.width, 1) +", "          Math.abs(parentCenterX - satelliteCenterX) / Math.max(attachmentBox.width, 1) +"],
  ["          Math.abs(parentCenterY - satelliteCenterY) / Math.max(parent.box.height, 1);", "          Math.abs(parentCenterY - satelliteCenterY) / Math.max(attachmentBox.height, 1);"],
  ["        const parentCrossAxisSpan = sideBySide ? parent.box.height : parent.box.width;", "        const parentCrossAxisSpan = sideBySide ? attachmentBox.height : attachmentBox.width;"],
  ["              Math.min(parent.box.y + parent.box.height, satellite.box.y + satellite.box.height) -", "              Math.min(attachmentBox.y + attachmentBox.height, satellite.box.y + satellite.box.height) -"],
  ["                Math.max(parent.box.y, satellite.box.y)", "                Math.max(attachmentBox.y, satellite.box.y)"],
  ["            ) / Math.max(Math.min(parent.box.height, satellite.box.height), 1)", "            ) / Math.max(Math.min(attachmentBox.height, satellite.box.height), 1)"],
  ["              Math.min(parent.box.x + parent.box.width, satellite.box.x + satellite.box.width) -", "              Math.min(attachmentBox.x + attachmentBox.width, satellite.box.x + satellite.box.width) -"],
  ["                Math.max(parent.box.x, satellite.box.x)", "                Math.max(attachmentBox.x, satellite.box.x)"],
  ["            ) / Math.max(Math.min(parent.box.width, satellite.box.width), 1);", "            ) / Math.max(Math.min(attachmentBox.width, satellite.box.width), 1);"],
];

for (const [anchor, replacement] of replacements) {
  if (!groupSource.includes(anchor)) {
    throw new Error(`Unable to locate anchored satellite grouping fragment: ${anchor}`);
  }
  groupSource = groupSource.replace(anchor, replacement);
}

source = source.slice(0, start) + groupSource + source.slice(end);
await fs.writeFile(adapterPath, source);
console.log("applied anchored satellite parent geometry patch");
