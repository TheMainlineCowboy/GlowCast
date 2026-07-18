import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const marker = "perimeterStrength:";
if (source.includes(marker)) {
  console.log("Strength-aware nested fallback ranking already applied.");
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
    "const continuousMetrics = (samples: Array<{ position: number; strength: number }>, dimension: number) => {\n          const unique = [...new Map(samples.map((sample) => {\n            const position = Math.round(sample.position * 10) / 10;\n            return [position, { position, strength: sample.strength }] as const;\n          }).sort((a, b) => b[1].strength - a[1].strength)).values()].sort((a, b) => a.position - b.position);\n          if (unique.length < 2) return { coverage: 0, density: 0, strength: 0 };"
  )
  .replaceAll("let bestRun = [unique[0]];", "let bestRun = [unique[0]];")
  .replaceAll("if (position - run[run.length - 1] > maxGap) run = [position];", "if (position.position - run[run.length - 1].position > maxGap) run = [position];")
  .replaceAll("run[run.length - 1] - run[0] > bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position > bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replaceAll("run[run.length - 1] - run[0] === bestRun[bestRun.length - 1] - bestRun[0]", "run[run.length - 1].position - run[0].position === bestRun[bestRun.length - 1].position - bestRun[0].position")
  .replace("const span = bestRun[bestRun.length - 1] - bestRun[0];", "const span = bestRun[bestRun.length - 1].position - bestRun[0].position;")
  .replace(
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1))",
    "density: Math.min(1, bestRun.length / Math.max(span + 1, 1)),\n            strength: bestRun.reduce((sum, sample) => sum + Math.max(0, Math.min(sample.strength, 255)), 0) / Math.max(bestRun.length * 255, 1)"
  )
  .replace(
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),",
    "perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),\n          perimeterStrength: sideMetrics.reduce((sum, metrics) => sum + metrics.strength, 0),"
  )
  .replace(
    "b.perimeterDensity - a.perimeterDensity ||",
    "b.perimeterDensity - a.perimeterDensity ||\n        b.perimeterStrength - a.perimeterStrength ||"
  );

if (!source.includes(marker) || !source.includes("b.perimeterStrength - a.perimeterStrength ||")) {
  throw new Error("Strength-aware nested fallback ranking was not applied.");
}

await fs.writeFile(path, source);
console.log("Ranked equally complete nested perimeter evidence by normalized edge strength before spread and size.");
