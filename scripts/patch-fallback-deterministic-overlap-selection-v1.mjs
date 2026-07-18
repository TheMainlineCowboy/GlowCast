import fs from "node:fs/promises";

const path = "src/core/maskCandidateAdapter.ts";
let source = await fs.readFile(path, "utf8");

const oldSelection = "    const duplicateIndex = next.findIndex((existing) => overlapRatio(existing.box, box) > 0.58);";
const marker = "const overlappingCandidates = next";
const qualityMarker = "perimeterSides:";
const spreadMarker = "perimeterSpread:";
const coverageMarker = "perimeterCoverage:";
const densityMarker = "perimeterDensity:";

if (source.includes(marker) && source.includes(densityMarker) && !source.includes(oldSelection)) {
  console.log("Density-aware nested fallback overlap selection already applied.");
  process.exit(0);
}

if (source.includes(marker) && source.includes(coverageMarker) && !source.includes(oldSelection)) {
  const currentCoverageSelection = `    // Resolve overlapping established masks deterministically. Stronger overlap wins;
    // for nested ties, prefer candidates whose perimeter evidence forms sustained runs,
    // then broad side coverage. This prevents widely separated edge samples from imitating
    // a genuinely enclosed pane or doorway before size and stable order are considered.
    const overlappingCandidates = next
      .map((existing, index) => {
        const sideTolerance = Math.max(1.2, Math.min(existing.box.width, existing.box.height) * 0.04);
        const topPositions: number[] = [];
        const bottomPositions: number[] = [];
        const leftPositions: number[] = [];
        const rightPositions: number[] = [];
        for (const point of existing.points) {
          if (Math.abs(point.y - existing.box.y) <= sideTolerance) topPositions.push(point.x);
          if (Math.abs(point.y - (existing.box.y + existing.box.height)) <= sideTolerance) bottomPositions.push(point.x);
          if (Math.abs(point.x - existing.box.x) <= sideTolerance) leftPositions.push(point.y);
          if (Math.abs(point.x - (existing.box.x + existing.box.width)) <= sideTolerance) rightPositions.push(point.y);
        }
        const positionSpan = (positions: number[], dimension: number) =>
          positions.length >= 2 ? (Math.max(...positions) - Math.min(...positions)) / Math.max(dimension, 1) : 0;
        const continuousCoverage = (positions: number[], dimension: number) => {
          const unique = [...new Set(positions.map((position) => Math.round(position * 10) / 10))].sort((a, b) => a - b);
          if (unique.length < 2) return 0;
          const maxGap = Math.max(1.5, Math.min(4, dimension * 0.025));
          let bestStart = unique[0];
          let bestEnd = unique[0];
          let runStart = unique[0];
          let previous = unique[0];
          for (const position of unique.slice(1)) {
            if (position - previous > maxGap) runStart = position;
            previous = position;
            if (position - runStart > bestEnd - bestStart) {
              bestStart = runStart;
              bestEnd = position;
            }
          }
          return (bestEnd - bestStart) / Math.max(dimension, 1);
        };
        const sideSpreads = [
          positionSpan(topPositions, existing.box.width),
          positionSpan(bottomPositions, existing.box.width),
          positionSpan(leftPositions, existing.box.height),
          positionSpan(rightPositions, existing.box.height)
        ];
        const sideCoverage = [
          continuousCoverage(topPositions, existing.box.width),
          continuousCoverage(bottomPositions, existing.box.width),
          continuousCoverage(leftPositions, existing.box.height),
          continuousCoverage(rightPositions, existing.box.height)
        ];
        return {
          index,
          overlap: overlapRatio(existing.box, box),
          perimeterSides: sideCoverage.filter((coverage) => coverage > 0).length,
          perimeterCoverage: sideCoverage.reduce((sum, coverage) => sum + Math.min(coverage, 1), 0),
          perimeterSpread: sideSpreads.reduce((sum, spread) => sum + Math.min(spread, 1), 0),
          area: existing.box.width * existing.box.height
        };
      })
      .filter((candidate) => candidate.overlap > 0.58)
      .sort((a, b) =>
        b.overlap - a.overlap ||
        b.perimeterSides - a.perimeterSides ||
        b.perimeterCoverage - a.perimeterCoverage ||
        b.perimeterSpread - a.perimeterSpread ||
        a.area - b.area ||
        a.index - b.index
      );
    const duplicateIndex = overlappingCandidates[0]?.index ?? -1;`;

  if (!source.includes(currentCoverageSelection)) {
    throw new Error("Existing continuous-coverage fallback selection block was not recognized.");
  }
  source = source.replace(currentCoverageSelection, buildSelectionBlock());
} else if (source.includes(marker) && !source.includes(oldSelection)) {
  throw new Error("Deterministic fallback selection exists without the expected continuous-coverage ranking.");
} else {
  if (!source.includes(oldSelection)) {
    throw new Error("Fallback duplicate-selection anchor not found.");
  }
  source = source.replace(oldSelection, buildSelectionBlock());
}

if (!source.includes(marker) || !source.includes(qualityMarker) || !source.includes(spreadMarker) || !source.includes(coverageMarker) || !source.includes(densityMarker) || source.includes(oldSelection)) {
  throw new Error("Density-aware nested fallback overlap selection was not applied.");
}

await fs.writeFile(path, source);
console.log("Selected nested fallback targets by overlap, perimeter completeness, continuous side coverage, edge density, spread, surface size, and stable order.");

function buildSelectionBlock() {
  return `    // Resolve overlapping established masks deterministically. Stronger overlap wins;
    // for nested ties, prefer sustained perimeter runs and then denser evidence within
    // those runs. This keeps a few loosely spaced samples from tying a stable window,
    // doorway, or pane edge before broad spread, size, and stable order are considered.
    const overlappingCandidates = next
      .map((existing, index) => {
        const sideTolerance = Math.max(1.2, Math.min(existing.box.width, existing.box.height) * 0.04);
        const topPositions: number[] = [];
        const bottomPositions: number[] = [];
        const leftPositions: number[] = [];
        const rightPositions: number[] = [];
        for (const point of existing.points) {
          if (Math.abs(point.y - existing.box.y) <= sideTolerance) topPositions.push(point.x);
          if (Math.abs(point.y - (existing.box.y + existing.box.height)) <= sideTolerance) bottomPositions.push(point.x);
          if (Math.abs(point.x - existing.box.x) <= sideTolerance) leftPositions.push(point.y);
          if (Math.abs(point.x - (existing.box.x + existing.box.width)) <= sideTolerance) rightPositions.push(point.y);
        }
        const positionSpan = (positions: number[], dimension: number) =>
          positions.length >= 2 ? (Math.max(...positions) - Math.min(...positions)) / Math.max(dimension, 1) : 0;
        const continuousMetrics = (positions: number[], dimension: number) => {
          const unique = [...new Set(positions.map((position) => Math.round(position * 10) / 10))].sort((a, b) => a - b);
          if (unique.length < 2) return { coverage: 0, density: 0 };
          const maxGap = Math.max(1.5, Math.min(4, dimension * 0.025));
          let bestRun = [unique[0]];
          let run = [unique[0]];
          for (const position of unique.slice(1)) {
            if (position - run[run.length - 1] > maxGap) run = [position];
            else run.push(position);
            if (
              run[run.length - 1] - run[0] > bestRun[bestRun.length - 1] - bestRun[0] ||
              (run[run.length - 1] - run[0] === bestRun[bestRun.length - 1] - bestRun[0] && run.length > bestRun.length)
            ) {
              bestRun = [...run];
            }
          }
          const span = bestRun[bestRun.length - 1] - bestRun[0];
          return {
            coverage: span / Math.max(dimension, 1),
            density: Math.min(1, bestRun.length / Math.max(span + 1, 1))
          };
        };
        const sideSpreads = [
          positionSpan(topPositions, existing.box.width),
          positionSpan(bottomPositions, existing.box.width),
          positionSpan(leftPositions, existing.box.height),
          positionSpan(rightPositions, existing.box.height)
        ];
        const sideMetrics = [
          continuousMetrics(topPositions, existing.box.width),
          continuousMetrics(bottomPositions, existing.box.width),
          continuousMetrics(leftPositions, existing.box.height),
          continuousMetrics(rightPositions, existing.box.height)
        ];
        return {
          index,
          overlap: overlapRatio(existing.box, box),
          perimeterSides: sideMetrics.filter((metrics) => metrics.coverage > 0).length,
          perimeterCoverage: sideMetrics.reduce((sum, metrics) => sum + Math.min(metrics.coverage, 1), 0),
          perimeterDensity: sideMetrics.reduce((sum, metrics) => sum + metrics.density, 0),
          perimeterSpread: sideSpreads.reduce((sum, spread) => sum + Math.min(spread, 1), 0),
          area: existing.box.width * existing.box.height
        };
      })
      .filter((candidate) => candidate.overlap > 0.58)
      .sort((a, b) =>
        b.overlap - a.overlap ||
        b.perimeterSides - a.perimeterSides ||
        b.perimeterCoverage - a.perimeterCoverage ||
        b.perimeterDensity - a.perimeterDensity ||
        b.perimeterSpread - a.perimeterSpread ||
        a.area - b.area ||
        a.index - b.index
      );
    const duplicateIndex = overlappingCandidates[0]?.index ?? -1;`;
}
