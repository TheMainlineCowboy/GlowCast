import fs from "node:fs/promises";

const source = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");

const required = [
  "function rejectBroadMultiOpeningMasks(",
  "candidateArea < boundsArea * 0.075",
  "otherArea <= candidateArea * 0.46",
  "separationX >= 0.24 || separationY >= 0.24",
  "pairOverlap < 0.42",
  "pairArea >= candidateArea * 0.16",
  "return rejectBroadMultiOpeningMasks("
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Broad multi-opening mask suppression smoke failed: missing ${token}`);
  }
}

console.log("Broad multi-opening mask suppression source smoke passed.");
