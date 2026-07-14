import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const parentProminencePenalty =";
if (source.includes(marker)) {
  console.log("strongest satellite parent patch already applied");
  process.exit(0);
}

const anchor = `        const crossAxisOverlapDeficit = 1 - Math.min(1, crossAxisOverlap);\n        const score =\n          normalizedGap * 4 +\n          normalizedCenterOffset +\n          crossAxisSpanMismatch * 2.5 +\n          crossAxisOverlapDeficit * 8;`;

const replacement = `        const crossAxisOverlapDeficit = 1 - Math.min(1, crossAxisOverlap);\n        const boundsArea = Math.max(bounds.width * bounds.height, 1);\n        const parentAreaShare = (attachmentBox.width * attachmentBox.height) / boundsArea;\n        const parentShapeBalance =\n          Math.min(attachmentBox.width, attachmentBox.height) /\n          Math.max(attachmentBox.width, attachmentBox.height, 1);\n        const parentProminencePenalty =\n          Math.min(0.9, Math.sqrt(parentAreaShare) * 1.8 + parentShapeBalance * 0.28);\n        const score =\n          normalizedGap * 4 +\n          normalizedCenterOffset +\n          crossAxisSpanMismatch * 2.5 +\n          crossAxisOverlapDeficit * 8 -\n          parentProminencePenalty;`;

if (!source.includes(anchor)) {
  throw new Error("Unable to locate overlap-aware satellite scoring anchor");
}

source = source.replace(anchor, replacement);
await fs.writeFile(adapterPath, source);
console.log("stronger architectural satellite parent preference ready");
