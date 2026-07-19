import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "perimeterCornerPairSupport:";
const consistentSpacingMarker = "const gapClusterCandidates = gaps.slice(1).map((gap, index) => {";
const sampleConfidenceMarker = "const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));";
if (source.includes(marker) && source.includes(consistentSpacingMarker) && source.includes(sampleConfidenceMarker)) {
  console.log("Sample-confidence-aware corner-pair confidence ranking already applied.");
  process.exit(0);
}

const required = [
  "export type SimplePoint = { x: number; y: number };",
  "const topPositions: number[] = [];",
  "const continuousMetrics = (positions: number[], dimension: number) => {",
  "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),",
  "b.perimeterDensity - a.perimeterDensity ||"
];
for (const snippet of required) {
  if (!source.includes(snippet)) throw new Error(`Strength-aware fallback anchor missing: ${snippet}`);
}

source = source.replace(
  "export type SimplePoint = { x: number; y: number };",
  "export type SimplePoint = { x: number; y: number; strength?: number };"
);
source = source
  .replaceAll("const topPositions: number[] = [];", "const topPositions: Array<{ position: number; strength: number }> = [];")
  .replaceAll("const bottomPositions: number[] = [];", "const bottomPositions: Array<{ position: number; strength: number }> = [];")
  .replaceAll("const leftPositions: number[] = [];", "const leftPositions: Array<{ position: number; strength: number }> = [];")
  .replaceAll("const rightPositions: number[] = [];", "const rightPositions: Array<{ position: number; strength: number }> = [];")
  .replaceAll("topPositions.push(point.x);", "topPositions.push({ position: point.x, strength: point.strength ?? 0 });")
  .replaceAll("bottomPositions.push(point.x);", "bottomPositions.push({ position: point.x, strength: point.strength ?? 0 });")
  .replaceAll("leftPositions.push(point.y);", "leftPositions.push({ position: point.y, strength: point.strength ?? 0 });")
  .replaceAll("rightPositions.push(point.y);", "rightPositions.push({ position: point.y, strength: point.strength ?? 0 });")
  .replace(
    "const positionSpan = (positions: number[], dimension: number) =>\n          positions.length >= 2 ? (Math.max(...positions) - Math.min(...positions)) / Math.max(dimension, 1) : 0;",
    "const positionSpan = (samples: Array<{ position: number; strength: number }>, dimension: number) =>\n          samples.length >= 2 ? (Math.max(...samples.map((sample) => sample.position)) - Math.min(...samples.map((sample) => sample.position))) / Math.max(dimension, 1) : 0;"
  )
  .replace(
    "const continuousMetrics = (positions: number[], dimension: number) => {\n          const unique = [...new Set(positions.map((position) => Math.round(position * 10) / 10))].sort((a, b) => a - b);\n          if (unique.length < 2) return { coverage: 0, density: 0 };",
    "const continuousMetrics = (samples: Array<{ position: number; strength: number }>, dimension: number) => {\n          const unique = [...new Map(samples.map((sample) => {\n            const position = Math.round(sample.position * 10) / 10;\n            return [position, { position, strength: sample.strength }] as const;\n          }).sort((a, b) => b[1].strength - a[1].strength)).values()].sort((a, b) => a.position - b.position);\n          if (unique.length < 2) return { coverage: 0, density: 0, strength: 0, sampleCount: 0, confidence: 0, startContinuation: 0, endContinuation: 0 };"
  )
  .replaceAll("if (position - run[run.length - 1] > maxGap) run = [position];", "if (position.position - run[run.length - 1].position > maxGap) run = [position];")
  .replaceAll("run[run.length - 1] - run[0] > bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position > bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replaceAll("run[run.length - 1] - run[0] === bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position === bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replace(
    "const span = bestRun[bestRun.length - 1] - bestRun[0];",
    "const span = bestRun[bestRun.length - 1].position - bestRun[0].position;\n          const strengths = bestRun\n            .map((sample) => Math.max(0, Math.min(sample.strength, 255)))\n            .sort((a, b) => a - b);\n          const trimCount = strengths.length >= 10 ? Math.max(1, Math.floor(strengths.length * 0.1)) : 0;\n          const robustStrengths = strengths.slice(trimCount, strengths.length - trimCount || strengths.length);\n          const robustStrength = robustStrengths.reduce((sum, strength) => sum + strength, 0) / Math.max(robustStrengths.length * 255, 1);\n          const usableSpan = Math.min(dimension, Math.max(span + 1, 1));\n          const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));\n          const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));\n          const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);\n          const gaps = bestRun.slice(1).map((sample, index) => sample.position - bestRun[index].position).sort((a, b) => a - b);\n          const clusterSpread = (cluster: number[]) => {\n            const median = cluster[Math.floor(cluster.length / 2)] ?? 1;\n            return (Math.max(...cluster) - Math.min(...cluster)) / Math.max(median, 0.5);\n          };\n          const minimumSecondarySamples = Math.max(3, Math.ceil(gaps.length * 0.3));\n          const gapClusterCandidates = gaps.slice(1).map((gap, index) => {\n            const cutoff = index + 1;\n            const lower = gaps.slice(0, cutoff);\n            const upper = gaps.slice(cutoff);\n            const separation = gap / Math.max(gaps[index], 0.5);\n            const consistent = lower.length >= Math.max(2, Math.ceil(gaps.length * 0.4)) && upper.length >= minimumSecondarySamples && clusterSpread(lower) <= 0.45 && clusterSpread(upper) <= 0.45;\n            return { cutoff, separation, consistent };\n          });\n          const dominantGapCutoff = gapClusterCandidates\n            .filter((candidate) => candidate.consistent && candidate.separation >= 1.8)\n            .sort((a, b) => b.separation - a.separation || a.cutoff - b.cutoff)[0]?.cutoff ?? -1;\n          const stableGaps = dominantGapCutoff > 0 ? gaps.slice(0, dominantGapCutoff) : gaps;\n          const localSpacing = stableGaps[Math.floor(stableGaps.length / 2)] ?? 1;\n          const cornerTolerance = Math.max(3, Math.min(18, Math.max(dimension * 0.04, localSpacing * 2.5)));\n          const boundedContinuation = (distance: number) => Math.max(0, 1 - distance / cornerTolerance);\n          const startContinuation = boundedContinuation(bestRun[0].position);\n          const endContinuation = boundedContinuation(Math.max(0, dimension - bestRun[bestRun.length - 1].position));\n          const endpointContinuation = Math.max(startContinuation, endContinuation);\n          const continuationConfidence = 0.7 + 0.3 * Math.sqrt(endpointContinuation);"
  )
  .replace(
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1))",
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1)),\n            strength: robustStrength,\n            sampleCount: bestRun.length,\n            confidence: Math.min(1, bestRun.length / requiredSamples) * spanConfidence * continuationConfidence,\n            startContinuation,\n            endContinuation"
  )
  .replace(
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),",
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),\n          perimeterCornerPairSupport: (() => {\n            const [top, bottom, left, right] = sideMetrics;\n            return (\n              Math.min(top.startContinuation, left.startContinuation) +\n              Math.min(top.endContinuation, right.startContinuation) +\n              Math.min(bottom.startContinuation, left.endContinuation) +\n              Math.min(bottom.endContinuation, right.endContinuation)\n            );\n          })(),\n          perimeterStrengthBalance: Math.min(...sideMetrics.map((metrics) => metrics.strength)),\n          perimeterStrengthVariance: (() => {\n            const strengths = sideMetrics.map((metrics) => metrics.strength);\n            const mean = strengths.reduce((sum, strength) => sum + strength, 0) / Math.max(strengths.length, 1);\n            return strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / Math.max(strengths.length, 1);\n          })(),\n          perimeterStrengthConsistency: (() => {\n            const strengths = sideMetrics.map((metrics) => metrics.strength);\n            const mean = strengths.reduce((sum, strength) => sum + strength, 0) / Math.max(strengths.length, 1);\n            const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / Math.max(strengths.length, 1);\n            const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));\n            return confidence * (1 - Math.min(variance * 4, 1));\n          })(),\n          perimeterStrength: sideMetrics.reduce((sum, metrics) => sum + metrics.strength, 0),"
  )
  .replace(
    "b.perimeterDensity - a.perimeterDensity ||",
    "b.perimeterDensity - a.perimeterDensity ||\n        b.perimeterCornerPairSupport - a.perimeterCornerPairSupport ||\n        b.perimeterStrengthBalance - a.perimeterStrengthBalance ||\n        b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||\n        a.perimeterStrengthVariance - b.perimeterStrengthVariance ||\n        b.perimeterStrength - a.perimeterStrength ||"
  );

if (
  !source.includes(marker) ||
  !source.includes(consistentSpacingMarker) ||
  !source.includes(sampleConfidenceMarker) ||
  !source.includes("const clusterSpread = (cluster: number[]) => {") ||
  !source.includes("upper.length >= minimumSecondarySamples") ||
  !source.includes("candidate.consistent && candidate.separation >= 1.8") ||
  !source.includes("const stableGaps = dominantGapCutoff > 0 ? gaps.slice(0, dominantGapCutoff) : gaps;") ||
  !source.includes("const localSpacing = stableGaps[Math.floor(stableGaps.length / 2)] ?? 1;") ||
  !source.includes("Math.max(dimension * 0.04, localSpacing * 2.5)") ||
  !source.includes("Math.min(top.startContinuation, left.startContinuation)") ||
  !source.includes("Math.min(top.endContinuation, right.startContinuation)") ||
  !source.includes("Math.min(bottom.startContinuation, left.endContinuation)") ||
  !source.includes("Math.min(bottom.endContinuation, right.endContinuation)") ||
  !source.includes("b.perimeterCornerPairSupport - a.perimeterCornerPairSupport ||") ||
  !source.includes("const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));") ||
  !source.includes("const robustStrength =")
) {
  throw new Error("Sample-confidence-aware corner-pair confidence strength ranking was not applied.");
}

await fs.writeFile(path, source);
console.log("Ranked nested perimeter confidence using corner tolerances derived from well-supported, internally consistent local edge-spacing clusters and image scale.");