import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const usableSpan = Math.min(dimension, Math.max(span + 1, 1));",
  "const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));",
  "const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));",
  "const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);",
  "confidence: Math.min(1, bestRun.length / requiredSamples) * spanConfidence",
  "const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));",
  "return confidence * (1 - Math.min(variance * 4, 1));",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) {
  throw new Error(`Span-proportion-aware nested strength ranking is incomplete: ${JSON.stringify(missing)}`);
}

function sideConfidence(sampleCount, dimension, span) {
  const usableSpan = Math.min(dimension, Math.max(span + 1, 1));
  const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));
  const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));
  const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);
  return Math.min(1, sampleCount / requiredSamples) * spanConfidence;
}

function consistencyScore(strengths, sampleCounts, dimensions, spans) {
  const mean = strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
  const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / strengths.length;
  const confidence = Math.min(...sampleCounts.map((count, index) => sideConfidence(count, dimensions[index], spans[index])));
  return confidence * (1 - Math.min(variance * 4, 1));
}

const compactFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [60, 60, 60, 60],
  [59, 59, 59, 59]
);
const largeFrameDenseSubsection = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [59, 59, 59, 59]
);
if (!(compactFrame > largeFrameDenseSubsection)) {
  throw new Error(`A full compact perimeter should outrank the same short subsection on a much larger side: ${compactFrame} <= ${largeFrameDenseSubsection}`);
}
if (!(largeFrameDenseSubsection > 0.65)) {
  throw new Error(`A substantial dense subsection should retain useful partial-occlusion confidence: ${largeFrameDenseSubsection}`);
}

const tinyDecorativeFragment = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [19, 19, 19, 19]
);
if (!(largeFrameDenseSubsection > tinyDecorativeFragment)) {
  throw new Error(`A representative dense subsection must outrank a tiny decorative fragment: ${largeFrameDenseSubsection} <= ${tinyDecorativeFragment}`);
}

const largeBroadSparseFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [239, 239, 239, 239]
);
if (!(largeFrameDenseSubsection > largeBroadSparseFrame)) {
  throw new Error(`Dense usable subsections must outrank broadly sparse large perimeters: ${largeFrameDenseSubsection} <= ${largeBroadSparseFrame}`);
}

const sustainedLargeFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [20, 20, 20, 20],
  [240, 240, 240, 240],
  [239, 239, 239, 239]
);
if (!(sustainedLargeFrame > largeFrameDenseSubsection && sustainedLargeFrame > largeBroadSparseFrame)) {
  throw new Error(`Sustained broad large-frame evidence should outrank partial and sparse evidence: ${sustainedLargeFrame}`);
}

const balancedStrength = consistencyScore(
  [0.4, 0.4, 0.4, 0.4],
  [13, 13, 13, 13],
  [120, 120, 120, 120],
  [119, 119, 119, 119]
);
const unevenStrength = consistencyScore(
  [0.4, 0.4, 0.4, 0.8],
  [13, 13, 13, 13],
  [120, 120, 120, 120],
  [119, 119, 119, 119]
);
if (!(balancedStrength > unevenStrength)) {
  throw new Error(`Balanced four-side strength should outrank uneven strength: ${balancedStrength} <= ${unevenStrength}`);
}

console.log("Strength-confidence smoke passed: confidence rewards representative continuous span, preserves partial occlusion, and rejects tiny decorative fragments and broadly sparse perimeters.");
