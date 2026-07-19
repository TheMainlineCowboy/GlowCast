import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "perimeterStrengthConsistency:";
if (source.includes(marker)) {
  console.log("Usable-span-aware confidence strength ranking already applied.");
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
    "const continuousMetrics = (samples: Array<{ position: number; strength: number }>, dimension: number) => {\n          const unique = [...new Map(samples.map((sample) => {\n            const position = Math.round(sample.position * 10) / 10;\n            return [position, { position, strength: sample.strength }] as const;\n          }).sort((a, b) => b[1].strength - a[1].strength)).values()].sort((a, b) => a.position - b.position);\n          if (unique.length < 2) return { coverage: 0, density: 0, strength: 0, sampleCount: 0, confidence: 0 };"
  )
  .replaceAll("let bestRun = [unique[0]];", "let bestRun = [unique[0]];")
  .replaceAll("if (position - run[run.length - 1] > maxGap) run = [position];", "if (position.position - run[run.length - 1].position > maxGap) run = [position];")
  .replaceAll("run[run.length - 1] - run[0] > bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position > bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replaceAll("run[run.length - 1] - run[0] === bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position === bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replace(
    "const span = bestRun[bestRun.length - 1] - bestRun[0];",
    "const span = bestRun[bestRun.length - 1].position - bestRun[0].position;\n          const strengths = bestRun\n            .map((sample) => Math.max(0, Math.min(sample.strength, 255)))\n            .sort((a, b) => a - b);\n          const trimCount = strengths.length >= 10 ? Math.max(1, Math.floor(strengths.length * 0.1)) : 0;\n          const robustStrengths = strengths.slice(trimCount, strengths.length - trimCount || strengths.length);\n          const robustStrength = robustStrengths.reduce((sum, strength) => sum + strength, 0) / Math.max(robustStrengths.length * 255, 1);\n          const usableSpan = Math.min(dimension, Math.max(span + 1, 1));\n          const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));\n          const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));\n          const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);"
  )
  .replace(
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1))",
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1)),\n            strength: robustStrength,\n            sampleCount: bestRun.length,\n            confidence: Math.min(1, bestRun.length / requiredSamples) * spanConfidence"
  )
  .replace(
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),",
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),\n          perimeterStrengthBalance: Math.min(...sideMetrics.map((metrics) => metrics.strength)),\n          perimeterStrengthVariance: (() => {\n            const strengths = sideMetrics.map((metrics) => metrics.strength);\n            const mean = strengths.reduce((sum, strength) => sum + strength, 0) / Math.max(strengths.length, 1);\n            return strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / Math.max(strengths.length, 1);\n          })(),\n          perimeterStrengthConsistency: (() => {\n            const strengths = sideMetrics.map((metrics) => metrics.strength);\n            const mean = strengths.reduce((sum, strength) => sum + strength, 0) / Math.max(strengths.length, 1);\n            const variance = strengths.reduce((sum, strength) => sum + (strength - mean) ** 2, 0) / Math.max(strengths.length, 1);\n            const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));\n            return confidence * (1 - Math.min(variance * 4, 1));\n          })(),\n          perimeterStrength: sideMetrics.reduce((sum, metrics) => sum + metrics.strength, 0),"
  )
  .replace(
    "b.perimeterDensity - a.perimeterDensity ||",
    "b.perimeterDensity - a.perimeterDensity ||\n        b.perimeterStrengthBalance - a.perimeterStrengthBalance ||\n        b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||\n        a.perimeterStrengthVariance - b.perimeterStrengthVariance ||\n        b.perimeterStrength - a.perimeterStrength ||"
  );

if (
  !source.includes(marker) ||
  !source.includes("const usableSpan = Math.min(dimension, Math.max(span + 1, 1));") ||
  !source.includes("const requiredSamples = Math.max(6, Math.min(24, Math.ceil(usableSpan / 12)));") ||
  !source.includes("const representedProportion = Math.min(1, usableSpan / Math.max(dimension, 1));") ||
  !source.includes("const spanConfidence = 0.45 + 0.55 * Math.sqrt(representedProportion);") ||
  !source.includes("confidence: Math.min(1, bestRun.length / requiredSamples) * spanConfidence") ||
  !source.includes("const confidence = Math.min(...sideMetrics.map((metrics) => metrics.confidence));") ||
  !source.includes("b.perimeterStrengthBalance - a.perimeterStrengthBalance ||") ||
  !source.includes("b.perimeterStrengthConsistency - a.perimeterStrengthConsistency ||") ||
  !source.includes("a.perimeterStrengthVariance - b.perimeterStrengthVariance ||") ||
  !source.includes("b.perimeterStrength - a.perimeterStrength ||") ||
  !source.includes("const robustStrength =")
) {
  throw new Error("Span-proportion-aware confidence strength ranking was not applied.");
}

await fs.writeFile(path, source);
console.log("Ranked nested perimeter strength consistency using confidence scaled to usable span and represented side proportion.");
