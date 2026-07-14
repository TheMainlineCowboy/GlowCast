import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const requiredFragments = [
  "const parentAreaShare = (attachmentBox.width * attachmentBox.height) / boundsArea;",
  "const parentShapeBalance =",
  "const parentProminencePenalty =",
  "crossAxisOverlapDeficit * 8 -\n          parentProminencePenalty"
];

for (const fragment of requiredFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`Strongest satellite parent regression: missing ${fragment}`);
  }
}

const prominenceCap = source.match(/Math\.min\(0\.9, Math\.sqrt\(parentAreaShare\) \* 1\.8 \+ parentShapeBalance \* 0\.28\)/);
if (!prominenceCap) {
  throw new Error("Strongest satellite parent regression: prominence weighting changed unexpectedly");
}

console.log("strongest satellite parent source verified");
