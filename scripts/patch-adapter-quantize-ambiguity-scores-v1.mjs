import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(adapterPath, "utf8");

const marker = "const quantizeAttachmentScore = (score: number) => Math.round(score * 10000) / 10000;";
if (source.includes(marker)) {
  console.log("quantized ambiguity score patch already applied");
  process.exit(0);
}

const anchor = "  const isAmbiguousSatellite = (candidate: MaskCandidateOutput) =>\n    ambiguousSatelliteBoxes.some((box) => isSameSatelliteGeometry(box, candidate.box));";
if (!source.includes(anchor)) {
  throw new Error("Unable to locate ambiguous satellite helper");
}

source = source.replace(
  anchor,
  `${anchor}\n  // Detector geometry is derived from floating-point image coordinates. Quantizing\n  // parent scores prevents insignificant arithmetic noise from moving a satellite\n  // across the ambiguity boundary between otherwise equivalent frames.\n  const quantizeAttachmentScore = (score: number) => Math.round(score * 10000) / 10000;`
);

const comparisonAnchor = "      const competingScores = [...scores].sort((a, b) => a.score - b.score);";
if (!source.includes(comparisonAnchor)) {
  throw new Error("Unable to locate ambiguity score ordering");
}

source = source.replace(
  comparisonAnchor,
  "      const competingScores = scores\n        .map(({ parentId, score }) => ({ parentId, score: quantizeAttachmentScore(score) }))\n        .sort((a, b) => a.score - b.score || a.parentId.localeCompare(b.parentId));"
);

await fs.writeFile(adapterPath, source);
console.log("quantized ambiguity score comparison ready");
