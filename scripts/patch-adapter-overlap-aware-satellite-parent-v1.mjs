import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const crossAxisOverlapDeficit =";
if (source.includes(marker)) {
  console.log("overlap-aware satellite parent patch already applied");
  process.exit(0);
}

const anchor = `        const crossAxisSpanMismatch = Math.abs(\n          Math.log(Math.max(satelliteCrossAxisSpan, 1) / Math.max(parentCrossAxisSpan, 1))\n        );\n        const score = normalizedGap * 4 + normalizedCenterOffset + crossAxisSpanMismatch * 2.5;`;
const replacement = `        const crossAxisSpanMismatch = Math.abs(\n          Math.log(Math.max(satelliteCrossAxisSpan, 1) / Math.max(parentCrossAxisSpan, 1))\n        );\n        const crossAxisOverlap = sideBySide\n          ? Math.max(\n              0,\n              Math.min(parent.box.y + parent.box.height, satellite.box.y + satellite.box.height) -\n                Math.max(parent.box.y, satellite.box.y)\n            ) / Math.max(Math.min(parent.box.height, satellite.box.height), 1)\n          : Math.max(\n              0,\n              Math.min(parent.box.x + parent.box.width, satellite.box.x + satellite.box.width) -\n                Math.max(parent.box.x, satellite.box.x)\n            ) / Math.max(Math.min(parent.box.width, satellite.box.width), 1);\n        const crossAxisOverlapDeficit = 1 - Math.min(1, crossAxisOverlap);\n        const score =\n          normalizedGap * 4 +\n          normalizedCenterOffset +\n          crossAxisSpanMismatch * 2.5 +\n          crossAxisOverlapDeficit * 8;`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate span-aware satellite scoring anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("applied overlap-aware satellite parent scoring patch");
