import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const crossAxisSpanMismatch =";
if (source.includes(marker)) {
  console.log("span-aware satellite parent patch already applied");
  process.exit(0);
}

const anchor = `        const normalizedGap = gap.x / Math.max(bounds.width, 1) + gap.y / Math.max(bounds.height, 1);\n        const score = normalizedGap * 4 + normalizedCenterOffset;`;
const replacement = `        const normalizedGap = gap.x / Math.max(bounds.width, 1) + gap.y / Math.max(bounds.height, 1);\n        const sideBySide = gap.x >= gap.y;\n        const parentCrossAxisSpan = sideBySide ? parent.box.height : parent.box.width;\n        const satelliteCrossAxisSpan = sideBySide ? satellite.box.height : satellite.box.width;\n        const crossAxisSpanMismatch = Math.abs(\n          Math.log(Math.max(satelliteCrossAxisSpan, 1) / Math.max(parentCrossAxisSpan, 1))\n        );\n        const score = normalizedGap * 4 + normalizedCenterOffset + crossAxisSpanMismatch * 2.5;`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate nearest-parent scoring anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("applied span-aware satellite parent scoring patch");
