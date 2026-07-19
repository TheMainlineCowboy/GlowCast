import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "sampleCount: bestRun.length",
  "const confidence = Math.min(...sideMetrics.map((metrics) => Math.min(1, metrics.sampleCount / 12)));",
  "return confidence * (1 - Math.min(variance * 4, 1));",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) {
  throw new Error(`Confidence-aware nested strength ranking is incomplete: ${JSON.stringify(missing)}`);
}

function consistencyScore(strengths, sampleCounts) {
  const mean = strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
  const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / strengths.length;
  const confidence = Math.min(...sampleCounts.map((count) => Math.min(1, count / 12)));
  return confidence * (1 - Math.min(variance * 4, 1));
}

const balancedConfidence = consistencyScore([0.47, 0.47, 0.47, 0.47], [13, 13, 13, 13]);
const sparseSideConfidence = consistencyScore([0.47, 0.47, 0.47, 0.47], [10, 14, 14, 14]);
if (!(balancedConfidence > sparseSideConfidence)) {
  throw new Error(`Balanced sustained evidence should outrank sparse-side consistency: ${balancedConfidence} <= ${sparseSideConfidence}`);
}

const balancedStrength = consistencyScore([0.4, 0.4, 0.4, 0.4], [13, 13, 13, 13]);
const unevenStrength = consistencyScore([0.4, 0.4, 0.4, 0.8], [13, 13, 13, 13]);
if (!(balancedStrength > unevenStrength)) {
  throw new Error(`Balanced four-side strength should outrank uneven strength: ${balancedStrength} <= ${unevenStrength}`);
}

console.log("Strength-confidence smoke passed: sparse side evidence cannot appear as trustworthy as sustained, balanced architectural support.");
