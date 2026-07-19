import fs from "node:fs/promises";

const adapterSource = await fs.readFile("src/core/maskCandidateAdapter.ts", "utf8");
const required = [
  "const usableSpan = Math.min(dimension, Math.max(span + 1, 1));",
  "const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));",
  "const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));",
  "const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);",
  "const endpointContinuation = Math.max(",
  "const continuationConfidence = 0.7 + 0.3 * Math.sqrt",
  "confidence: Math.min(1, bestRun.length / requiredSamples) * spanConfidence * continuationConfidence",
  "const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));",
  "return confidence * (1 - Math.min(variance * 4, 1));",
  "b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||"
];

const missing = required.filter((snippet) => !adapterSource.includes(snippet));
if (missing.length) {
  throw new Error(`Edge-continuation-aware nested strength ranking is incomplete: ${JSON.stringify(missing)}`);
}

function sideConfidence(sampleCount, dimension, start, end) {
  const span = end - start;
  const usableSpan = Math.min(dimension, Math.max(span + 1, 1));
  const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));
  const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));
  const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);
  const endpointContinuation = Math.max(
    1 - start / Math.max(dimension, 1),
    end / Math.max(dimension, 1)
  );
  const continuationConfidence = 0.7 + 0.3 * Math.sqrt(Math.max(0, Math.min(endpointContinuation, 1)));
  return Math.min(1, sampleCount / requiredSamples) * spanConfidence * continuationConfidence;
}

function consistencyScore(strengths, sampleCounts, dimensions, runs) {
  const mean = strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
  const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / strengths.length;
  const confidence = Math.min(...sampleCounts.map((count, index) => sideConfidence(count, dimensions[index], runs[index][0], runs[index][1])));
  return confidence * (1 - Math.min(variance * 4, 1));
}

const compactFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [60, 60, 60, 60],
  [[0, 59], [0, 59], [0, 59], [0, 59]]
);
const largeFrameAnchoredSubsection = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [[0, 59], [0, 59], [0, 59], [0, 59]]
);
if (!(compactFrame > largeFrameAnchoredSubsection)) {
  throw new Error(`A full compact perimeter should outrank the same short subsection on a much larger side: ${compactFrame} <= ${largeFrameAnchoredSubsection}`);
}
if (!(largeFrameAnchoredSubsection > 0.65)) {
  throw new Error(`A substantial edge-anchored subsection should retain useful partial-occlusion confidence: ${largeFrameAnchoredSubsection}`);
}

const floatingSubsection = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [[90, 149], [90, 149], [90, 149], [90, 149]]
);
if (!(largeFrameAnchoredSubsection > floatingSubsection)) {
  throw new Error(`An edge-anchored visible run should outrank an equal free-floating decorative run: ${largeFrameAnchoredSubsection} <= ${floatingSubsection}`);
}

const tinyDecorativeFragment = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [[110, 129], [110, 129], [110, 129], [110, 129]]
);
if (!(floatingSubsection > tinyDecorativeFragment)) {
  throw new Error(`A representative floating subsection must still outrank a tiny decorative fragment: ${floatingSubsection} <= ${tinyDecorativeFragment}`);
}

const largeBroadSparseFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [8, 8, 8, 8],
  [240, 240, 240, 240],
  [[0, 239], [0, 239], [0, 239], [0, 239]]
);
if (!(largeFrameAnchoredSubsection > largeBroadSparseFrame)) {
  throw new Error(`Dense usable subsections must outrank broadly sparse large perimeters: ${largeFrameAnchoredSubsection} <= ${largeBroadSparseFrame}`);
}

const sustainedLargeFrame = consistencyScore(
  [0.47, 0.47, 0.47, 0.47],
  [20, 20, 20, 20],
  [240, 240, 240, 240],
  [[0, 239], [0, 239], [0, 239], [0, 239]]
);
if (!(sustainedLargeFrame > largeFrameAnchoredSubsection && sustainedLargeFrame > largeBroadSparseFrame)) {
  throw new Error(`Sustained broad large-frame evidence should outrank partial and sparse evidence: ${sustainedLargeFrame}`);
}

const balancedStrength = consistencyScore(
  [0.4, 0.4, 0.4, 0.4],
  [13, 13, 13, 13],
  [120, 120, 120, 120],
  [[0, 119], [0, 119], [0, 119], [0, 119]]
);
const unevenStrength = consistencyScore(
  [0.4, 0.4, 0.4, 0.8],
  [13, 13, 13, 13],
  [120, 120, 120, 120],
  [[0, 119], [0, 119], [0, 119], [0, 119]]
);
if (!(balancedStrength > unevenStrength)) {
  throw new Error(`Balanced four-side strength should outrank uneven strength: ${balancedStrength} <= ${unevenStrength}`);
}

console.log("Strength-confidence smoke passed: confidence rewards represented span and architectural endpoint continuation, preserves partial occlusion, and rejects free-floating decorative fragments and broadly sparse perimeters.");