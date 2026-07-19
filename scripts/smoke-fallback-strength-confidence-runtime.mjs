import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const requiredSamples = Math.max(6, Math.min(24, Math.ceil(dimension / 12)));",
  "confidence: Math.min(1, bestRun.length / requiredSamples)",
  "const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));",
  "return confidence * (1 - Math.min(variance * 4, 1));",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) {
  throw new Error(`Resolution-aware nested strength ranking is incomplete: ${JSON.stringify(missing)}`);
}

function sideConfidence(sampleCount, dimension) {
  const requiredSamples = Math.max(6, Math.min(24, Math.ceil(dimension / 12)));
  return Math.min(1, sampleCount / requiredSamples);
}

function consistencyScore(strengths, sampleCounts, dimensions) {
  const mean = strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
  const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / strengths.length;
  const confidence = Math.min(...sampleCounts.map((count, index) => sideConfidence(count, dimensions[index])));
  return confidence * (1 - Math.min(variance * 4, 1));
}

const compactFrame = consistencyScore([0.47, 0.47, 0.47, 0.47], [8, 8, 8, 8], [60, 60, 60, 60]);
const largeSparseFrame = consistencyScore([0.47, 0.47, 0.47, 0.47], [8, 8, 8, 8], [240, 240, 240, 240]);
if (!(compactFrame > largeSparseFrame)) {
  throw new Error(`Equal sample counts must carry less confidence on large perimeters: ${compactFrame} <= ${largeSparseFrame}`);
}

const sustainedLargeFrame = consistencyScore([0.47, 0.47, 0.47, 0.47], [20, 20, 20, 20], [240, 240, 240, 240]);
if (!(sustainedLargeFrame > largeSparseFrame)) {
  throw new Error(`Sustained large-frame evidence should outrank sparse large-frame evidence: ${sustainedLargeFrame} <= ${largeSparseFrame}`);
}

const balancedStrength = consistencyScore([0.4, 0.4, 0.4, 0.4], [13, 13, 13, 13], [120, 120, 120, 120]);
const unevenStrength = consistencyScore([0.4, 0.4, 0.4, 0.8], [13, 13, 13, 13], [120, 120, 120, 120]);
if (!(balancedStrength > unevenStrength)) {
  throw new Error(`Balanced four-side strength should outrank uneven strength: ${balancedStrength} <= ${unevenStrength}`);
}

console.log("Strength-confidence smoke passed: compact openings remain sensitive while large perimeters require proportionally sustained architectural evidence.");
