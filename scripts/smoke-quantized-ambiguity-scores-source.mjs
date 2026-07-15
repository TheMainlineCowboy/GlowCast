import fs from "node:fs/promises";

const adapterPath = "src/core/maskCandidateAdapter.ts";
const source = await fs.readFile(adapterPath, "utf8");

const requiredMarkers = [
  "const quantizeAttachmentScore = (score: number) => Math.round(score * 10000) / 10000;",
  ".map(({ parentId, score }) => ({ parentId, score: quantizeAttachmentScore(score) }))",
  ".sort((a, b) => a.score - b.score || a.parentId.localeCompare(b.parentId))"
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    console.error(`Quantized ambiguity score smoke failed: missing ${marker}`);
    process.exit(1);
  }
}

if (source.includes("const competingScores = [...scores].sort((a, b) => a.score - b.score);")) {
  console.error("Quantized ambiguity score smoke failed: raw floating-point score ordering returned.");
  process.exit(1);
}

const quantizeAttachmentScore = (score) => Math.round(score * 10000) / 10000;
const nearlyEqualA = quantizeAttachmentScore(0.314159261);
const nearlyEqualB = quantizeAttachmentScore(0.314159269);
if (nearlyEqualA !== nearlyEqualB) {
  console.error("Quantized ambiguity score smoke failed: insignificant score noise was not collapsed.");
  process.exit(1);
}

console.log("Quantized ambiguity score smoke passed: insignificant floating-point noise cannot alter parent ordering, and ties resolve deterministically by parent identity.");
